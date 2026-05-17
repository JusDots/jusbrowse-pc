const test = require("node:test");
const assert = require("node:assert/strict");

const { ElectronAuthFlowBridge } = require("../src/adapters/electron/ElectronAuthFlowBridge");
const { AUTH_FLOW_REASONS, AUTH_FLOW_STATES } = require("../src/auth/AuthFlowReasons");

test("ElectronAuthFlowBridge fixture: embedded-policy rejection reaches blocked terminal summary", async () => {
  const bridge = new ElectronAuthFlowBridge({ mappingTtlMs: 60_000 });
  const flowId = await bridge.onLegacyPopupIntercepted({
    legacyFlowId: "legacy-flow-embedded-reject",
    sourceTabId: "tab-embedded-1",
    openerUrl: "https://mail.google.com",
    targetUrl: "https://accounts.google.com/signin/v2/identifier",
    disposition: "new-window",
    tabId: "auth-tab-1",
    routeType: "external-browser",
    incognito: false
  });

  await bridge.onLegacyNavigationEvent({
    legacyFlowId: "legacy-flow-embedded-reject",
    url: "https://accounts.google.com/signin/rejected?flowName=GlifWebSignIn",
    eventName: "did-navigate"
  });

  const diagnostics = await bridge.getDiagnostics(250);
  assert.equal(diagnostics.telemetryValidation.invalidEvents, 0);
  const byFlow = diagnostics.groupedDiagnostics.byFlowId[flowId];
  assert.ok(byFlow);
  assert.equal(byFlow.terminalSummary.terminalState, AUTH_FLOW_STATES.BLOCKED);
  assert.equal(byFlow.terminalSummary.reason, AUTH_FLOW_REASONS.PROVIDER_REJECTED_EMBEDDED);
  assert.equal(byFlow.terminalSummary.providerKey, "google-family");
  assert.match(byFlow.terminalSummary.correlationId, /^corr-patha-auth-flow-/);
  assert.equal(
    diagnostics.groupedDiagnostics.byTerminalReason[AUTH_FLOW_REASONS.PROVIDER_REJECTED_EMBEDDED].length,
    1
  );

  const flowEvents = byFlow.telemetry;
  const eventNames = flowEvents.map((entry) => entry.eventName);
  assert.ok(eventNames.includes("auth.popup.intercepted"));
  assert.ok(eventNames.includes("auth.redirect.observed"));
  assert.ok(eventNames.includes("auth.flow.blocked"));
  const correlationIds = new Set(flowEvents.map((entry) => entry.payload.correlationId));
  assert.equal(correlationIds.size, 1);
});

test("ElectronAuthFlowBridge supports external google callback mismatch and token success", async () => {
  const bridge = new ElectronAuthFlowBridge({ mappingTtlMs: 60_000 });
  await bridge.onLegacyPopupIntercepted({
    legacyFlowId: "legacy-google-external-1",
    sourceTabId: "tab-google-1",
    openerUrl: "https://mail.google.com",
    targetUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    disposition: "new-window",
    tabId: "auth-tab-google-1",
    routeType: "external-browser",
    incognito: false
  });
  const prepared = await bridge.prepareLegacyExternalAuth({
    legacyFlowId: "legacy-google-external-1",
    redirectUri: "jusbrowse://auth/callback",
    clientId: "client-123",
    tokenEndpoint: "https://oauth2.googleapis.com/token"
  });
  assert.ok(prepared?.state);
  await bridge.onLegacyExternalAuthLaunch({
    legacyFlowId: "legacy-google-external-1",
    launchUrl: `https://accounts.google.com/o/oauth2/v2/auth?state=${prepared.state}`,
    redirectUri: "jusbrowse://auth/callback"
  });
  const callback = await bridge.onLegacyExternalCallback({
    legacyFlowId: "legacy-google-external-1",
    callbackUrl: `jusbrowse://auth/callback?state=${prepared.state}&code=abc`,
    state: prepared.state,
    code: "abc"
  });
  assert.equal(callback?.ok, true);
  await bridge.onLegacyExternalTokenExchange({
    legacyFlowId: "legacy-google-external-1",
    success: true,
    tokenEndpoint: "https://oauth2.googleapis.com/token"
  });

  const mismatchFlowId = await bridge.onLegacyPopupIntercepted({
    legacyFlowId: "legacy-google-external-2",
    sourceTabId: "tab-google-2",
    openerUrl: "https://mail.google.com",
    targetUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    disposition: "new-window",
    tabId: "auth-tab-google-2",
    routeType: "external-browser",
    incognito: false
  });
  const mismatchPrepared = await bridge.prepareLegacyExternalAuth({
    legacyFlowId: "legacy-google-external-2",
    redirectUri: "jusbrowse://auth/callback",
    clientId: "client-123"
  });
  const mismatch = await bridge.onLegacyExternalCallback({
    legacyFlowId: "legacy-google-external-2",
    callbackUrl: "jusbrowse://auth/callback?state=mismatch&code=bad",
    state: "mismatch",
    code: "bad"
  });
  assert.equal(mismatch?.ok, false);

  const diagnostics = await bridge.getDiagnostics(300);
  assert.equal(diagnostics.telemetryValidation.invalidEvents, 0);
  const successfulSummary = diagnostics.groupedDiagnostics.byTerminalReason[AUTH_FLOW_REASONS.TOKEN_EXCHANGE_SUCCEEDED];
  assert.ok(Array.isArray(successfulSummary) && successfulSummary.length >= 1);
  const failedSummary = diagnostics.groupedDiagnostics.byFlowId[mismatchFlowId].terminalSummary;
  assert.equal(failedSummary.reason, AUTH_FLOW_REASONS.CALLBACK_STATE_MISMATCH);
  assert.notEqual(mismatchPrepared.state, "mismatch");
});

test("ElectronAuthFlowBridge emits external notice telemetry with correlation IDs", async () => {
  const bridge = new ElectronAuthFlowBridge({ mappingTtlMs: 60_000 });
  await bridge.onLegacyPopupIntercepted({
    legacyFlowId: "legacy-google-notice-1",
    sourceTabId: "tab-google-notice-1",
    openerUrl: "https://mail.google.com",
    targetUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    disposition: "new-window",
    tabId: "auth-tab-google-notice-1",
    routeType: "external-browser",
    incognito: false
  });

  const launchDecision = await bridge.onLegacyExternalLaunchDecision({
    legacyFlowId: "legacy-google-notice-1",
    decision: "external-browser",
    targetUrl: "https://accounts.google.com/o/oauth2/v2/auth"
  });
  const launch = await bridge.onLegacyExternalAuthLaunch({
    legacyFlowId: "legacy-google-notice-1",
    launchUrl: "https://accounts.google.com/o/oauth2/v2/auth?state=safe-state",
    redirectUri: "jusbrowse://auth/callback"
  });
  const notice = await bridge.onLegacyExternalNoticeEmitted({
    legacyFlowId: "legacy-google-notice-1",
    noticeType: "launch-started",
    message: "Google sign-in continues in your default browser.",
    channel: "toast"
  });
  await bridge.onLegacyExternalLaunchResult({
    legacyFlowId: "legacy-google-notice-1",
    launchUrl: "https://accounts.google.com/o/oauth2/v2/auth?state=safe-state",
    success: true,
    error: "",
    terminalReason: ""
  });

  assert.equal(typeof launchDecision?.correlationId, "string");
  assert.equal(launchDecision?.correlationId, launch?.correlationId);
  assert.equal(notice?.correlationId, launch?.correlationId);

  const diagnostics = await bridge.getDiagnostics(300);
  assert.equal(diagnostics.telemetryValidation.invalidEvents, 0);
  const flowEvents = diagnostics.telemetry.filter(
    (entry) => entry.payload.flowId === launch.flowId
  );
  assert.ok(flowEvents.some((entry) => entry.eventName === "auth.external.launch.decision"));
  assert.ok(flowEvents.some((entry) => entry.eventName === "auth.external.notice.emitted"));
  assert.ok(flowEvents.some((entry) => entry.eventName === "auth.external.launch.result"));
  const correlationIds = new Set(flowEvents.map((entry) => entry.payload.correlationId));
  assert.equal(correlationIds.size, 1);
});

test("ElectronAuthFlowBridge external launch failure emits failure telemetry and terminal reason", async () => {
  const bridge = new ElectronAuthFlowBridge({ mappingTtlMs: 60_000 });
  const flowId = await bridge.onLegacyPopupIntercepted({
    legacyFlowId: "legacy-google-failure-1",
    sourceTabId: "tab-google-failure-1",
    openerUrl: "https://mail.google.com",
    targetUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    disposition: "new-window",
    tabId: "auth-tab-google-failure-1",
    routeType: "external-browser",
    incognito: false
  });

  await bridge.onLegacyExternalLaunchResult({
    legacyFlowId: "legacy-google-failure-1",
    launchUrl: "https://accounts.google.com/o/oauth2/v2/auth?state=failure-state",
    success: false,
    error: "open-external-failed",
    terminalReason: "provider-error"
  });
  await bridge.onLegacyExternalNoticeEmitted({
    legacyFlowId: "legacy-google-failure-1",
    noticeType: "launch-failed",
    message: "Google sign-in could not open your default browser. Please try again.",
    channel: "toast"
  });
  await bridge.onLegacyFlowFailed({
    legacyFlowId: "legacy-google-failure-1",
    reason: AUTH_FLOW_REASONS.PROVIDER_ERROR
  });

  const diagnostics = await bridge.getDiagnostics(300);
  assert.equal(diagnostics.telemetryValidation.invalidEvents, 0);
  const summary = diagnostics.groupedDiagnostics.byFlowId[flowId].terminalSummary;
  assert.equal(summary.reason, AUTH_FLOW_REASONS.PROVIDER_ERROR);
  const flowEvents = diagnostics.telemetry.filter((entry) => entry.payload.flowId === flowId);
  const launchResultEvent = flowEvents.find((entry) => entry.eventName === "auth.external.launch.result");
  assert.equal(launchResultEvent?.payload.success, false);
  assert.equal(launchResultEvent?.payload.terminalReason, AUTH_FLOW_REASONS.PROVIDER_ERROR);
  assert.ok(flowEvents.some((entry) => entry.eventName === "auth.external.notice.emitted"));
});

test("ElectronAuthFlowBridge non-google managed-tab flow does not emit google external notice telemetry", async () => {
  const bridge = new ElectronAuthFlowBridge({ mappingTtlMs: 60_000 });
  const flowId = await bridge.onLegacyPopupIntercepted({
    legacyFlowId: "legacy-microsoft-managed-1",
    sourceTabId: "tab-ms-managed-1",
    openerUrl: "https://portal.office.com",
    targetUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    disposition: "new-window",
    tabId: "auth-tab-ms-managed-1",
    routeType: "managed-tab",
    incognito: false
  });
  await bridge.onLegacyNavigationEvent({
    legacyFlowId: "legacy-microsoft-managed-1",
    url: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?prompt=select_account",
    eventName: "did-redirect-navigation"
  });

  const diagnostics = await bridge.getDiagnostics(200);
  assert.equal(diagnostics.telemetryValidation.invalidEvents, 0);
  const flowEvents = diagnostics.telemetry.filter((entry) => entry.payload.flowId === flowId);
  assert.ok(flowEvents.some((entry) => entry.eventName === "auth.popup.routed"));
  assert.ok(!flowEvents.some((entry) => entry.eventName === "auth.external.notice.emitted"));
});
