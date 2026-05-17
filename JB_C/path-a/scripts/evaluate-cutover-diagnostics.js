#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const EXIT_OK = 0;
const EXIT_FAIL = 1;

function usage() {
  return [
    "Usage:",
    "  node JB_C/path-a/scripts/evaluate-cutover-diagnostics.js <current.json> [more-current.json ...] [--baseline <baseline.json> [more-baseline.json ...]]",
    "",
    "Examples:",
    "  node JB_C/path-a/scripts/evaluate-cutover-diagnostics.js run-1.json",
    "  node JB_C/path-a/scripts/evaluate-cutover-diagnostics.js run-1.json run-2.json --baseline baseline-1.json baseline-2.json"
  ].join("\n");
}

function parseArgs(argv) {
  const args = Array.isArray(argv) ? argv : [];
  const baselineFlagIndex = args.indexOf("--baseline");
  if (baselineFlagIndex === 0) {
    throw new Error("At least one current diagnostics JSON file is required before --baseline.");
  }
  const currentFiles = baselineFlagIndex === -1 ? args : args.slice(0, baselineFlagIndex);
  const baselineFiles = baselineFlagIndex === -1 ? [] : args.slice(baselineFlagIndex + 1);
  if (!currentFiles.length) {
    throw new Error("At least one current diagnostics JSON file is required.");
  }
  return { currentFiles, baselineFiles };
}

function readJson(filePath) {
  const absolute = path.resolve(filePath);
  const raw = fs.readFileSync(absolute, "utf8");
  const parsed = JSON.parse(raw);
  return { absolute, parsed };
}

function toPct(changeRatio) {
  if (!Number.isFinite(changeRatio)) return "n/a";
  return `${(changeRatio * 100).toFixed(2)}%`;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function readOptionalText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function getUncheckedChecklistItems(markdown) {
  return String(markdown || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- [ ] "))
    .map((line) => line.replace("- [ ] ", "").trim())
    .filter(Boolean);
}

function getSectionBulletItems(markdown, heading) {
  const lines = String(markdown || "").split("\n");
  const normalizedHeading = String(heading || "").trim().toLowerCase();
  let inSection = false;
  const items = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!inSection) {
      if (line.toLowerCase() === normalizedHeading) {
        inSection = true;
      }
      continue;
    }
    if (line.startsWith("#")) break;
    if (line.startsWith("- ")) {
      items.push(line.slice(2).trim());
    }
  }
  return items.filter(Boolean);
}

function normalizeChecklistText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeChecklistText(value) {
  const stopWords = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "before",
    "for",
    "is",
    "of",
    "or",
    "still",
    "the",
    "to",
    "via",
    "with"
  ]);
  return normalizeChecklistText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

function areChecklistItemsSimilar(left, right) {
  const leftTokens = new Set(tokenizeChecklistText(left));
  const rightTokens = new Set(tokenizeChecklistText(right));
  if (!leftTokens.size || !rightTokens.size) return false;
  const overlap = Array.from(leftTokens).filter((token) => rightTokens.has(token)).length;
  const ratioAgainstShorter = overlap / Math.min(leftTokens.size, rightTokens.size);
  return ratioAgainstShorter >= 0.5;
}

function dedupeChecklistItems(items) {
  const unique = [];
  const normalizedSeen = [];
  for (const rawItem of safeArray(items)) {
    const item = String(rawItem || "").trim();
    if (!item) continue;
    const normalized = normalizeChecklistText(item);
    if (!normalized) continue;
    const isCovered = normalizedSeen.some(
      (seen) => seen === normalized || seen.includes(normalized) || normalized.includes(seen)
    );
    if (isCovered) continue;
    if (unique.some((existing) => areChecklistItemsSimilar(existing, item))) continue;
    unique.push(item);
    normalizedSeen.push(normalized);
  }
  return unique;
}

function collectManualPendingItems({ checklistMarkdown, readinessMarkdown }) {
  const uncheckedChecklist = getUncheckedChecklistItems(checklistMarkdown);
  const migrationPending = getSectionBulletItems(checklistMarkdown, "### Pending Before Cutover");
  const readinessPending = getSectionBulletItems(readinessMarkdown, "### Pending");
  return dedupeChecklistItems([...uncheckedChecklist, ...migrationPending, ...readinessPending]);
}

function computeMetrics(entries) {
  const telemetry = [];
  const summaries = [];
  let invalidTelemetry = 0;
  const violations = [];

  for (const entry of entries) {
    const pathA = entry?.parsed?.pathA && typeof entry.parsed.pathA === "object" ? entry.parsed.pathA : {};
    telemetry.push(...safeArray(pathA.telemetry));
    summaries.push(...safeArray(pathA.terminalSummaries));
    const validation = pathA.telemetryValidation && typeof pathA.telemetryValidation === "object"
      ? pathA.telemetryValidation
      : {};
    invalidTelemetry += Number(validation.invalidEvents || 0);
    violations.push(...safeArray(validation.violations));
  }

  const completedCount = summaries.filter((s) => s?.terminalState === "completed").length;
  const blockedGoogleCount = summaries.filter(
    (s) => s?.terminalState === "blocked" && s?.providerKey === "google-family"
  ).length;
  const leftAuthCount = summaries.filter((s) => s?.reason === "left-auth-domain").length;
  const missingCorrelationTelemetryCount = telemetry.filter(
    (event) => !String(event?.payload?.correlationId || "").trim()
  ).length;
  const missingCorrelationSummaryCount = summaries.filter((summary) => !String(summary?.correlationId || "").trim())
    .length;
  const duplicateFlowIdCount = (() => {
    const seen = new Set();
    let duplicates = 0;
    for (const summary of summaries) {
      const flowId = String(summary?.flowId || "");
      if (!flowId) continue;
      if (seen.has(flowId)) {
        duplicates += 1;
      } else {
        seen.add(flowId);
      }
    }
    return duplicates;
  })();

  return {
    files: entries.length,
    telemetryEvents: telemetry.length,
    terminalSummaries: summaries.length,
    completedCount,
    blockedGoogleCount,
    leftAuthCount,
    missingCorrelationCount: missingCorrelationTelemetryCount + missingCorrelationSummaryCount,
    duplicateFlowIdCount,
    invalidTelemetry,
    violations
  };
}

function evaluateRegression(current, baseline) {
  const hasBaseline = Boolean(baseline);
  const checks = [];

  checks.push({
    name: "Missing correlation IDs must remain 0",
    pass: current.missingCorrelationCount === 0,
    details: `current=${current.missingCorrelationCount}, threshold=0`
  });
  checks.push({
    name: "Duplicate terminal summaries must remain 0",
    pass: current.duplicateFlowIdCount === 0,
    details: `current=${current.duplicateFlowIdCount}, threshold=0`
  });
  checks.push({
    name: "Invalid telemetry events must remain 0",
    pass: current.invalidTelemetry === 0,
    details: `current=${current.invalidTelemetry}, threshold=0`
  });

  if (!hasBaseline) {
    checks.push({
      name: "Completion success regression (max -2.0%)",
      pass: null,
      details: "N/A (no baseline provided)"
    });
    checks.push({
      name: "Google blocked regression (max +5.0%)",
      pass: null,
      details: "N/A (no baseline provided)"
    });
    checks.push({
      name: "Left-auth-domain regression (max +30.0%)",
      pass: null,
      details: "N/A (no baseline provided)"
    });
    return checks;
  }

  const completionRatio = baseline.completedCount === 0
    ? current.completedCount === 0
      ? 0
      : Number.POSITIVE_INFINITY
    : (current.completedCount - baseline.completedCount) / baseline.completedCount;
  const blockedRatio = baseline.blockedGoogleCount === 0
    ? current.blockedGoogleCount === 0
      ? 0
      : Number.POSITIVE_INFINITY
    : (current.blockedGoogleCount - baseline.blockedGoogleCount) / baseline.blockedGoogleCount;
  const leftAuthRatio = baseline.leftAuthCount === 0
    ? current.leftAuthCount === 0
      ? 0
      : Number.POSITIVE_INFINITY
    : (current.leftAuthCount - baseline.leftAuthCount) / baseline.leftAuthCount;

  checks.push({
    name: "Completion success regression (max -2.0%)",
    pass: completionRatio >= -0.02,
    details: `change=${toPct(completionRatio)}, baseline=${baseline.completedCount}, current=${current.completedCount}`
  });
  checks.push({
    name: "Google blocked regression (max +5.0%)",
    pass: blockedRatio <= 0.05,
    details: `change=${toPct(blockedRatio)}, baseline=${baseline.blockedGoogleCount}, current=${current.blockedGoogleCount}`
  });
  checks.push({
    name: "Left-auth-domain regression (max +30.0%)",
    pass: leftAuthRatio <= 0.3,
    details: `change=${toPct(leftAuthRatio)}, baseline=${baseline.leftAuthCount}, current=${current.leftAuthCount}`
  });
  return checks;
}

function partitionAutomatedChecks(checks) {
  const passItems = checks.filter((check) => check.pass === true);
  const pendingOrFailItems = checks.filter((check) => check.pass !== true);
  return { passItems, pendingOrFailItems };
}

function buildNextStepChecklist({ checks, manualPendingItems, hasBaseline }) {
  const items = [];
  const failedChecks = checks.filter((check) => check.pass === false);
  const nAItems = checks.filter((check) => check.pass == null);
  if (failedChecks.length) {
    items.push("Fix automated threshold failures listed in this report.");
  }
  if (!hasBaseline || nAItems.length) {
    items.push("Run diagnostics with a valid baseline file to unlock regression comparisons.");
  }
  manualPendingItems.forEach((item) => {
    items.push(item);
  });
  if (!items.length) {
    items.push("Prepare cutover signoff package with this report, baseline evidence, and release notes.");
  }
  return Array.from(new Set(items));
}

function printMetrics(title, metrics) {
  console.log(`\n${title}`);
  console.log(`  files: ${metrics.files}`);
  console.log(`  telemetry events: ${metrics.telemetryEvents}`);
  console.log(`  terminal summaries: ${metrics.terminalSummaries}`);
  console.log(`  completed terminals: ${metrics.completedCount}`);
  console.log(`  google blocked terminals: ${metrics.blockedGoogleCount}`);
  console.log(`  left-auth-domain terminals: ${metrics.leftAuthCount}`);
  console.log(`  missing correlation IDs: ${metrics.missingCorrelationCount}`);
  console.log(`  duplicate flow IDs: ${metrics.duplicateFlowIdCount}`);
  console.log(`  invalid telemetry events: ${metrics.invalidTelemetry}`);
}

function printChecks(checks) {
  console.log("\nThreshold checks:");
  for (const check of checks) {
    const status = check.pass == null ? "N/A " : check.pass ? "PASS" : "FAIL";
    console.log(`  [${status}] ${check.name} -> ${check.details}`);
  }
}

function printAutomatedSections(checks) {
  const { passItems, pendingOrFailItems } = partitionAutomatedChecks(checks);
  console.log("\nAutomated pass items:");
  if (!passItems.length) {
    console.log("  (none)");
  } else {
    passItems.forEach((check) => {
      console.log(`  - ${check.name}`);
    });
  }

  console.log("\nAutomated pending/fail items:");
  if (!pendingOrFailItems.length) {
    console.log("  (none)");
  } else {
    pendingOrFailItems.forEach((check) => {
      const status = check.pass == null ? "N/A" : "FAIL";
      console.log(`  - [${status}] ${check.name} -> ${check.details}`);
    });
  }
}

function printManualPendingSection(items) {
  console.log("\nManual-only pending items:");
  if (!items.length) {
    console.log("  (none)");
    return;
  }
  items.forEach((item) => {
    console.log(`  - ${item}`);
  });
}

function printNextSteps(items) {
  console.log("\nWhat to do next:");
  items.forEach((item) => {
    console.log(`  - [ ] ${item}`);
  });
}

function main() {
  try {
    const { currentFiles, baselineFiles } = parseArgs(process.argv.slice(2));
    const currentEntries = currentFiles.map(readJson);
    const baselineEntries = baselineFiles.map(readJson);
    const currentMetrics = computeMetrics(currentEntries);
    const baselineMetrics = baselineEntries.length ? computeMetrics(baselineEntries) : null;
    const checks = evaluateRegression(currentMetrics, baselineMetrics);
    const repoRoot = path.resolve(__dirname, "..", "..", "..");
    const checklistPath = path.resolve(repoRoot, "JB_C/path-a/docs/migration-checklist.md");
    const readinessPath = path.resolve(repoRoot, "JB_C/path-a/docs/cutover-readiness-criteria.md");
    const manualPendingItems = collectManualPendingItems({
      checklistMarkdown: readOptionalText(checklistPath),
      readinessMarkdown: readOptionalText(readinessPath)
    });
    const nextSteps = buildNextStepChecklist({
      checks,
      manualPendingItems,
      hasBaseline: Boolean(baselineMetrics)
    });
    const hardFailures = checks.some((check) => check.pass === false);

    console.log("Path A Cutover Diagnostics Evaluation");
    printMetrics("Current diagnostics aggregate", currentMetrics);
    if (baselineMetrics) {
      printMetrics("Baseline diagnostics aggregate", baselineMetrics);
    } else {
      console.log("\nBaseline diagnostics aggregate");
      console.log("  not provided");
    }
    printChecks(checks);
    printAutomatedSections(checks);
    printManualPendingSection(manualPendingItems);
    printNextSteps(nextSteps);

    if (currentMetrics.violations.length) {
      console.log("\nTelemetry schema violations:");
      currentMetrics.violations.slice(0, 20).forEach((violation) => {
        const eventName = violation?.eventName || "unknown";
        const missing = safeArray(violation?.missing).join(", ");
        console.log(`  - index=${violation?.index ?? "?"}, event=${eventName}, missing=${missing || "n/a"}`);
      });
      if (currentMetrics.violations.length > 20) {
        console.log(`  ... and ${currentMetrics.violations.length - 20} more`);
      }
    }

    console.log(`\nOverall: ${hardFailures ? "FAIL" : "PASS"}`);
    process.exit(hardFailures ? EXIT_FAIL : EXIT_OK);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.error("");
    console.error(usage());
    process.exit(EXIT_FAIL);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  areChecklistItemsSimilar,
  buildNextStepChecklist,
  collectManualPendingItems,
  computeMetrics,
  dedupeChecklistItems,
  evaluateRegression,
  getSectionBulletItems,
  getUncheckedChecklistItems,
  normalizeChecklistText,
  parseArgs,
  partitionAutomatedChecks
};
