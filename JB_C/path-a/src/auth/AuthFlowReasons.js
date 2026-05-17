const AUTH_FLOW_STATES = Object.freeze({
  IDLE: "idle",
  STARTED: "started",
  ORCHESTRATING: "orchestrating",
  AWAITING_PROVIDER: "awaiting-provider",
  REDIRECTING: "redirecting",
  TOKEN_RECEIVED: "token-received",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  FAILED: "failed",
  BLOCKED: "blocked"
});

const AUTH_FLOW_REASONS = Object.freeze({
  USER_INITIATED: "user-initiated",
  POPUP_INTERCEPTED: "popup-intercepted",
  EXTERNAL_LAUNCH: "external-launch",
  CALLBACK_RECEIVED: "callback-received",
  CALLBACK_STATE_MISMATCH: "callback-state-mismatch",
  CALLBACK_MISSING_CODE: "callback-missing-code",
  TOKEN_EXCHANGE_SUCCEEDED: "token-exchange-succeeded",
  TOKEN_EXCHANGE_FAILED: "token-exchange-failed",
  PROVIDER_REJECTED_EMBEDDED: "provider-rejected-embedded",
  LEFT_AUTH_DOMAIN: "left-auth-domain",
  TOKEN_OBSERVED: "token-observed",
  REDIRECT_TIMEOUT: "redirect-timeout",
  WINDOW_CLOSED: "window-closed",
  TAB_CLOSED: "tab-closed",
  USER_CANCELLED: "user-cancelled",
  PROVIDER_ERROR: "provider-error",
  NETWORK_ERROR: "network-error",
  ADAPTER_ERROR: "adapter-error",
  POLICY_BLOCKED: "policy-blocked",
  UNKNOWN: "unknown"
});

const TERMINAL_STATES = new Set([
  AUTH_FLOW_STATES.COMPLETED,
  AUTH_FLOW_STATES.CANCELLED,
  AUTH_FLOW_STATES.FAILED,
  AUTH_FLOW_STATES.BLOCKED
]);

module.exports = {
  AUTH_FLOW_STATES,
  AUTH_FLOW_REASONS,
  TERMINAL_STATES
};
