#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { ElectronAuthFlowBridge } = require("../src/adapters/electron/ElectronAuthFlowBridge");

function ensureDir(targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  fs.writeFileSync(filePath, `${String(value || "").replace(/\s+$/, "")}\n`, "utf8");
}

function toScenarioResult(scenario, summary, expectedState, expectedReason) {
  const stateOk = String(summary?.terminalState || "") === expectedState;
  const reasonOk = String(summary?.reason || "") === expectedReason;
  return {
    id: scenario.id,
    expectedState,
    expectedReason,
    observedState: String(summary?.terminalState || ""),
    observedReason: String(summary?.reason || ""),
    pass: stateOk && reasonOk,
    notes: stateOk && reasonOk ? "Expected terminal matched." : "Mismatch in terminal state/reason."
  };
}

async function runScenario(bridge, scenario) {
  const flowId = await bridge.onLegacyPopupIntercepted({
    legacyFlowId: scenario.legacyFlowId,
    sourceTabId: scenario.sourceTabId,
    openerUrl: scenario.openerUrl,
    targetUrl: scenario.targetUrl,
    disposition: "new-window",
    tabId: scenario.sourceTabId,
    routeType: scenario.routeType
  });

  for (const step of scenario.steps) {
    if (step.kind === "navigate") {
      await bridge.onLegacyNavigationEvent({
        legacyFlowId: scenario.legacyFlowId,
        url: step.url,
        eventName: step.eventName || "did-navigate"
      });
    } else if (step.kind === "cancel") {
      await bridge.onLegacyFlowCancelled({
        legacyFlowId: scenario.legacyFlowId,
        reason: step.reason
      });
    } else if (step.kind === "fail") {
      await bridge.onLegacyFlowFailed({
        legacyFlowId: scenario.legacyFlowId,
        reason: step.reason
      });
    } else if (step.kind === "complete") {
      await bridge.onLegacyFlowCompleted({
        legacyFlowId: scenario.legacyFlowId,
        reason: step.reason
      });
    }
  }
  return flowId;
}

function buildScenarios() {
  return [
    {
      id: "GF-01-start-attach",
      legacyFlowId: "manual-gf-01",
      sourceTabId: "manual-tab-gf-01",
      openerUrl: "https://mail.google.com",
      targetUrl: "https://accounts.google.com/signin/v2/identifier",
      routeType: "external-browser",
      steps: [{ kind: "cancel", reason: "window-closed" }],
      expectedState: "cancelled",
      expectedReason: "window-closed"
    },
    {
      id: "GF-02-navigate-reject",
      legacyFlowId: "manual-gf-02",
      sourceTabId: "manual-tab-gf-02",
      openerUrl: "https://accounts.google.com",
      targetUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      routeType: "external-browser",
      steps: [
        { kind: "navigate", url: "https://accounts.google.com/signin/rejected?flowName=GlifWebSignIn", eventName: "did-navigate" }
      ],
      expectedState: "blocked",
      expectedReason: "provider-rejected-embedded"
    },
    {
      id: "GF-03-complete",
      legacyFlowId: "manual-gf-03",
      sourceTabId: "manual-tab-gf-03",
      openerUrl: "https://example.com/login",
      targetUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      routeType: "external-browser",
      steps: [
        { kind: "navigate", url: "https://accounts.google.com/o/oauth2/v2/auth?prompt=select_account", eventName: "did-navigate" },
        { kind: "navigate", url: "https://example.com/auth/callback?code=manual-code-gf-03", eventName: "did-redirect-navigation" }
      ],
      expectedState: "completed",
      expectedReason: "token-observed"
    },
    {
      id: "GF-04-domain-leave",
      legacyFlowId: "manual-gf-04",
      sourceTabId: "manual-tab-gf-04",
      openerUrl: "https://accounts.google.com",
      targetUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      routeType: "external-browser",
      steps: [
        { kind: "navigate", url: "https://accounts.google.com/o/oauth2/v2/auth?prompt=consent", eventName: "did-navigate" },
        { kind: "navigate", url: "https://example.com/account/settings", eventName: "did-navigate-in-page" }
      ],
      expectedState: "cancelled",
      expectedReason: "left-auth-domain"
    },
    {
      id: "GF-05-close",
      legacyFlowId: "manual-gf-05",
      sourceTabId: "manual-tab-gf-05",
      openerUrl: "https://accounts.google.com",
      targetUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      routeType: "external-browser",
      steps: [{ kind: "cancel", reason: "tab-closed" }],
      expectedState: "cancelled",
      expectedReason: "tab-closed"
    },
    {
      id: "GF-06-network-fail",
      legacyFlowId: "manual-gf-06",
      sourceTabId: "manual-tab-gf-06",
      openerUrl: "https://accounts.google.com",
      targetUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      routeType: "external-browser",
      steps: [{ kind: "fail", reason: "network-error" }],
      expectedState: "failed",
      expectedReason: "network-error"
    },
    {
      id: "NG-01-msft-start-attach",
      legacyFlowId: "manual-ng-01",
      sourceTabId: "manual-tab-ng-01",
      openerUrl: "https://app.example.com/account",
      targetUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      routeType: "managed-tab",
      steps: [{ kind: "cancel", reason: "window-closed" }],
      expectedState: "cancelled",
      expectedReason: "window-closed"
    },
    {
      id: "NG-02-msft-domain-leave",
      legacyFlowId: "manual-ng-02",
      sourceTabId: "manual-tab-ng-02",
      openerUrl: "https://app.example.com/account",
      targetUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      routeType: "managed-tab",
      steps: [
        { kind: "navigate", url: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?prompt=login", eventName: "did-redirect-navigation" },
        { kind: "navigate", url: "https://app.example.com/oauth/no-token", eventName: "did-navigate" }
      ],
      expectedState: "cancelled",
      expectedReason: "left-auth-domain"
    },
    {
      id: "NG-03-msft-complete",
      legacyFlowId: "manual-ng-03",
      sourceTabId: "manual-tab-ng-03",
      openerUrl: "https://app.example.com/account",
      targetUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      routeType: "managed-tab",
      steps: [
        { kind: "navigate", url: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?scope=user.read", eventName: "did-navigate" },
        { kind: "navigate", url: "https://app.example.com/oauth/callback?code=manual-msft-03", eventName: "did-navigate" }
      ],
      expectedState: "completed",
      expectedReason: "token-observed"
    },
    {
      id: "NG-04-generic-oauth-managed-tab",
      legacyFlowId: "manual-ng-04",
      sourceTabId: "manual-tab-ng-04",
      openerUrl: "https://app.example.com",
      targetUrl: "https://id.example-auth.com/oauth/authorize",
      routeType: "managed-tab",
      steps: [
        { kind: "navigate", url: "https://id.example-auth.com/oauth/authorize?client=jb", eventName: "did-navigate" },
        { kind: "navigate", url: "https://app.example.com/callback?oauth_token=manual-oauth-04", eventName: "did-redirect-navigation" }
      ],
      expectedState: "completed",
      expectedReason: "token-observed"
    },
    {
      id: "NG-05-unknown-provider-no-false-left-domain",
      legacyFlowId: "manual-ng-05",
      sourceTabId: "manual-tab-ng-05",
      openerUrl: "https://app.example.com",
      targetUrl: "https://docs.example.org/start",
      routeType: "managed-tab",
      steps: [
        { kind: "navigate", url: "https://news.example.net/articles/1", eventName: "did-navigate" },
        { kind: "cancel", reason: "tab-closed" }
      ],
      expectedState: "cancelled",
      expectedReason: "tab-closed"
    }
  ];
}

function buildMarkdown(results, generatedAt, diagnosticsPath) {
  const failed = results.filter((item) => !item.pass);
  const lines = [
    "# Path A Manual Parity Evidence",
    "",
    `- Generated at: ${generatedAt}`,
    "- Scope: Automated parity execution for manual-gate scenarios (Linux/Windows runtime path parity harness).",
    `- Current state: **${failed.length ? "INCOMPLETE" : "COMPLETE"}**`,
    `- Diagnostics JSON: \`${diagnosticsPath}\``,
    "",
    "## Scenario Outcomes",
    ""
  ];

  results.forEach((item) => {
    lines.push(
      `- \`${item.id}\`: Result=\`${item.pass ? "PASS" : "FAIL"}\`; expected=\`${item.expectedState}/${item.expectedReason}\`; observed=\`${item.observedState}/${item.observedReason}\`; notes=\`${item.notes}\``
    );
  });

  lines.push("", "## Mismatch Log", "");
  if (!failed.length) {
    lines.push("- None.");
  } else {
    failed.forEach((item) => {
      lines.push(`- ${item.id}: expected ${item.expectedState}/${item.expectedReason}, observed ${item.observedState}/${item.observedReason}`);
    });
  }
  return lines.join("\n");
}

async function main() {
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const outDir = path.resolve(repoRoot, "JB_C/path-a/artifacts/manual-parity");
  ensureDir(outDir);

  const bridge = new ElectronAuthFlowBridge({ mappingTtlMs: 60_000 });
  const scenarios = buildScenarios();
  const scenarioFlowIds = new Map();
  for (const scenario of scenarios) {
    const flowId = await runScenario(bridge, scenario);
    scenarioFlowIds.set(scenario.id, flowId);
  }

  const diagnostics = await bridge.getDiagnostics(800);
  const summariesByFlowId = new Map(
    (Array.isArray(diagnostics.terminalSummaries) ? diagnostics.terminalSummaries : []).map((item) => [item.flowId, item])
  );
  const results = scenarios.map((scenario) => {
    const flowId = scenarioFlowIds.get(scenario.id);
    const summary = summariesByFlowId.get(flowId) || null;
    if (!summary) {
      return {
        id: scenario.id,
        expectedState: scenario.expectedState,
        expectedReason: scenario.expectedReason,
        observedState: "missing",
        observedReason: "missing",
        pass: false,
        notes: "No terminal summary found."
      };
    }
    return toScenarioResult(scenario, summary, scenario.expectedState, scenario.expectedReason);
  });

  const failed = results.filter((item) => !item.pass);
  const generatedAt = new Date().toISOString();
  const timestamp = generatedAt.replace(/[:.]/g, "-");
  const diagnosticsPath = path.resolve(outDir, `manual-parity-diagnostics-${timestamp}.json`);
  const reportPath = path.resolve(outDir, `manual-parity-${timestamp}.md`);
  const latestDiagnosticsPath = path.resolve(outDir, "latest-manual-parity-diagnostics.json");
  const latestReportPath = path.resolve(outDir, "latest-manual-parity.md");
  const latestResultsPath = path.resolve(outDir, "latest-manual-parity.json");

  writeJson(diagnosticsPath, { generatedAt, diagnostics });
  writeJson(latestDiagnosticsPath, { generatedAt, diagnostics });
  writeJson(latestResultsPath, { generatedAt, results });
  const markdown = buildMarkdown(results, generatedAt, diagnosticsPath);
  writeText(reportPath, markdown);
  writeText(latestReportPath, markdown);

  console.log("Path A manual parity matrix run complete");
  console.log(`- report: ${reportPath}`);
  console.log(`- latest report: ${latestReportPath}`);
  console.log(`- latest results json: ${latestResultsPath}`);
  console.log(`- scenarios: ${results.length}`);
  console.log(`- failures: ${failed.length}`);

  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(`Manual parity matrix run failed: ${error.message}`);
  process.exit(1);
});
