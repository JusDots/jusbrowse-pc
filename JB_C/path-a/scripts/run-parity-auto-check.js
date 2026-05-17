#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { ElectronAuthFlowBridge } = require("../src/adapters/electron/ElectronAuthFlowBridge");

function ensureDir(targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
}

async function runScenarioSet() {
  const bridge = new ElectronAuthFlowBridge({ mappingTtlMs: 60_000 });

  const blockedLegacyId = "auto-legacy-blocked-google";
  await bridge.onLegacyPopupIntercepted({
    legacyFlowId: blockedLegacyId,
    sourceTabId: "auto-tab-1",
    openerUrl: "https://mail.google.com",
    targetUrl: "https://accounts.google.com/signin/v2/identifier",
    disposition: "new-window",
    tabId: "auto-tab-1",
    routeType: "external-browser"
  });
  await bridge.onLegacyNavigationEvent({
    legacyFlowId: blockedLegacyId,
    url: "https://accounts.google.com/signin/rejected?flowName=GlifWebSignIn",
    eventName: "did-navigate"
  });

  const successLegacyId = "auto-legacy-success-google";
  await bridge.onLegacyPopupIntercepted({
    legacyFlowId: successLegacyId,
    sourceTabId: "auto-tab-2",
    openerUrl: "https://example.com/login",
    targetUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    disposition: "new-window",
    tabId: "auto-tab-2",
    routeType: "external-browser"
  });
  await bridge.onLegacyNavigationEvent({
    legacyFlowId: successLegacyId,
    url: "https://accounts.google.com/o/oauth2/v2/auth?prompt=select_account",
    eventName: "did-navigate"
  });
  await bridge.onLegacyNavigationEvent({
    legacyFlowId: successLegacyId,
    url: "https://example.com/auth/callback?code=auto-code-123",
    eventName: "did-navigate"
  });

  const msftLeftLegacyId = "auto-legacy-left-domain-msft";
  await bridge.onLegacyPopupIntercepted({
    legacyFlowId: msftLeftLegacyId,
    sourceTabId: "auto-tab-3",
    openerUrl: "https://app.example.com/account",
    targetUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    disposition: "new-window",
    tabId: "auto-tab-3",
    routeType: "managed-tab"
  });
  await bridge.onLegacyNavigationEvent({
    legacyFlowId: msftLeftLegacyId,
    url: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?prompt=login",
    eventName: "did-redirect-navigation"
  });
  await bridge.onLegacyNavigationEvent({
    legacyFlowId: msftLeftLegacyId,
    url: "https://app.example.com/oauth/callback",
    eventName: "did-navigate"
  });

  const tabClosedLegacyId = "auto-legacy-tab-closed";
  await bridge.onLegacyPopupIntercepted({
    legacyFlowId: tabClosedLegacyId,
    sourceTabId: "auto-tab-4",
    openerUrl: "https://accounts.google.com",
    targetUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    disposition: "new-window",
    tabId: "auto-tab-4",
    routeType: "external-browser"
  });
  await bridge.onLegacyFlowCancelled({
    legacyFlowId: tabClosedLegacyId,
    reason: "tab-closed"
  });

  const failedLegacyId = "auto-legacy-network-failed";
  await bridge.onLegacyPopupIntercepted({
    legacyFlowId: failedLegacyId,
    sourceTabId: "auto-tab-5",
    openerUrl: "https://accounts.google.com",
    targetUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    disposition: "new-window",
    tabId: "auto-tab-5",
    routeType: "external-browser"
  });
  await bridge.onLegacyFlowFailed({
    legacyFlowId: failedLegacyId,
    reason: "network-error"
  });

  const diagnostics = await bridge.getDiagnostics(500);
  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      generatedBy: "patha-auto-parity-check"
    },
    pathA: diagnostics
  };
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  fs.writeFileSync(filePath, String(value || ""), "utf8");
}

function buildMarkdownReport({ baselinePath, currentPath, checkerExitCode, checkerOutput, generatedAt }) {
  const status = checkerExitCode === 0 ? "PASS" : "FAIL";
  const nextAction =
    checkerExitCode === 0
      ? "Auto parity check is healthy. Continue product work and periodic verification."
      : "Investigate failing thresholds in checker output before cutover.";
  return [
    "# Path A Auto Check Report",
    "",
    `- Generated at: ${generatedAt}`,
    `- Overall status: **${status}**`,
    `- Current diagnostics: \`${currentPath}\``,
    `- Baseline diagnostics: \`${baselinePath}\``,
    "",
    "## Next Action",
    "",
    `- ${nextAction}`,
    "",
    "## Checker Output",
    "",
    "```text",
    checkerOutput.trimEnd(),
    "```",
    ""
  ].join("\n");
}

async function main() {
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const artifactsDir = path.resolve(repoRoot, "JB_C/path-a/artifacts/auto-cutover-check");
  const checkerScript = path.resolve(repoRoot, "JB_C/path-a/scripts/evaluate-cutover-diagnostics.js");
  ensureDir(artifactsDir);

  const baseline = await runScenarioSet();
  const current = await runScenarioSet();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const baselinePath = path.resolve(artifactsDir, `baseline-${timestamp}.json`);
  const currentPath = path.resolve(artifactsDir, `current-${timestamp}.json`);
  const reportPath = path.resolve(artifactsDir, `report-${timestamp}.md`);
  const latestBaselinePath = path.resolve(artifactsDir, "latest-baseline.json");
  const latestCurrentPath = path.resolve(artifactsDir, "latest-current.json");
  const latestReportPath = path.resolve(artifactsDir, "latest-report.md");
  writeJson(baselinePath, baseline);
  writeJson(currentPath, current);
  writeJson(latestBaselinePath, baseline);
  writeJson(latestCurrentPath, current);

  console.log("Generated diagnostics files:");
  console.log(`  baseline: ${baselinePath}`);
  console.log(`  current:  ${currentPath}`);
  console.log(`  latest baseline: ${latestBaselinePath}`);
  console.log(`  latest current:  ${latestCurrentPath}`);

  const result = spawnSync(process.execPath, [checkerScript, currentPath, "--baseline", baselinePath], {
    encoding: "utf8"
  });
  const checkerOutput = `${result.stdout || ""}${result.stderr ? `\n${result.stderr}` : ""}`;
  process.stdout.write(checkerOutput);
  const report = buildMarkdownReport({
    baselinePath,
    currentPath,
    checkerExitCode: result.status || 0,
    checkerOutput,
    generatedAt: new Date().toISOString()
  });
  writeText(reportPath, report);
  writeText(latestReportPath, report);
  console.log("\nGenerated report files:");
  console.log(`  report: ${reportPath}`);
  console.log(`  latest report: ${latestReportPath}`);

  process.exit(result.status || 0);
}

main().catch((error) => {
  console.error(`Auto parity check failed: ${error.message}`);
  process.exit(1);
});
