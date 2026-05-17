#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function getUncheckedChecklistItems(markdown) {
  return String(markdown || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- [ ] "))
    .map((line) => line.replace("- [ ] ", "").trim());
}

function isPostSignoffItem(item) {
  const text = String(item || "").toLowerCase();
  return text.includes("after signoff");
}

function inferAutoCheckStatus(reportText) {
  const text = String(reportText || "");
  if (text.includes("Overall: PASS")) return "PASS";
  if (text.includes("Overall: FAIL")) return "FAIL";
  return "UNKNOWN";
}

function main() {
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const checklistPath = path.resolve(repoRoot, "JB_C/path-a/docs/migration-checklist.md");
  const reportPath = path.resolve(repoRoot, "JB_C/path-a/artifacts/auto-cutover-check/latest-report.md");

  const checklist = readText(checklistPath);
  const unchecked = getUncheckedChecklistItems(checklist).filter((item) => !isPostSignoffItem(item));

  let autoCheckStatus = "UNKNOWN";
  if (fs.existsSync(reportPath)) {
    autoCheckStatus = inferAutoCheckStatus(readText(reportPath));
  }

  const ready = autoCheckStatus === "PASS" && unchecked.length === 0;
  const output = {
    generatedAt: new Date().toISOString(),
    flagshipReady: ready,
    autoCheckStatus,
    pendingChecklistItems: unchecked
  };

  console.log("Flagship Readiness Assessment");
  console.log(`- auto check status: ${autoCheckStatus}`);
  console.log(`- pending checklist items: ${unchecked.length}`);
  if (unchecked.length) {
    unchecked.forEach((item) => {
      console.log(`  - ${item}`);
    });
  }
  console.log(`- verdict: ${ready ? "FLAGSHIP_READY" : "NOT_READY"}`);
  console.log("");
  console.log(JSON.stringify(output, null, 2));

  process.exit(ready ? 0 : 1);
}

main();
