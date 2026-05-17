const { AUTH_FLOW_STATES, AUTH_FLOW_REASONS, TERMINAL_STATES } = require("./AuthFlowReasons");

const VALID_TRANSITIONS = Object.freeze({
  [AUTH_FLOW_STATES.IDLE]: new Set([AUTH_FLOW_STATES.STARTED]),
  [AUTH_FLOW_STATES.STARTED]: new Set([AUTH_FLOW_STATES.ORCHESTRATING, AUTH_FLOW_STATES.CANCELLED]),
  [AUTH_FLOW_STATES.ORCHESTRATING]: new Set([
    AUTH_FLOW_STATES.AWAITING_PROVIDER,
    AUTH_FLOW_STATES.REDIRECTING,
    AUTH_FLOW_STATES.BLOCKED,
    AUTH_FLOW_STATES.FAILED
  ]),
  [AUTH_FLOW_STATES.AWAITING_PROVIDER]: new Set([
    AUTH_FLOW_STATES.REDIRECTING,
    AUTH_FLOW_STATES.BLOCKED,
    AUTH_FLOW_STATES.CANCELLED,
    AUTH_FLOW_STATES.FAILED
  ]),
  [AUTH_FLOW_STATES.REDIRECTING]: new Set([
    AUTH_FLOW_STATES.AWAITING_PROVIDER,
    AUTH_FLOW_STATES.REDIRECTING,
    AUTH_FLOW_STATES.TOKEN_RECEIVED,
    AUTH_FLOW_STATES.BLOCKED,
    AUTH_FLOW_STATES.CANCELLED,
    AUTH_FLOW_STATES.FAILED
  ]),
  [AUTH_FLOW_STATES.TOKEN_RECEIVED]: new Set([AUTH_FLOW_STATES.COMPLETED, AUTH_FLOW_STATES.FAILED]),
  [AUTH_FLOW_STATES.COMPLETED]: new Set(),
  [AUTH_FLOW_STATES.CANCELLED]: new Set(),
  [AUTH_FLOW_STATES.FAILED]: new Set(),
  [AUTH_FLOW_STATES.BLOCKED]: new Set()
});

class AuthFlowStateMachine {
  constructor() {
    this.flows = new Map();
  }

  createFlowId() {
    return `patha-auth-flow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  assertTransition(currentState, nextState) {
    const allowed = VALID_TRANSITIONS[currentState];
    if (!allowed || !allowed.has(nextState)) {
      throw new Error(`Invalid auth transition: ${currentState} -> ${nextState}`);
    }
  }

  start(context) {
    const flowId = this.createFlowId();
    const now = Date.now();
    const entry = {
      flowId,
      providerKey: String(context?.providerKey || "unknown"),
      sourceTabId: String(context?.sourceTabId || ""),
      state: AUTH_FLOW_STATES.STARTED,
      reason: AUTH_FLOW_REASONS.USER_INITIATED,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      transitionLog: [
        {
          at: now,
          from: AUTH_FLOW_STATES.IDLE,
          to: AUTH_FLOW_STATES.STARTED,
          reason: AUTH_FLOW_REASONS.USER_INITIATED
        }
      ]
    };
    this.flows.set(flowId, entry);
    return entry;
  }

  transition(flowId, nextState, reason, details = {}) {
    const flow = this.getFlow(flowId);
    this.assertTransition(flow.state, nextState);
    const now = Date.now();
    flow.transitionLog.push({
      at: now,
      from: flow.state,
      to: nextState,
      reason: reason || AUTH_FLOW_REASONS.UNKNOWN,
      details
    });
    flow.state = nextState;
    flow.reason = reason || AUTH_FLOW_REASONS.UNKNOWN;
    flow.updatedAt = now;
    if (TERMINAL_STATES.has(nextState)) {
      flow.completedAt = now;
    }
    return flow;
  }

  markOrchestrating(flowId, details = {}) {
    return this.transition(flowId, AUTH_FLOW_STATES.ORCHESTRATING, AUTH_FLOW_REASONS.POPUP_INTERCEPTED, details);
  }

  markAwaitingProvider(flowId, details = {}) {
    return this.transition(flowId, AUTH_FLOW_STATES.AWAITING_PROVIDER, AUTH_FLOW_REASONS.UNKNOWN, details);
  }

  markRedirectObserved(flowId, details = {}) {
    return this.transition(flowId, AUTH_FLOW_STATES.REDIRECTING, AUTH_FLOW_REASONS.UNKNOWN, details);
  }

  markTokenObserved(flowId, details = {}) {
    return this.transition(flowId, AUTH_FLOW_STATES.TOKEN_RECEIVED, AUTH_FLOW_REASONS.TOKEN_OBSERVED, details);
  }

  complete(flowId, details = {}) {
    return this.transition(flowId, AUTH_FLOW_STATES.COMPLETED, AUTH_FLOW_REASONS.TOKEN_OBSERVED, details);
  }

  cancel(flowId, reason = AUTH_FLOW_REASONS.USER_CANCELLED, details = {}) {
    return this.transition(flowId, AUTH_FLOW_STATES.CANCELLED, reason, details);
  }

  fail(flowId, reason = AUTH_FLOW_REASONS.ADAPTER_ERROR, details = {}) {
    return this.transition(flowId, AUTH_FLOW_STATES.FAILED, reason, details);
  }

  block(flowId, reason = AUTH_FLOW_REASONS.POLICY_BLOCKED, details = {}) {
    return this.transition(flowId, AUTH_FLOW_STATES.BLOCKED, reason, details);
  }

  getFlow(flowId) {
    const flow = this.flows.get(flowId);
    if (!flow) {
      throw new Error(`Unknown auth flow: ${flowId}`);
    }
    return flow;
  }

  listActiveFlows() {
    return Array.from(this.flows.values()).filter((flow) => !TERMINAL_STATES.has(flow.state));
  }
}

module.exports = {
  AuthFlowStateMachine,
  VALID_TRANSITIONS
};
