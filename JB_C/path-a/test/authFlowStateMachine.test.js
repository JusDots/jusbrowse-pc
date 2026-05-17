const test = require("node:test");
const assert = require("node:assert/strict");

const { AuthFlowStateMachine } = require("../src/auth/AuthFlowStateMachine");
const { AUTH_FLOW_STATES, AUTH_FLOW_REASONS } = require("../src/auth/AuthFlowReasons");

test("AuthFlowStateMachine allows valid transition chain", () => {
  const machine = new AuthFlowStateMachine();
  const started = machine.start({ providerKey: "google-family", sourceTabId: "tab-1" });

  machine.transition(started.flowId, AUTH_FLOW_STATES.ORCHESTRATING, AUTH_FLOW_REASONS.POPUP_INTERCEPTED);
  machine.transition(started.flowId, AUTH_FLOW_STATES.AWAITING_PROVIDER, AUTH_FLOW_REASONS.UNKNOWN);
  machine.transition(started.flowId, AUTH_FLOW_STATES.REDIRECTING, AUTH_FLOW_REASONS.UNKNOWN);
  machine.transition(started.flowId, AUTH_FLOW_STATES.TOKEN_RECEIVED, AUTH_FLOW_REASONS.TOKEN_OBSERVED);
  const completed = machine.transition(started.flowId, AUTH_FLOW_STATES.COMPLETED, AUTH_FLOW_REASONS.TOKEN_OBSERVED);

  assert.equal(completed.state, AUTH_FLOW_STATES.COMPLETED);
  assert.equal(completed.reason, AUTH_FLOW_REASONS.TOKEN_OBSERVED);
  assert.ok(Number.isFinite(completed.completedAt));
});

test("AuthFlowStateMachine rejects invalid transition", () => {
  const machine = new AuthFlowStateMachine();
  const started = machine.start({ providerKey: "unknown", sourceTabId: "tab-2" });

  assert.throws(
    () => machine.transition(started.flowId, AUTH_FLOW_STATES.COMPLETED, AUTH_FLOW_REASONS.UNKNOWN),
    /Invalid auth transition/
  );
});

test("AuthFlowStateMachine allows redirecting to return to awaiting-provider", () => {
  const machine = new AuthFlowStateMachine();
  const started = machine.start({ providerKey: "google-family", sourceTabId: "tab-3" });

  machine.transition(started.flowId, AUTH_FLOW_STATES.ORCHESTRATING, AUTH_FLOW_REASONS.POPUP_INTERCEPTED);
  machine.transition(started.flowId, AUTH_FLOW_STATES.AWAITING_PROVIDER, AUTH_FLOW_REASONS.UNKNOWN);
  machine.transition(started.flowId, AUTH_FLOW_STATES.REDIRECTING, AUTH_FLOW_REASONS.UNKNOWN);
  const resumed = machine.transition(started.flowId, AUTH_FLOW_STATES.AWAITING_PROVIDER, AUTH_FLOW_REASONS.UNKNOWN);

  assert.equal(resumed.state, AUTH_FLOW_STATES.AWAITING_PROVIDER);
});
