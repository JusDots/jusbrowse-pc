# Path A Cutover Readiness Criteria

This document defines must-pass gates before removing legacy auth orchestration logic from runtime paths.

## 1) Deterministic Lifecycle Finalization (Must Pass)

- Every dual-run auth flow reaches exactly one terminal state in Path A.
- Required terminal scenarios are verified:
  - `provider-rejected-embedded`
  - `token-observed` success
  - `left-auth-domain`
  - `tab-closed` / `window-closed`
  - `network-error` (`did-fail-load`)
- No duplicate terminal transitions are emitted for the same `flowId`.
- Stale legacy-to-PathA mapping entries are TTL-pruned without memory growth.

## 2) Diagnostics and Export Integrity (Must Pass)

- About page diagnostics render without runtime errors under normal browsing.
- "Copy diagnostics JSON" exports valid JSON that includes:
  - app/system metadata (`version`, `electron`, `chromium`, `os`, `kernel`, `time`)
  - legacy summary and trace
  - Path A active flows and telemetry
- Export works repeatedly in the same session and reports user-visible success/failure state.

## 3) Automated Validation Baseline (Must Pass)

- Unit tests pass for:
  - state machine valid/invalid transitions
  - provider compatibility policy resolution
  - Path A broker blocked and token completion behavior
- Tests run in CI/local via project script with no manual setup.

## 4) Parity and Regression Confidence (Must Pass)

- Manual parity matrix completed for Google-family and non-Google providers.
- No user-visible regression in popup flow behavior relative to legacy path.
- Any mismatch is documented with owner, rollback trigger, and remediation plan.

## 5) Rollout and Rollback Controls (Must Pass)

- Cutover plan defines staged exposure and telemetry checkpoints.
- Rollback switch and procedure are documented and tested.
- Signoff captured from runtime owner and QA lead before legacy path deletion.

Practical staged checkpoints:

- `Checkpoint 0`: local dry-run automation (`patha:auto-check`) with baseline comparison.
- `Checkpoint 1`: canary cohort (<10% traffic or internal users) with threshold checks.
- `Checkpoint 2`: expanded cohort (25-50%) with repeated threshold checks.
- `Checkpoint 3`: near-full cohort validation before final signoff.

## Rollback Trigger Conditions (Must Pass)

Rollback to legacy orchestration must be triggered when any condition below is met for two consecutive telemetry windows (or immediately for severity-1 incidents):

- Terminal parity mismatch rate (`PathA terminal reason` vs expected legacy outcome) exceeds **1.0%**.
- `provider-rejected-embedded` flows occur outside expected Google-family scenarios.
- `left-auth-domain` cancellations increase by more than **30%** against baseline for the same provider cohort.
- Diagnostics export or grouped diagnostics payload fails schema parse in production sampling.
- Auth completion success rate drops by **2.0%** or more relative to baseline.

## Telemetry Regression Thresholds

- `auth.flow.completed` success (`terminalState=completed`) should remain within **-2.0%** of baseline.
- `auth.flow.blocked` for Google-family should not exceed baseline by more than **+5.0%**.
- `auth.flow.completed` with `reason=left-auth-domain` should not exceed baseline by more than **+30%**.
- Missing `correlationId` on auth telemetry events must remain at **0%**.
- Duplicate terminal summaries for a single `flowId` must remain at **0**.

## Completed vs Pending Cutover Blockers

### Completed

- Deterministic terminal handling for blocked/token/left-domain/close/fail paths.
- TTL cleanup for stale legacy-to-PathA flow id mappings.
- Terminal summary persistence with grouped diagnostics by flow id and terminal reason.
- Correlation id propagation across popup/open/redirect/finalize telemetry lifecycle.
- Telemetry schema validation surfaced in diagnostics and export payloads.
- Automated integration fixture for embedded-policy rejection path.

### Pending

- Remove redundant legacy auth flow paths after signoff.

## Exit Condition

Legacy auth flow removal is allowed only when all sections above are marked pass and linked evidence (tests, logs, checklists) is attached in the release record.

Latest signoff bundle path:

- `JB_C/path-a/artifacts/signoff/latest-readiness-bundle.md`
