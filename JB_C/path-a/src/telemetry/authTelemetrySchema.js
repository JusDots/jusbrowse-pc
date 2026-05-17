const AUTH_TELEMETRY_EVENTS = Object.freeze({
  AUTH_FLOW_STARTED: "auth.flow.started",
  AUTH_FLOW_STATE_CHANGED: "auth.flow.state.changed",
  AUTH_FLOW_COMPLETED: "auth.flow.completed",
  AUTH_FLOW_BLOCKED: "auth.flow.blocked",
  REDIRECT_OBSERVED: "auth.redirect.observed",
  REDIRECT_LEFT_AUTH_DOMAIN: "auth.redirect.left-auth-domain",
  POPUP_INTERCEPTED: "auth.popup.intercepted",
  POPUP_ROUTED: "auth.popup.routed",
  ORCHESTRATION_DECISION: "auth.orchestration.decision",
  ORCHESTRATION_EXTERNAL_HANDOFF: "auth.orchestration.external-handoff",
  EXTERNAL_LAUNCH_DECISION: "auth.external.launch.decision",
  EXTERNAL_AUTH_LAUNCHED: "auth.external.launch",
  EXTERNAL_LAUNCH_RESULT: "auth.external.launch.result",
  EXTERNAL_NOTICE_EMITTED: "auth.external.notice.emitted",
  EXTERNAL_CALLBACK_RECEIVED: "auth.callback.received",
  TOKEN_EXCHANGE_SUCCEEDED: "auth.token.exchange.succeeded",
  TOKEN_EXCHANGE_FAILED: "auth.token.exchange.failed"
});

const AUTH_TELEMETRY_SCHEMA = Object.freeze({
  [AUTH_TELEMETRY_EVENTS.AUTH_FLOW_STARTED]: ["flowId", "correlationId", "providerKey", "sourceTabId", "strategy"],
  [AUTH_TELEMETRY_EVENTS.AUTH_FLOW_STATE_CHANGED]: ["flowId", "correlationId", "fromState", "toState", "reason"],
  [AUTH_TELEMETRY_EVENTS.AUTH_FLOW_COMPLETED]: ["flowId", "correlationId", "terminalState", "reason"],
  [AUTH_TELEMETRY_EVENTS.AUTH_FLOW_BLOCKED]: ["flowId", "correlationId", "providerKey", "reason", "url"],
  [AUTH_TELEMETRY_EVENTS.REDIRECT_OBSERVED]: ["flowId", "correlationId", "url", "eventName"],
  [AUTH_TELEMETRY_EVENTS.REDIRECT_LEFT_AUTH_DOMAIN]: ["flowId", "correlationId", "url", "previousHost", "nextHost"],
  [AUTH_TELEMETRY_EVENTS.POPUP_INTERCEPTED]: ["flowId", "correlationId", "openerUrl", "targetUrl", "disposition"],
  [AUTH_TELEMETRY_EVENTS.POPUP_ROUTED]: ["flowId", "correlationId", "routeType", "tabId"],
  [AUTH_TELEMETRY_EVENTS.ORCHESTRATION_DECISION]: ["flowId", "correlationId", "providerKey", "policyAction", "embeddedAllowed"],
  [AUTH_TELEMETRY_EVENTS.ORCHESTRATION_EXTERNAL_HANDOFF]: ["flowId", "correlationId", "providerKey", "handoffUrl"],
  [AUTH_TELEMETRY_EVENTS.EXTERNAL_LAUNCH_DECISION]: ["flowId", "correlationId", "providerKey", "decision", "targetUrl"],
  [AUTH_TELEMETRY_EVENTS.EXTERNAL_AUTH_LAUNCHED]: ["flowId", "correlationId", "providerKey", "launchUrl", "redirectUri"],
  [AUTH_TELEMETRY_EVENTS.EXTERNAL_LAUNCH_RESULT]: [
    "flowId",
    "correlationId",
    "providerKey",
    "launchUrl",
    "success",
    "error",
    "terminalReason"
  ],
  [AUTH_TELEMETRY_EVENTS.EXTERNAL_NOTICE_EMITTED]: [
    "flowId",
    "correlationId",
    "providerKey",
    "noticeType",
    "message",
    "channel"
  ],
  [AUTH_TELEMETRY_EVENTS.EXTERNAL_CALLBACK_RECEIVED]: ["flowId", "correlationId", "providerKey", "callbackUrl", "hasCode", "stateValid"],
  [AUTH_TELEMETRY_EVENTS.TOKEN_EXCHANGE_SUCCEEDED]: ["flowId", "correlationId", "providerKey", "tokenEndpoint"],
  [AUTH_TELEMETRY_EVENTS.TOKEN_EXCHANGE_FAILED]: ["flowId", "correlationId", "providerKey", "tokenEndpoint", "error"]
});

function validateTelemetryEvent(eventName, payload) {
  const requiredFields = AUTH_TELEMETRY_SCHEMA[eventName];
  if (!requiredFields) {
    return {
      ok: false,
      error: `Unknown telemetry event: ${eventName}`
    };
  }

  const safePayload = payload && typeof payload === "object" ? payload : {};
  const missing = requiredFields.filter((field) => safePayload[field] == null);

  return {
    ok: missing.length === 0,
    missing,
    eventName
  };
}

function buildTelemetryEvent(eventName, payload) {
  const validation = validateTelemetryEvent(eventName, payload);
  if (!validation.ok) {
    throw new Error(
      `Invalid telemetry payload for ${eventName}. Missing: ${validation.missing.join(", ")}`
    );
  }

  return {
    eventName,
    at: Date.now(),
    payload: { ...payload }
  };
}

module.exports = {
  AUTH_TELEMETRY_EVENTS,
  AUTH_TELEMETRY_SCHEMA,
  validateTelemetryEvent,
  buildTelemetryEvent
};
