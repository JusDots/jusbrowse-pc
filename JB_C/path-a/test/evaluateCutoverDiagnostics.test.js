const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildNextStepChecklist,
  collectManualPendingItems,
  dedupeChecklistItems,
  evaluateRegression,
  partitionAutomatedChecks
} = require("../scripts/evaluate-cutover-diagnostics");

test("partitionAutomatedChecks separates pass and pending/fail checks", () => {
  const checks = [
    { name: "A", pass: true, details: "" },
    { name: "B", pass: false, details: "" },
    { name: "C", pass: null, details: "" }
  ];
  const result = partitionAutomatedChecks(checks);
  assert.equal(result.passItems.length, 1);
  assert.equal(result.pendingOrFailItems.length, 2);
  assert.equal(result.passItems[0].name, "A");
});

test("collectManualPendingItems merges unchecked and pending sections", () => {
  const checklistMarkdown = [
    "# Checklist",
    "- [ ] Do staged rollout",
    "### Pending Before Cutover",
    "- Run signoff",
    "### Another Section",
    "- not included"
  ].join("\n");
  const readinessMarkdown = [
    "# Readiness",
    "### Pending",
    "- Validate rollback switch",
    "### Exit Condition",
    "- not included"
  ].join("\n");
  const items = collectManualPendingItems({ checklistMarkdown, readinessMarkdown });
  assert.deepEqual(items, ["Do staged rollout", "Run signoff", "Validate rollback switch"]);
});

test("dedupeChecklistItems removes near-duplicate manual tasks", () => {
  const deduped = dedupeChecklistItems([
    "Run staged rollout with telemetry regression checks.",
    "Staged rollout telemetry monitoring with documented signoff evidence is still pending.",
    "Execute full manual parity matrix for Google-family and non-Google scenarios.",
    "Manual verification matrix for Google-family and non-Google providers."
  ]);
  assert.equal(deduped.length, 2);
});

test("buildNextStepChecklist includes failure fix and manual tasks", () => {
  const checks = [
    { name: "Missing correlation IDs must remain 0", pass: true, details: "ok" },
    { name: "Completion success regression (max -2.0%)", pass: false, details: "failed" }
  ];
  const next = buildNextStepChecklist({
    checks,
    manualPendingItems: ["Run staged rollout"],
    hasBaseline: true
  });
  assert.ok(next.includes("Fix automated threshold failures listed in this report."));
  assert.ok(next.includes("Run staged rollout"));
});

test("evaluateRegression marks baseline-dependent checks as N/A without baseline", () => {
  const current = {
    missingCorrelationCount: 0,
    duplicateFlowIdCount: 0,
    invalidTelemetry: 0,
    completedCount: 1,
    blockedGoogleCount: 0,
    leftAuthCount: 0
  };
  const checks = evaluateRegression(current, null);
  assert.equal(checks.filter((check) => check.pass == null).length, 3);
  assert.equal(checks.filter((check) => check.pass === true).length, 3);
});
