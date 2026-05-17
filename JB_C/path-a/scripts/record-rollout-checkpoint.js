#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function usage() {
  return [
    "Usage:",
    "  node JB_C/path-a/scripts/record-rollout-checkpoint.js <checkpoint-label> <current.json> [more-current.json ...] [--baseline <baseline.json> [more-baseline.json ...]]",
    "",
    "Example:",
    "  node JB_C/path-a/scripts/record-rollout-checkpoint.js canary run-1.json --baseline baseline-1.json"
  ].join("\n");
}

function sanitizeLabel(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function ensureDir(targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
}

function parseFlagshipReady(assessmentOutput) {
  const text = String(assessmentOutput || "");
  if (text.includes("- verdict: FLAGSHIP_READY")) return true;
  if (text.includes("- verdict: NOT_READY")) return false;
  return null;
}

function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error(usage());
    process.exit(1);
  }

  const checkpointLabelRaw = args[0];
  const diagnosticsArgs = args.slice(1);
  if (!diagnosticsArgs.length) {
    console.error("Error: at least one diagnostics file is required.");
    console.error("");
    console.error(usage());
    process.exit(1);
  }

  const checkpointLabel = sanitizeLabel(checkpointLabelRaw);
  if (!checkpointLabel) {
    console.error("Error: checkpoint label is invalid.");
    process.exit(1);
  }

  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const evaluatorScript = path.resolve(repoRoot, "JB_C/path-a/scripts/evaluate-cutover-diagnostics.js");
  const flagshipScript = path.resolve(repoRoot, "JB_C/path-a/scripts/assess-flagship-readiness.js");
  const outputDir = path.resolve(repoRoot, "JB_C/path-a/artifacts/staged-rollout/checkpoints");
  ensureDir(outputDir);

  const evaluation = spawnSync(process.execPath, [evaluatorScript, ...diagnosticsArgs], { encoding: "utf8" });
  const evaluationOutput = `${evaluation.stdout || ""}${evaluation.stderr ? `\n${evaluation.stderr}` : ""}`.trim();
  const evaluationPass = (evaluation.status || 0) === 0;

  const assessment = spawnSync(process.execPath, [flagshipScript], { encoding: "utf8" });
  const assessmentOutput = `${assessment.stdout || ""}${assessment.stderr ? `\n${assessment.stderr}` : ""}`.trim();
  const flagshipReady = parseFlagshipReady(assessmentOutput);

  const generatedAt = new Date().toISOString();
  const timestamp = generatedAt.replace(/[:.]/g, "-");
  const checkpointPath = path.resolve(outputDir, `${checkpointLabel}-${timestamp}.md`);
  const latestCheckpointPath = path.resolve(outputDir, `latest-${checkpointLabel}.md`);
  const latestAnyCheckpointPath = path.resolve(outputDir, "latest-checkpoint.md");

  const markdown = [
    "# Path A Rollout Checkpoint",
    "",
    `- Generated at: ${generatedAt}`,
    `- Checkpoint label: ${checkpointLabel}`,
    `- Diagnostics verdict: **${evaluationPass ? "PASS" : "FAIL"}**`,
    `- Flagship ready now: **${
      flagshipReady == null ? "UNKNOWN" : flagshipReady ? "YES" : "NO"
    }**`,
    "",
    "## Diagnostics Evaluation Output",
    "",
    "```text",
    evaluationOutput || "(no output)",
    "```",
    "",
    "## Flagship Readiness Output",
    "",
    "```text",
    assessmentOutput || "(no output)",
    "```",
    ""
  ].join("\n");

  fs.writeFileSync(checkpointPath, markdown, "utf8");
  fs.writeFileSync(latestCheckpointPath, markdown, "utf8");
  fs.writeFileSync(latestAnyCheckpointPath, markdown, "utf8");

  console.log("Path A rollout checkpoint captured");
  console.log(`- file: ${checkpointPath}`);
  console.log(`- latest for label: ${latestCheckpointPath}`);
  console.log(`- latest any checkpoint: ${latestAnyCheckpointPath}`);
  console.log(`- diagnostics verdict: ${evaluationPass ? "PASS" : "FAIL"}`);
  console.log(`- flagship ready now: ${flagshipReady == null ? "UNKNOWN" : flagshipReady ? "YES" : "NO"}`);

  process.exit(evaluationPass ? 0 : 1);
}

main();
