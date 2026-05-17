const { AuthBroker } = require("./AuthBroker");
const { AuthFlowStateMachine } = require("./AuthFlowStateMachine");
const { AUTH_FLOW_REASONS, AUTH_FLOW_STATES, TERMINAL_STATES } = require("./AuthFlowReasons");
const { AUTH_TELEMETRY_EVENTS, validateTelemetryEvent } = require("../telemetry/authTelemetrySchema");
const { AuthTelemetryBuffer } = require("../telemetry/AuthTelemetryBuffer");
const { resolveProviderPolicy } = require("../compatibility/providerCompatibilityPolicy");
const { createPkcePair, createStateToken } = require("./pkce");

const AUTH_COMPLETION_QUERY_KEYS = ["code", "oauth_token", "approval_code", "id_token", "access_token"];

class PathAAuthBroker extends AuthBroker {
  constructor(options = {}) {
    super();
    this.stateMachine = options.stateMachine || new AuthFlowStateMachine();
    this.telemetry = options.telemetry || new AuthTelemetryBuffer(800);
    this.flowMetadata = new Map();
    this.terminalSummaries = new Map();
  }

  async startAuthFlow(request) {
    const normalized = request && typeof request === "object" ? request : {};
    const targetUrl = String(normalized.targetUrl || normalized.initiatorUrl || "");
    const policy = resolveProviderPolicy(targetUrl);
    const started = this.stateMachine.start({
      providerKey: policy.providerKey,
      sourceTabId: normalized.sourceTabId || ""
    });

    this.flowMetadata.set(started.flowId, {
      correlationId: `corr-${started.flowId}`,
      providerKey: policy.providerKey,
      policy,
      sourceTabId: String(normalized.sourceTabId || ""),
      initiatorUrl: String(normalized.initiatorUrl || ""),
      targetUrl,
      lastObservedUrl: targetUrl,
      sawAuthDomain: this.#isAuthDomainUrl(targetUrl, policy.authHostPatterns),
      incognito: Boolean(normalized.incognito),
      startedAt: started.createdAt,
      externalAuth: null
    });

    const strategy = policy.externalHandoffRequired ? "external-browser" : policy.popupStrategy || "managed-tab";
    const correlationId = this.#getCorrelationId(started.flowId);
    this.telemetry.emit(AUTH_TELEMETRY_EVENTS.AUTH_FLOW_STARTED, {
      flowId: started.flowId,
      correlationId,
      providerKey: policy.providerKey,
      sourceTabId: String(normalized.sourceTabId || ""),
      strategy
    });
    this.telemetry.emit(AUTH_TELEMETRY_EVENTS.ORCHESTRATION_DECISION, {
      flowId: started.flowId,
      correlationId,
      providerKey: policy.providerKey,
      policyAction: strategy,
      embeddedAllowed: policy.embeddedAuthAllowed
    });

    this.#transition(started.flowId, AUTH_FLOW_STATES.ORCHESTRATING, AUTH_FLOW_REASONS.POPUP_INTERCEPTED, {
      strategy
    });
    this.#transition(started.flowId, AUTH_FLOW_STATES.AWAITING_PROVIDER, AUTH_FLOW_REASONS.UNKNOWN, {
      targetUrl
    });

    return {
      flowId: started.flowId,
      providerKey: policy.providerKey,
      startedAt: started.createdAt,
      strategy
    };
  }

  async onPopupIntercepted(flowId, details = {}) {
    const flow = this.stateMachine.getFlow(flowId);
    const correlationId = this.#getCorrelationId(flow.flowId);
    this.telemetry.emit(AUTH_TELEMETRY_EVENTS.POPUP_INTERCEPTED, {
      flowId: flow.flowId,
      correlationId,
      openerUrl: String(details.openerUrl || ""),
      targetUrl: String(details.targetUrl || ""),
      disposition: String(details.disposition || "")
    });
    this.telemetry.emit(AUTH_TELEMETRY_EVENTS.POPUP_ROUTED, {
      flowId: flow.flowId,
      correlationId,
      routeType: String(details.routeType || "managed-tab"),
      tabId: String(details.tabId || "")
    });
  }

  async onRedirectObserved(flowId, url, eventName) {
    const flow = this.stateMachine.getFlow(flowId);
    if (this.#isTerminalFlowState(flow.state)) return;
    const safeUrl = String(url || "");
    const meta = this.flowMetadata.get(flow.flowId) || {};
    const previousUrl = String(meta.lastObservedUrl || meta.targetUrl || "");
    const currentPolicy = meta.policy || resolveProviderPolicy(safeUrl);
    const isAuthDomainUrl = this.#isAuthDomainUrl(safeUrl, currentPolicy.authHostPatterns || []);
    const hasCompletionToken = this.#hasCompletionToken(safeUrl);
    const previouslySawAuthDomain = Boolean(meta.sawAuthDomain);
    const didLeaveAuthDomain = previouslySawAuthDomain && !isAuthDomainUrl && !hasCompletionToken;
    const correlationId = this.#getCorrelationId(flow.flowId);

    this.flowMetadata.set(flow.flowId, {
      ...meta,
      policy: currentPolicy,
      sawAuthDomain: previouslySawAuthDomain || isAuthDomainUrl,
      lastObservedUrl: safeUrl
    });

    this.telemetry.emit(AUTH_TELEMETRY_EVENTS.REDIRECT_OBSERVED, {
      flowId: flow.flowId,
      correlationId,
      url: safeUrl,
      eventName: String(eventName || "did-navigate")
    });

    if (this.#isBlockedEmbeddedUrl(safeUrl)) {
      this.#transition(flow.flowId, AUTH_FLOW_STATES.BLOCKED, AUTH_FLOW_REASONS.PROVIDER_REJECTED_EMBEDDED, {
        url: safeUrl
      });
      this.telemetry.emit(AUTH_TELEMETRY_EVENTS.AUTH_FLOW_BLOCKED, {
        flowId: flow.flowId,
        correlationId,
        providerKey: this.#getProviderKey(flow.flowId),
        reason: AUTH_FLOW_REASONS.PROVIDER_REJECTED_EMBEDDED,
        url: safeUrl
      });
      this.#persistTerminalSummary(flow.flowId, AUTH_FLOW_STATES.BLOCKED, AUTH_FLOW_REASONS.PROVIDER_REJECTED_EMBEDDED, {
        finalUrl: safeUrl
      });
      return;
    }

    this.#transition(flow.flowId, AUTH_FLOW_STATES.REDIRECTING, AUTH_FLOW_REASONS.UNKNOWN, {
      url: safeUrl
    });

    if (hasCompletionToken) {
      this.#transition(flow.flowId, AUTH_FLOW_STATES.TOKEN_RECEIVED, AUTH_FLOW_REASONS.TOKEN_OBSERVED, {
        url: safeUrl
      });
      this.#transition(flow.flowId, AUTH_FLOW_STATES.COMPLETED, AUTH_FLOW_REASONS.TOKEN_OBSERVED, {
        url: safeUrl
      });
      this.telemetry.emit(AUTH_TELEMETRY_EVENTS.AUTH_FLOW_COMPLETED, {
        flowId: flow.flowId,
        correlationId,
        terminalState: AUTH_FLOW_STATES.COMPLETED,
        reason: AUTH_FLOW_REASONS.TOKEN_OBSERVED
      });
      this.#persistTerminalSummary(flow.flowId, AUTH_FLOW_STATES.COMPLETED, AUTH_FLOW_REASONS.TOKEN_OBSERVED, {
        finalUrl: safeUrl
      });
      this.flowMetadata.delete(flow.flowId);
      return;
    }

    if (didLeaveAuthDomain) {
      this.telemetry.emit(AUTH_TELEMETRY_EVENTS.REDIRECT_LEFT_AUTH_DOMAIN, {
        flowId: flow.flowId,
        correlationId,
        url: safeUrl,
        previousHost: this.#toHost(previousUrl),
        nextHost: this.#toHost(safeUrl)
      });
      await this.cancelAuthFlow(flow.flowId, AUTH_FLOW_REASONS.LEFT_AUTH_DOMAIN);
    }
  }

  async prepareExternalAuth(flowId, details = {}) {
    const flow = this.stateMachine.getFlow(flowId);
    if (this.#isTerminalFlowState(flow.state)) {
      throw new Error(`Cannot prepare external auth for terminal flow: ${flowId}`);
    }
    const meta = this.flowMetadata.get(flow.flowId) || {};
    const pkce = createPkcePair();
    const state = String(details.state || createStateToken());
    const redirectUri = String(details.redirectUri || "jusbrowse://auth/callback");
    const tokenEndpoint = String(details.tokenEndpoint || "https://oauth2.googleapis.com/token");
    const clientId = String(details.clientId || "");
    this.flowMetadata.set(flow.flowId, {
      ...meta,
      externalAuth: {
        state,
        pkceVerifier: pkce.verifier,
        pkceChallenge: pkce.challenge,
        codeChallengeMethod: pkce.method,
        redirectUri,
        tokenEndpoint,
        clientId,
        callbackReceivedAt: 0,
        callbackUrl: "",
        callbackCode: ""
      }
    });
    return {
      state,
      pkceVerifier: pkce.verifier,
      pkceChallenge: pkce.challenge,
      codeChallengeMethod: pkce.method,
      redirectUri,
      tokenEndpoint,
      clientId
    };
  }

  async recordExternalAuthLaunch(flowId, details = {}) {
    const flow = this.stateMachine.getFlow(flowId);
    if (this.#isTerminalFlowState(flow.state)) return;
    const launchUrl = String(details.launchUrl || "");
    const redirectUri = String(details.redirectUri || "jusbrowse://auth/callback");
    const correlationId = this.#getCorrelationId(flow.flowId);
    const providerKey = this.#getProviderKey(flow.flowId);
    const meta = this.flowMetadata.get(flow.flowId) || {};
    const externalAuth = meta.externalAuth || {};
    this.flowMetadata.set(flow.flowId, {
      ...meta,
      externalAuth: {
        ...externalAuth,
        launchUrl
      }
    });
    this.telemetry.emit(AUTH_TELEMETRY_EVENTS.ORCHESTRATION_EXTERNAL_HANDOFF, {
      flowId: flow.flowId,
      correlationId,
      providerKey,
      handoffUrl: launchUrl
    });
    this.telemetry.emit(AUTH_TELEMETRY_EVENTS.EXTERNAL_AUTH_LAUNCHED, {
      flowId: flow.flowId,
      correlationId,
      providerKey,
      launchUrl,
      redirectUri
    });
    return {
      flowId: flow.flowId,
      correlationId,
      providerKey,
      launchUrl,
      redirectUri
    };
  }

  async recordExternalLaunchDecision(flowId, details = {}) {
    const flow = this.stateMachine.getFlow(flowId);
    if (this.#isTerminalFlowState(flow.state)) return null;
    const correlationId = this.#getCorrelationId(flow.flowId);
    const providerKey = this.#getProviderKey(flow.flowId);
    const decision = String(details.decision || "external-browser");
    const targetUrl = String(details.targetUrl || "");
    this.telemetry.emit(AUTH_TELEMETRY_EVENTS.EXTERNAL_LAUNCH_DECISION, {
      flowId: flow.flowId,
      correlationId,
      providerKey,
      decision,
      targetUrl
    });
    return {
      flowId: flow.flowId,
      correlationId,
      providerKey,
      decision,
      targetUrl
    };
  }

  async recordExternalNoticeEmitted(flowId, details = {}) {
    const flow = this.stateMachine.getFlow(flowId);
    if (this.#isTerminalFlowState(flow.state)) return null;
    const correlationId = this.#getCorrelationId(flow.flowId);
    const providerKey = this.#getProviderKey(flow.flowId);
    const noticeType = String(details.noticeType || "info");
    const message = String(details.message || "");
    const channel = String(details.channel || "in-app");
    this.telemetry.emit(AUTH_TELEMETRY_EVENTS.EXTERNAL_NOTICE_EMITTED, {
      flowId: flow.flowId,
      correlationId,
      providerKey,
      noticeType,
      message,
      channel
    });
    return {
      flowId: flow.flowId,
      correlationId,
      providerKey,
      noticeType,
      message,
      channel
    };
  }

  async recordExternalLaunchResult(flowId, details = {}) {
    const flow = this.stateMachine.getFlow(flowId);
    if (this.#isTerminalFlowState(flow.state)) return null;
    const correlationId = this.#getCorrelationId(flow.flowId);
    const providerKey = this.#getProviderKey(flow.flowId);
    const launchUrl = String(details.launchUrl || "");
    const success = Boolean(details.success);
    const error = String(details.error || "");
    const terminalReason = String(details.terminalReason || "");
    this.telemetry.emit(AUTH_TELEMETRY_EVENTS.EXTERNAL_LAUNCH_RESULT, {
      flowId: flow.flowId,
      correlationId,
      providerKey,
      launchUrl,
      success,
      error,
      terminalReason
    });
    return {
      flowId: flow.flowId,
      correlationId,
      providerKey,
      launchUrl,
      success,
      error,
      terminalReason
    };
  }

  async onExternalCallbackReceived(flowId, details = {}) {
    const flow = this.stateMachine.getFlow(flowId);
    if (this.#isTerminalFlowState(flow.state)) {
      return {
        ok: false,
        reason: "terminal",
        flowId: flow.flowId,
        correlationId: this.#getCorrelationId(flow.flowId),
        providerKey: this.#getProviderKey(flow.flowId)
      };
    }
    const callbackUrl = String(details.callbackUrl || "");
    const callbackState = String(details.state || "");
    const callbackCode = String(details.code || "");
    const callbackError = String(details.error || "");
    const correlationId = this.#getCorrelationId(flow.flowId);
    const providerKey = this.#getProviderKey(flow.flowId);
    const meta = this.flowMetadata.get(flow.flowId) || {};
    const externalAuth = meta.externalAuth || {};
    const expectedState = String(externalAuth.state || "");
    const stateValid = Boolean(expectedState && callbackState && expectedState === callbackState);
    const hasCode = Boolean(callbackCode);

    this.telemetry.emit(AUTH_TELEMETRY_EVENTS.EXTERNAL_CALLBACK_RECEIVED, {
      flowId: flow.flowId,
      correlationId,
      providerKey,
      callbackUrl,
      hasCode,
      stateValid
    });

    if (callbackError) {
      await this.cancelAuthFlow(flow.flowId, AUTH_FLOW_REASONS.USER_CANCELLED);
      return {
        ok: false,
        reason: AUTH_FLOW_REASONS.USER_CANCELLED,
        flowId: flow.flowId,
        correlationId,
        providerKey
      };
    }

    if (!stateValid || !externalAuth.pkceVerifier) {
      await this.failAuthFlow(flow.flowId, AUTH_FLOW_REASONS.CALLBACK_STATE_MISMATCH);
      return {
        ok: false,
        reason: AUTH_FLOW_REASONS.CALLBACK_STATE_MISMATCH,
        flowId: flow.flowId,
        correlationId,
        providerKey
      };
    }
    if (!hasCode) {
      await this.failAuthFlow(flow.flowId, AUTH_FLOW_REASONS.CALLBACK_MISSING_CODE);
      return {
        ok: false,
        reason: AUTH_FLOW_REASONS.CALLBACK_MISSING_CODE,
        flowId: flow.flowId,
        correlationId,
        providerKey
      };
    }

    this.flowMetadata.set(flow.flowId, {
      ...meta,
      externalAuth: {
        ...externalAuth,
        callbackReceivedAt: Date.now(),
        callbackUrl,
        callbackCode
      }
    });
    this.#transition(flow.flowId, AUTH_FLOW_STATES.REDIRECTING, AUTH_FLOW_REASONS.CALLBACK_RECEIVED, {
      callbackUrl
    });
    return {
      ok: true,
      flowId: flow.flowId,
      correlationId,
      providerKey,
      code: callbackCode,
      state: callbackState,
      redirectUri: String(externalAuth.redirectUri || ""),
      tokenEndpoint: String(externalAuth.tokenEndpoint || ""),
      clientId: String(externalAuth.clientId || ""),
      pkceVerifier: String(externalAuth.pkceVerifier || "")
    };
  }

  async onExternalTokenExchangeResult(flowId, details = {}) {
    const flow = this.stateMachine.getFlow(flowId);
    if (this.#isTerminalFlowState(flow.state)) {
      return;
    }
    const correlationId = this.#getCorrelationId(flow.flowId);
    const providerKey = this.#getProviderKey(flow.flowId);
    const meta = this.flowMetadata.get(flow.flowId) || {};
    const tokenEndpoint = String(details.tokenEndpoint || meta.externalAuth?.tokenEndpoint || "");
    const success = Boolean(details.success);
    const error = String(details.error || "");

    if (success) {
      this.telemetry.emit(AUTH_TELEMETRY_EVENTS.TOKEN_EXCHANGE_SUCCEEDED, {
        flowId: flow.flowId,
        correlationId,
        providerKey,
        tokenEndpoint
      });
      this.#transition(flow.flowId, AUTH_FLOW_STATES.TOKEN_RECEIVED, AUTH_FLOW_REASONS.TOKEN_EXCHANGE_SUCCEEDED, {});
      await this.completeAuthFlow(flow.flowId, AUTH_FLOW_REASONS.TOKEN_EXCHANGE_SUCCEEDED);
      return;
    }

    this.telemetry.emit(AUTH_TELEMETRY_EVENTS.TOKEN_EXCHANGE_FAILED, {
      flowId: flow.flowId,
      correlationId,
      providerKey,
      tokenEndpoint,
      error: error || AUTH_FLOW_REASONS.TOKEN_EXCHANGE_FAILED
    });
    await this.failAuthFlow(flow.flowId, AUTH_FLOW_REASONS.TOKEN_EXCHANGE_FAILED);
  }

  async completeAuthFlow(flowId, reason = AUTH_FLOW_REASONS.UNKNOWN) {
    const flow = this.stateMachine.getFlow(flowId);
    if (this.#isTerminalFlowState(flow.state)) return;
    this.#transition(flow.flowId, AUTH_FLOW_STATES.COMPLETED, reason, {});
    const correlationId = this.#getCorrelationId(flow.flowId);
    this.telemetry.emit(AUTH_TELEMETRY_EVENTS.AUTH_FLOW_COMPLETED, {
      flowId: flow.flowId,
      correlationId,
      terminalState: AUTH_FLOW_STATES.COMPLETED,
      reason
    });
    this.#persistTerminalSummary(flow.flowId, AUTH_FLOW_STATES.COMPLETED, reason, {});
    this.flowMetadata.delete(flow.flowId);
  }

  async cancelAuthFlow(flowId, reason = AUTH_FLOW_REASONS.USER_CANCELLED) {
    const flow = this.stateMachine.getFlow(flowId);
    if (this.#isTerminalFlowState(flow.state)) return;
    this.#transition(flow.flowId, AUTH_FLOW_STATES.CANCELLED, reason, {});
    const correlationId = this.#getCorrelationId(flow.flowId);
    this.telemetry.emit(AUTH_TELEMETRY_EVENTS.AUTH_FLOW_COMPLETED, {
      flowId: flow.flowId,
      correlationId,
      terminalState: AUTH_FLOW_STATES.CANCELLED,
      reason
    });
    this.#persistTerminalSummary(flow.flowId, AUTH_FLOW_STATES.CANCELLED, reason, {});
    this.flowMetadata.delete(flow.flowId);
  }

  async failAuthFlow(flowId, reason = AUTH_FLOW_REASONS.ADAPTER_ERROR) {
    const flow = this.stateMachine.getFlow(flowId);
    if (this.#isTerminalFlowState(flow.state)) return;
    this.#transition(flow.flowId, AUTH_FLOW_STATES.FAILED, reason, {});
    const correlationId = this.#getCorrelationId(flow.flowId);
    this.telemetry.emit(AUTH_TELEMETRY_EVENTS.AUTH_FLOW_COMPLETED, {
      flowId: flow.flowId,
      correlationId,
      terminalState: AUTH_FLOW_STATES.FAILED,
      reason
    });
    this.#persistTerminalSummary(flow.flowId, AUTH_FLOW_STATES.FAILED, reason, {});
    this.flowMetadata.delete(flow.flowId);
  }

  async getAuthDiagnostics(limit = 120) {
    const rawTelemetry = this.telemetry.list(limit);
    const telemetryValidation = this.#validateTelemetry(rawTelemetry);
    const telemetry = rawTelemetry.filter((_, index) => !telemetryValidation.invalidIndexes.has(index));
    const terminalSummaries = Array.from(this.terminalSummaries.values());
    const byFlowId = {};
    for (const summary of terminalSummaries) {
      const flowEvents = telemetry.filter((event) => event.payload.flowId === summary.flowId);
      byFlowId[summary.flowId] = {
        terminalSummary: summary,
        telemetry: flowEvents
      };
    }
    const byTerminalReason = {};
    for (const summary of terminalSummaries) {
      const reason = summary.reason || AUTH_FLOW_REASONS.UNKNOWN;
      if (!byTerminalReason[reason]) {
        byTerminalReason[reason] = [];
      }
      byTerminalReason[reason].push(summary);
    }
    return {
      activeFlows: this.stateMachine.listActiveFlows(),
      telemetry,
      telemetryValidation: {
        totalEvents: rawTelemetry.length,
        validEvents: telemetry.length,
        invalidEvents: telemetryValidation.invalidEvents.length,
        violations: telemetryValidation.invalidEvents
      },
      terminalSummaries,
      groupedDiagnostics: {
        byFlowId,
        byTerminalReason
      }
    };
  }

  getFlowState(flowId) {
    return this.stateMachine.getFlow(flowId).state;
  }

  #transition(flowId, nextState, reason, details) {
    const flow = this.stateMachine.getFlow(flowId);
    const fromState = flow.state;
    const updated = this.stateMachine.transition(flowId, nextState, reason, details);
    this.telemetry.emit(AUTH_TELEMETRY_EVENTS.AUTH_FLOW_STATE_CHANGED, {
      flowId: updated.flowId,
      correlationId: this.#getCorrelationId(updated.flowId),
      fromState,
      toState: nextState,
      reason
    });
    return updated;
  }

  #isBlockedEmbeddedUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.hostname === "accounts.google.com" && parsed.pathname.toLowerCase().includes("/signin/rejected");
    } catch {
      return false;
    }
  }

  #hasCompletionToken(url) {
    try {
      const params = new URL(url).searchParams;
      return AUTH_COMPLETION_QUERY_KEYS.some((key) => params.has(key));
    } catch {
      return false;
    }
  }

  #isTerminalFlowState(state) {
    return TERMINAL_STATES.has(state);
  }

  #toHost(url) {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return "";
    }
  }

  #isAuthDomainUrl(url, authHostPatterns = []) {
    const host = this.#toHost(url);
    if (!host) return false;
    return authHostPatterns.some((pattern) => {
      if (!pattern) return false;
      const normalizedPattern = String(pattern).toLowerCase();
      if (normalizedPattern.includes(".")) {
        return host === normalizedPattern || host.endsWith(`.${normalizedPattern}`);
      }
      return host.includes(normalizedPattern);
    });
  }

  #getProviderKey(flowId) {
    return this.flowMetadata.get(flowId)?.providerKey || "unknown";
  }

  #getCorrelationId(flowId) {
    return this.flowMetadata.get(flowId)?.correlationId || `corr-${flowId}`;
  }

  #persistTerminalSummary(flowId, terminalState, reason, details = {}) {
    const flow = this.stateMachine.getFlow(flowId);
    const meta = this.flowMetadata.get(flowId) || {};
    const policy = meta.policy || {};
    const finalUrl = String(details.finalUrl || meta.lastObservedUrl || meta.targetUrl || "");
    this.terminalSummaries.set(flowId, {
      flowId,
      correlationId: this.#getCorrelationId(flowId),
      terminalState,
      reason: String(reason || AUTH_FLOW_REASONS.UNKNOWN),
      providerKey: String(meta.providerKey || flow.providerKey || "unknown"),
      providerMetadata: {
        reasonCode: String(policy.reasonCode || ""),
        embeddedAuthAllowed: Boolean(policy.embeddedAuthAllowed),
        popupStrategy: String(policy.popupStrategy || ""),
        externalHandoffRequired: Boolean(policy.externalHandoffRequired)
      },
      sourceTabId: String(meta.sourceTabId || flow.sourceTabId || ""),
      initiatorUrl: String(meta.initiatorUrl || ""),
      targetUrl: String(meta.targetUrl || ""),
      finalUrl,
      startedAt: Number(meta.startedAt || flow.createdAt || 0),
      updatedAt: Number(flow.updatedAt || Date.now()),
      completedAt: Number(flow.completedAt || Date.now())
    });
  }

  #validateTelemetry(events = []) {
    const invalidEvents = [];
    const invalidIndexes = new Set();
    events.forEach((event, index) => {
      const eventName = String(event?.eventName || "");
      const payload = event?.payload && typeof event.payload === "object" ? event.payload : {};
      const validation = validateTelemetryEvent(eventName, payload);
      if (!validation.ok) {
        invalidIndexes.add(index);
        invalidEvents.push({
          index,
          eventName,
          missing: validation.missing || [],
          error: validation.error || ""
        });
      }
    });
    return { invalidEvents, invalidIndexes };
  }
}

module.exports = {
  PathAAuthBroker
};
