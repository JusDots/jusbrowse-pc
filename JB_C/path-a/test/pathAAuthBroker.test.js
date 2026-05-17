const test = require("node:test");
const assert = require("node:assert/strict");

const { PathAAuthBroker } = require("../src/auth/PathAAuthBroker");
const { AUTH_FLOW_REASONS, AUTH_FLOW_STATES } = require("../src/auth/AuthFlowReasons");

test("PathAAuthBroker transitions blocked flow and ignores later terminal mutations", async () => {
  const broker = new PathAAuthBroker();
  const started = await broker.startAuthFlow({
    sourceTabId: "tab-1",
    initiatorUrl: "https://www.google.com",
    targetUrl: "https://accounts.google.com/signin/v2/identifier"
  });

  await broker.onRedirectObserved(
    started.flowId,
    "https://accounts.google.com/signin/rejected?flowName=GlifWebSignIn",
    "did-navigate"
  );

  assert.equal(broker.getFlowState(started.flowId), AUTH_FLOW_STATES.BLOCKED);

  await broker.failAuthFlow(started.flowId, AUTH_FLOW_REASONS.NETWORK_ERROR);
  await broker.cancelAuthFlow(started.flowId, AUTH_FLOW_REASONS.TAB_CLOSED);
  await broker.completeAuthFlow(started.flowId, AUTH_FLOW_REASONS.TOKEN_OBSERVED);

  assert.equal(broker.getFlowState(started.flowId), AUTH_FLOW_STATES.BLOCKED);
  const diagnostics = await broker.getAuthDiagnostics(200);
  assert.equal(diagnostics.telemetryValidation.invalidEvents, 0);
  const summary = diagnostics.groupedDiagnostics.byFlowId[started.flowId].terminalSummary;
  assert.equal(summary.terminalState, AUTH_FLOW_STATES.BLOCKED);
  assert.equal(summary.reason, AUTH_FLOW_REASONS.PROVIDER_REJECTED_EMBEDDED);
  assert.equal(summary.providerKey, "google-family");
  assert.match(summary.correlationId, /^corr-patha-auth-flow-/);
  assert.equal(
    diagnostics.groupedDiagnostics.byTerminalReason[AUTH_FLOW_REASONS.PROVIDER_REJECTED_EMBEDDED].length,
    1
  );
});

test("PathAAuthBroker completes token-observed flow and ignores post-completion cancellation", async () => {
  const broker = new PathAAuthBroker();
  const started = await broker.startAuthFlow({
    sourceTabId: "tab-2",
    initiatorUrl: "https://example.com/login",
    targetUrl: "https://accounts.google.com/o/oauth2/v2/auth"
  });

  await broker.onRedirectObserved(started.flowId, "https://accounts.google.com/o/oauth2/v2/auth?prompt=select_account");
  await broker.onRedirectObserved(started.flowId, "https://example.com/auth/callback?code=test-code-123");

  assert.equal(broker.getFlowState(started.flowId), AUTH_FLOW_STATES.COMPLETED);

  await broker.cancelAuthFlow(started.flowId, AUTH_FLOW_REASONS.LEFT_AUTH_DOMAIN);
  await broker.failAuthFlow(started.flowId, AUTH_FLOW_REASONS.NETWORK_ERROR);

  assert.equal(broker.getFlowState(started.flowId), AUTH_FLOW_STATES.COMPLETED);
  const diagnostics = await broker.getAuthDiagnostics(200);
  assert.equal(diagnostics.telemetryValidation.invalidEvents, 0);
  const completionEvent = diagnostics.telemetry.find(
    (entry) =>
      entry.eventName === "auth.flow.completed" &&
      entry.payload.flowId === started.flowId &&
      entry.payload.reason === AUTH_FLOW_REASONS.TOKEN_OBSERVED
  );
  assert.ok(completionEvent);
  assert.match(completionEvent.payload.correlationId, /^corr-patha-auth-flow-/);
});

test("PathAAuthBroker cancels microsoft-family flow after leaving auth domain without token", async () => {
  const broker = new PathAAuthBroker();
  const started = await broker.startAuthFlow({
    sourceTabId: "tab-msft-1",
    initiatorUrl: "https://app.example.com/account",
    targetUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
  });

  await broker.onRedirectObserved(
    started.flowId,
    "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?prompt=select_account",
    "did-redirect-navigation"
  );
  await broker.onRedirectObserved(started.flowId, "https://app.example.com/oauth/callback", "did-navigate");

  assert.equal(broker.getFlowState(started.flowId), AUTH_FLOW_STATES.CANCELLED);
  const diagnostics = await broker.getAuthDiagnostics(200);
  assert.equal(diagnostics.telemetryValidation.invalidEvents, 0);
  const summary = diagnostics.groupedDiagnostics.byFlowId[started.flowId].terminalSummary;
  assert.equal(summary.reason, AUTH_FLOW_REASONS.LEFT_AUTH_DOMAIN);
  assert.equal(summary.providerKey, "microsoft-family");
  assert.equal(summary.finalUrl, "https://app.example.com/oauth/callback");
});

test("PathAAuthBroker does not cancel unknown provider when auth domain was never observed", async () => {
  const broker = new PathAAuthBroker();
  const started = await broker.startAuthFlow({
    sourceTabId: "tab-edge-1",
    initiatorUrl: "https://portal.example.com",
    targetUrl: "https://portal.example.com/session/start"
  });

  await broker.onRedirectObserved(started.flowId, "https://id.example.net/continue", "did-navigate");
  assert.equal(broker.getFlowState(started.flowId), AUTH_FLOW_STATES.REDIRECTING);
});

test("PathAAuthBroker records external launch for google-family flow", async () => {
  const broker = new PathAAuthBroker();
  const started = await broker.startAuthFlow({
    sourceTabId: "tab-google-launch",
    initiatorUrl: "https://mail.google.com",
    targetUrl: "https://accounts.google.com/o/oauth2/v2/auth"
  });
  const prepared = await broker.prepareExternalAuth(started.flowId, {
    redirectUri: "jusbrowse://auth/callback",
    clientId: "client-123"
  });
  const launchUrl = `https://accounts.google.com/o/oauth2/v2/auth?state=${prepared.state}`;
  await broker.recordExternalAuthLaunch(started.flowId, {
    launchUrl,
    redirectUri: prepared.redirectUri
  });

  const diagnostics = await broker.getAuthDiagnostics(300);
  assert.equal(diagnostics.telemetryValidation.invalidEvents, 0);
  const flowEvents = diagnostics.telemetry.filter((entry) => entry.payload.flowId === started.flowId);
  assert.ok(flowEvents.some((entry) => entry.eventName === "auth.external.launch"));
  assert.ok(flowEvents.some((entry) => entry.eventName === "auth.orchestration.external-handoff"));
});

test("PathAAuthBroker rejects callback state mismatch before token exchange", async () => {
  const broker = new PathAAuthBroker();
  const started = await broker.startAuthFlow({
    sourceTabId: "tab-google-state",
    initiatorUrl: "https://mail.google.com",
    targetUrl: "https://accounts.google.com/o/oauth2/v2/auth"
  });
  const prepared = await broker.prepareExternalAuth(started.flowId, {
    redirectUri: "jusbrowse://auth/callback",
    clientId: "client-123"
  });
  const result = await broker.onExternalCallbackReceived(started.flowId, {
    callbackUrl: "jusbrowse://auth/callback?state=bad-state&code=abc",
    state: "bad-state",
    code: "abc"
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, AUTH_FLOW_REASONS.CALLBACK_STATE_MISMATCH);
  assert.notEqual(prepared.state, "bad-state");
  assert.equal(broker.getFlowState(started.flowId), AUTH_FLOW_STATES.FAILED);
});

test("PathAAuthBroker completes successful external token exchange", async () => {
  const broker = new PathAAuthBroker();
  const started = await broker.startAuthFlow({
    sourceTabId: "tab-google-success",
    initiatorUrl: "https://mail.google.com",
    targetUrl: "https://accounts.google.com/o/oauth2/v2/auth"
  });
  const prepared = await broker.prepareExternalAuth(started.flowId, {
    redirectUri: "jusbrowse://auth/callback",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    clientId: "client-123"
  });
  const callback = await broker.onExternalCallbackReceived(started.flowId, {
    callbackUrl: `jusbrowse://auth/callback?state=${prepared.state}&code=auth-code-1`,
    state: prepared.state,
    code: "auth-code-1"
  });
  assert.equal(callback.ok, true);
  assert.ok(callback.pkceVerifier);

  await broker.onExternalTokenExchangeResult(started.flowId, {
    success: true,
    tokenEndpoint: "https://oauth2.googleapis.com/token"
  });

  assert.equal(broker.getFlowState(started.flowId), AUTH_FLOW_STATES.COMPLETED);
  const diagnostics = await broker.getAuthDiagnostics(300);
  assert.equal(diagnostics.telemetryValidation.invalidEvents, 0);
  const completion = diagnostics.groupedDiagnostics.byFlowId[started.flowId].terminalSummary;
  assert.equal(completion.reason, AUTH_FLOW_REASONS.TOKEN_EXCHANGE_SUCCEEDED);
});

test("PathAAuthBroker marks cancellation/failure paths for external callbacks", async () => {
  const broker = new PathAAuthBroker();
  const cancelled = await broker.startAuthFlow({
    sourceTabId: "tab-google-cancel",
    initiatorUrl: "https://mail.google.com",
    targetUrl: "https://accounts.google.com/o/oauth2/v2/auth"
  });
  const cancelledPrepared = await broker.prepareExternalAuth(cancelled.flowId, {
    redirectUri: "jusbrowse://auth/callback",
    clientId: "client-123"
  });
  await broker.onExternalCallbackReceived(cancelled.flowId, {
    callbackUrl: `jusbrowse://auth/callback?state=${cancelledPrepared.state}&error=access_denied`,
    state: cancelledPrepared.state,
    error: "access_denied"
  });
  assert.equal(broker.getFlowState(cancelled.flowId), AUTH_FLOW_STATES.CANCELLED);

  const failed = await broker.startAuthFlow({
    sourceTabId: "tab-google-fail",
    initiatorUrl: "https://mail.google.com",
    targetUrl: "https://accounts.google.com/o/oauth2/v2/auth"
  });
  const failedPrepared = await broker.prepareExternalAuth(failed.flowId, {
    redirectUri: "jusbrowse://auth/callback",
    clientId: "client-123"
  });
  await broker.onExternalCallbackReceived(failed.flowId, {
    callbackUrl: `jusbrowse://auth/callback?state=${failedPrepared.state}&code=code-fail`,
    state: failedPrepared.state,
    code: "code-fail"
  });
  await broker.onExternalTokenExchangeResult(failed.flowId, {
    success: false,
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    error: "invalid_grant"
  });
  assert.equal(broker.getFlowState(failed.flowId), AUTH_FLOW_STATES.FAILED);
});
