#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function ensureDir(targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
}

function readOptional(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function writeText(filePath, text) {
  fs.writeFileSync(filePath, `${String(text || "").replace(/\s+$/, "")}\n`, "utf8");
}

function parseAutoCheckStatus(reportMarkdown) {
  const text = String(reportMarkdown || "");
  if (text.includes("- Overall status: **PASS**")) return "PASS";
  if (text.includes("- Overall status: **FAIL**")) return "FAIL";
  return "UNKNOWN";
}

function getUncheckedChecklistItems(markdown) {
  return String(markdown || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- [ ] "))
    .map((line) => line.replace("- [ ] ", "").trim())
    .filter(Boolean);
}

function isPostSignoffItem(item) {
  const text = String(item || "").toLowerCase();
  return text.includes("after signoff");
}

function main() {
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const checklistPath = path.resolve(repoRoot, "JB_C/path-a/docs/migration-checklist.md");
  const autoReportPath = path.resolve(repoRoot, "JB_C/path-a/artifacts/auto-cutover-check/latest-report.md");
  const manualParityPath = path.resolve(repoRoot, "JB_C/path-a/artifacts/manual-parity/latest-manual-parity.md");
  const stagedRolloutPath = path.resolve(repoRoot, "JB_C/path-a/artifacts/staged-rollout/latest-staged-rollout.md");
  const legacyRemovalPlanPath = path.resolve(repoRoot, "JB_C/path-a/docs/legacy-auth-removal-plan.md");
  const outputDir = path.resolve(repoRoot, "JB_C/path-a/artifacts/signoff");
  ensureDir(outputDir);

  const autoReport = readOptional(autoReportPath);
  const checklistMarkdown = readOptional(checklistPath);
  const pendingChecklistItems = getUncheckedChecklistItems(checklistMarkdown).filter((item) => !isPostSignoffItem(item));
  const autoCheckStatus = parseAutoCheckStatus(autoReport);

  const manualParityExists = fs.existsSync(manualParityPath);
  const stagedRolloutExists = fs.existsSync(stagedRolloutPath);
  const legacyRemovalPlanExists = fs.existsSync(legacyRemovalPlanPath);
  const goNoGo = autoCheckStatus === "PASS" && pendingChecklistItems.length === 0 ? "GO" : "NO_GO";
  const generatedAt = new Date().toISOString();
  const timestamp = generatedAt.replace(/[:.]/g, "-");

  const blockers = [];
  if (autoCheckStatus !== "PASS") blockers.push("Automated cutover checks are not PASS.");
  blockers.push(...pendingChecklistItems);
  if (!manualParityExists) blockers.push("Manual parity evidence artifact is missing.");
  if (!stagedRolloutExists) blockers.push("Staged rollout evidence artifact is missing.");
  if (!legacyRemovalPlanExists) blockers.push("Legacy auth removal plan is missing.");

  const markdown = [
    "# Path A Readiness Bundle",
    "",
    `- Generated at: ${generatedAt}`,
    `- Verdict: **${goNoGo}**`,
    `- Auto-check status: **${autoCheckStatus}**`,
    "",
    "## Evidence Links",
    "",
    `- Auto-check report: \`${autoReportPath}\``,
    `- Manual parity evidence: \`${manualParityPath}\``,
    `- Staged rollout evidence: \`${stagedRolloutPath}\``,
    `- Legacy removal prep plan: \`${legacyRemovalPlanPath}\``,
    "",
    "## Pending Checklist Items",
    ""
  ];

  if (!pendingChecklistItems.length) {
    markdown.push("- (none)");
  } else {
    pendingChecklistItems.forEach((item) => {
      markdown.push(`- [ ] ${item}`);
    });
  }

  markdown.push("", "## Go/No-Go Summary", "");
  if (goNoGo === "GO") {
    markdown.push("- All current gates are satisfied for Path A cutover signoff.");
  } else {
    blockers.forEach((item) => {
      markdown.push(`- ${item}`);
    });
  }

  const bundleText = markdown.join("\n");
  const bundleJson = {
    generatedAt,
    verdict: goNoGo,
    autoCheckStatus,
    pendingChecklistItems,
    evidence: {
      autoCheckReport: autoReportPath,
      manualParity: manualParityPath,
      stagedRollout: stagedRolloutPath,
      legacyRemovalPlan: legacyRemovalPlanPath
    },
    blockers
  };

  const bundlePath = path.resolve(outputDir, `readiness-bundle-${timestamp}.md`);
  const latestBundlePath = path.resolve(outputDir, "latest-readiness-bundle.md");
  const latestJsonPath = path.resolve(outputDir, "latest-readiness-bundle.json");
  writeText(bundlePath, bundleText);
  writeText(latestBundlePath, bundleText);
  writeText(latestJsonPath, JSON.stringify(bundleJson, null, 2));

  console.log("Path A readiness bundle generated");
  console.log(`- markdown: ${bundlePath}`);
  console.log(`- latest markdown: ${latestBundlePath}`);
  console.log(`- latest json: ${latestJsonPath}`);
  console.log(`- verdict: ${goNoGo}`);
  if (pendingChecklistItems.length) {
    console.log("- pending checklist items:");
    pendingChecklistItems.forEach((item) => {
      console.log(`  - ${item}`);
    });
  }

  process.exit(goNoGo === "GO" ? 0 : 1);
}

main();
