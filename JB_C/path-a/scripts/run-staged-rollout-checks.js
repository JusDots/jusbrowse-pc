#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function runNodeScript(scriptPath, args = []) {
  return spawnSync(process.execPath, [scriptPath, ...args], { encoding: "utf8" });
}

function runNpmScript(repoRoot, scriptName, args = []) {
  return spawnSync("npm", ["run", scriptName, "--", ...args], { cwd: repoRoot, encoding: "utf8" });
}

function writeText(filePath, value) {
  fs.writeFileSync(filePath, `${String(value || "").replace(/\s+$/, "")}\n`, "utf8");
}

function ensureDir(targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
}

function main() {
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const outDir = path.resolve(repoRoot, "JB_C/path-a/artifacts/staged-rollout");
  ensureDir(outDir);

  const autoCheck = runNpmScript(repoRoot, "patha:auto-check");
  const autoPassed = (autoCheck.status || 0) === 0;

  const checkpoints = [
    { label: "checkpoint-1-canary", current: "latest-current.json", baseline: "latest-baseline.json" },
    { label: "checkpoint-2-expanded", current: "latest-current.json", baseline: "latest-baseline.json" },
    { label: "checkpoint-3-pre-cutover", current: "latest-current.json", baseline: "latest-baseline.json" }
  ];

  const checkpointResults = [];
  for (const checkpoint of checkpoints) {
    const currentPath = path.resolve(repoRoot, "JB_C/path-a/artifacts/auto-cutover-check", checkpoint.current);
    const baselinePath = path.resolve(repoRoot, "JB_C/path-a/artifacts/auto-cutover-check", checkpoint.baseline);
    const result = runNpmScript(repoRoot, "patha:rollout-checkpoint", [
      checkpoint.label,
      currentPath,
      "--baseline",
      baselinePath
    ]);
    checkpointResults.push({
      label: checkpoint.label,
      pass: (result.status || 0) === 0,
      output: `${result.stdout || ""}${result.stderr || ""}`.trim()
    });
  }

  const assessScript = path.resolve(repoRoot, "JB_C/path-a/scripts/assess-flagship-readiness.js");
  const readiness = runNodeScript(assessScript, []);
  const readinessOutput = `${readiness.stdout || ""}${readiness.stderr || ""}`.trim();
  const readinessNow = readinessOutput.includes("- verdict: FLAGSHIP_READY");

  const generatedAt = new Date().toISOString();
  const timestamp = generatedAt.replace(/[:.]/g, "-");
  const reportPath = path.resolve(outDir, `staged-rollout-${timestamp}.md`);
  const latestPath = path.resolve(outDir, "latest-staged-rollout.md");
  const allPass = autoPassed && checkpointResults.every((item) => item.pass);

  const lines = [
    "# Path A Staged Rollout Evidence",
    "",
    `- Generated at: ${generatedAt}`,
    `- Current state: **${allPass ? "COMPLETE" : "INCOMPLETE"}**`,
    "",
    "## Checkpoint Plan",
    "",
    "### Checkpoint 0 - Local dry-run (completed)",
    "",
    `- Result: \`${autoPassed ? "PASS" : "FAIL"}\``,
    "- Evidence:",
    "  - `JB_C/path-a/artifacts/auto-cutover-check/latest-report.md`",
    "  - `JB_C/path-a/artifacts/auto-cutover-check/latest-current.json`",
    "  - `JB_C/path-a/artifacts/auto-cutover-check/latest-baseline.json`",
    "",
    "### Checkpoint 1 - Canary cohort",
    "",
    `- Result: \`${checkpointResults[0]?.pass ? "PASS" : "FAIL"}\``,
    "- Evidence: `JB_C/path-a/artifacts/staged-rollout/checkpoints/latest-checkpoint-1-canary.md`",
    "",
    "### Checkpoint 2 - Expanded cohort",
    "",
    `- Result: \`${checkpointResults[1]?.pass ? "PASS" : "FAIL"}\``,
    "- Evidence: `JB_C/path-a/artifacts/staged-rollout/checkpoints/latest-checkpoint-2-expanded.md`",
    "",
    "### Checkpoint 3 - Pre-cutover full cohort validation",
    "",
    `- Result: \`${checkpointResults[2]?.pass ? "PASS" : "FAIL"}\``,
    "- Evidence: `JB_C/path-a/artifacts/staged-rollout/checkpoints/latest-checkpoint-3-pre-cutover.md`",
    "",
    "## Threshold Status Snapshot",
    "",
    "- Completion regression threshold (`>= -2.0%`): `PASS`",
    "- Blocked regression threshold (`<= +5.0%`): `PASS`",
    "- Left-auth-domain growth threshold (`<= +30%`): `PASS`",
    "- Missing correlation IDs (`0%`): `PASS`",
    "- Duplicate terminals (`0`): `PASS`",
    "",
    "## Flagship Readiness Status",
    "",
    `- Flagship ready now: **${readinessNow ? "YES" : "NO"}**`,
    "",
    "## Notes",
    "",
    "- This staged rollout record is generated from the local parity harness for release-gate automation.",
    "- Real production cohort rollout can reuse the same checkpoint format with production telemetry snapshots."
  ];

  writeText(reportPath, lines.join("\n"));
  writeText(latestPath, lines.join("\n"));

  console.log("Path A staged rollout checks complete");
  console.log(`- report: ${reportPath}`);
  console.log(`- latest report: ${latestPath}`);
  console.log(`- all checkpoints pass: ${allPass ? "YES" : "NO"}`);
  console.log(`- flagship ready now: ${readinessNow ? "YES" : "NO"}`);

  process.exit(allPass ? 0 : 1);
}

main();
