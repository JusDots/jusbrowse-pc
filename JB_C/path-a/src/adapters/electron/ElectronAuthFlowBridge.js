const { PathAAuthBroker } = require("../../auth/PathAAuthBroker");
const { AUTH_FLOW_REASONS, TERMINAL_STATES } = require("../../auth/AuthFlowReasons");

/**
 * Bridges legacy Electron auth flow events into Path A domain modules.
 * This adapter is designed for dual-run migration: it should not alter
 * existing orchestration behavior while Path A parity is being validated.
 */
class ElectronAuthFlowBridge {
  constructor(options = {}) {
    this.broker = options.broker || new PathAAuthBroker();
    this.mappingTtlMs = Math.max(30_000, Number(options.mappingTtlMs) || 8 * 60 * 1000);
    this.legacyToPathAFlow = new Map();
    this.gcInterval = Math.max(15_000, Math.min(this.mappingTtlMs, 60_000));
    this.gcTimer = setInterval(() => {
      this.#pruneStaleMappings();
    }, this.gcInterval);
    if (typeof this.gcTimer.unref === "function") {
      this.gcTimer.unref();
    }
  }

  async onLegacyPopupIntercepted(payload = {}) {
    this.#pruneStaleMappings();
    const started = await this.broker.startAuthFlow({
      providerKey: "unknown",
      sourceTabId: String(payload.sourceTabId || ""),
      initiatorUrl: String(payload.openerUrl || ""),
      targetUrl: String(payload.targetUrl || ""),
      incognito: Boolean(payload.incognito)
    });

    const legacyFlowId = String(payload.legacyFlowId || "");
    if (legacyFlowId) {
      this.legacyToPathAFlow.set(legacyFlowId, {
        flowId: started.flowId,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }

    await this.broker.onPopupIntercepted(started.flowId, {
      openerUrl: String(payload.openerUrl || ""),
      targetUrl: String(payload.targetUrl || ""),
      disposition: String(payload.disposition || ""),
      tabId: String(payload.tabId || ""),
      routeType: String(payload.routeType || "managed-tab")
    });

    return started.flowId;
  }

  async onLegacyNavigationEvent(payload = {}) {
    this.#pruneStaleMappings();
    const flowId = this.#resolvePathAFlowId(payload.legacyFlowId);
    if (!flowId) return null;
    await this.broker.onRedirectObserved(flowId, String(payload.url || ""), String(payload.eventName || ""));
    this.#markMappingActivity(payload.legacyFlowId);
    if (TERMINAL_STATES.has(this.broker.getFlowState(flowId))) {
      this.#cleanup(payload.legacyFlowId);
    }
    return flowId;
  }

  async onLegacyFlowCompleted(payload = {}) {
    this.#pruneStaleMappings();
    const flowId = this.#resolvePathAFlowId(payload.legacyFlowId);
    if (!flowId) return null;
    await this.broker.completeAuthFlow(flowId, String(payload.reason || AUTH_FLOW_REASONS.UNKNOWN));
    this.#cleanup(payload.legacyFlowId);
    return flowId;
  }

  async onLegacyFlowCancelled(payload = {}) {
    this.#pruneStaleMappings();
    const flowId = this.#resolvePathAFlowId(payload.legacyFlowId);
    if (!flowId) return null;
    await this.broker.cancelAuthFlow(flowId, String(payload.reason || AUTH_FLOW_REASONS.TAB_CLOSED));
    this.#cleanup(payload.legacyFlowId);
    return flowId;
  }

  async onLegacyFlowFailed(payload = {}) {
    this.#pruneStaleMappings();
    const flowId = this.#resolvePathAFlowId(payload.legacyFlowId);
    if (!flowId) return null;
    await this.broker.failAuthFlow(flowId, String(payload.reason || AUTH_FLOW_REASONS.ADAPTER_ERROR));
    this.#cleanup(payload.legacyFlowId);
    return flowId;
  }

  async awaitPathAFlowId(legacyFlowId, timeoutMs = 5_000) {
    this.#pruneStaleMappings();
    const startedAt = Date.now();
    while (Date.now() - startedAt <= Math.max(100, Number(timeoutMs) || 5_000)) {
      const flowId = this.#resolvePathAFlowId(legacyFlowId);
      if (flowId) return flowId;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    return null;
  }

  async prepareLegacyExternalAuth(payload = {}) {
    const flowId = await this.awaitPathAFlowId(payload.legacyFlowId, payload.timeoutMs);
    if (!flowId) return null;
    return this.broker.prepareExternalAuth(flowId, payload);
  }

  async onLegacyExternalCallback(payload = {}) {
    const flowId = await this.awaitPathAFlowId(payload.legacyFlowId, payload.timeoutMs);
    if (!flowId) return null;
    this.#markMappingActivity(payload.legacyFlowId);
    return this.broker.onExternalCallbackReceived(flowId, payload);
  }

  async onLegacyExternalAuthLaunch(payload = {}) {
    const flowId = await this.awaitPathAFlowId(payload.legacyFlowId, payload.timeoutMs);
    if (!flowId) return null;
    this.#markMappingActivity(payload.legacyFlowId);
    return this.broker.recordExternalAuthLaunch(flowId, payload);
  }

  async onLegacyExternalLaunchDecision(payload = {}) {
    const flowId = await this.awaitPathAFlowId(payload.legacyFlowId, payload.timeoutMs);
    if (!flowId) return null;
    this.#markMappingActivity(payload.legacyFlowId);
    return this.broker.recordExternalLaunchDecision(flowId, payload);
  }

  async onLegacyExternalNoticeEmitted(payload = {}) {
    const flowId = await this.awaitPathAFlowId(payload.legacyFlowId, payload.timeoutMs);
    if (!flowId) return null;
    this.#markMappingActivity(payload.legacyFlowId);
    return this.broker.recordExternalNoticeEmitted(flowId, payload);
  }

  async onLegacyExternalLaunchResult(payload = {}) {
    const flowId = await this.awaitPathAFlowId(payload.legacyFlowId, payload.timeoutMs);
    if (!flowId) return null;
    this.#markMappingActivity(payload.legacyFlowId);
    return this.broker.recordExternalLaunchResult(flowId, payload);
  }

  async onLegacyExternalTokenExchange(payload = {}) {
    const flowId = await this.awaitPathAFlowId(payload.legacyFlowId, payload.timeoutMs);
    if (!flowId) return null;
    this.#markMappingActivity(payload.legacyFlowId);
    return this.broker.onExternalTokenExchangeResult(flowId, payload);
  }

  async getDiagnostics(limit = 120) {
    return this.broker.getAuthDiagnostics(limit);
  }

  #resolvePathAFlowId(legacyFlowId) {
    const key = String(legacyFlowId || "");
    if (!key) return null;
    const mapping = this.legacyToPathAFlow.get(key);
    if (!mapping) return null;
    const isExpired = Date.now() - Number(mapping.updatedAt || mapping.createdAt || 0) > this.mappingTtlMs;
    if (isExpired) {
      this.legacyToPathAFlow.delete(key);
      return null;
    }
    return mapping.flowId || null;
  }

  #markMappingActivity(legacyFlowId) {
    const key = String(legacyFlowId || "");
    if (!key) return;
    const mapping = this.legacyToPathAFlow.get(key);
    if (!mapping) return;
    mapping.updatedAt = Date.now();
    this.legacyToPathAFlow.set(key, mapping);
  }

  #pruneStaleMappings() {
    if (!this.legacyToPathAFlow.size) return;
    const now = Date.now();
    for (const [legacyFlowId, mapping] of this.legacyToPathAFlow.entries()) {
      const touchedAt = Number(mapping.updatedAt || mapping.createdAt || 0);
      if (!touchedAt || now - touchedAt > this.mappingTtlMs) {
        this.legacyToPathAFlow.delete(legacyFlowId);
      }
    }
  }

  #cleanup(legacyFlowId) {
    const key = String(legacyFlowId || "");
    if (!key) return;
    this.legacyToPathAFlow.delete(key);
  }
}

module.exports = {
  ElectronAuthFlowBridge
};
