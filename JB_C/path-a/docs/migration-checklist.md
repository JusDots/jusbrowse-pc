# Path A Migration Checklist (Electron Flow -> Flagship Architecture)

## A) Kickoff Scaffold

- [x] Create isolated Path A folder structure under `JB_C/path-a`.
- [x] Add architecture boundaries and migration phases document.
- [x] Add provider-agnostic `AuthBroker` contract.
- [x] Add auth flow state machine skeleton with explicit reason codes.
- [x] Add telemetry schema for auth/redirect/popup orchestration.
- [x] Add provider compatibility policy resolver.

## B) Legacy Bridge Preparation

- [x] Map existing `AuthFlowManager` events to Path A telemetry event names.
- [x] Add adapter module that transforms Electron events into state machine inputs.
- [x] Emit both legacy trace and Path A telemetry in dual-run mode.
- [x] Add deterministic terminal finalization for nav reject/success/left-domain/close/fail paths.
- [x] Add automated integration fixture for embedded-policy rejection path in bridge flow.
- [x] Validate parity for start/attach/nav/reject/complete scenarios via full manual matrix.

## C) Provider Strategy Migration

- [x] Replace direct Google-specific branching with compatibility-policy lookups.
- [x] Route popup decisions via policy output (`allow-embedded`, `managed-tab`, `external-browser`).
- [x] Ensure provider-blocked flows terminate with explicit terminal reason.

## D) Deterministic Completion Guarantees

- [x] Enforce transition validation for all flow lifecycle operations.
- [x] Block duplicate terminal transitions for the same flow id.
- [x] Capture and persist final terminal summary (`state`, `reason`, `finalUrl`, timestamps).
- [x] Add TTL cleanup for stale legacy-to-PathA flow mappings.

## E) Telemetry and Diagnostics

- [x] Wire schema validator before telemetry publish and expose validation summary in diagnostics.
- [x] Add correlation ids across popup/open/redirect/finalize lifecycle events.
- [x] Expose diagnostics export JSON with runtime metadata + legacy + Path A payloads.
- [x] Expose filtered diagnostics view grouped by flow id and terminal reason.

## F) Testing / Validation Gates

- [x] Unit tests for state transitions and invalid transition rejection.
- [x] Unit tests for compatibility policy host/provider resolution.
- [x] Unit tests for PathAAuthBroker blocked + token completion behaviors.
- [x] Integration test fixture for embedded-policy rejection path.
- [x] Add left-auth-domain edge-case coverage for non-Google auth domains.
- [x] Manual verification matrix for Google-family and non-Google providers.

## G) Cutover Readiness

- [x] Establish parity criteria, rollback trigger conditions, and telemetry regression thresholds.
- [x] Run staged rollout with telemetry regression checks.
- [x] Prepare reversible legacy auth removal plan (no runtime deletion before signoff).
- [ ] Remove redundant legacy auth flow paths after signoff.

## Cutover Blockers Snapshot

### Completed This Phase

- Embedded-policy rejection integration fixture is automated.
- Terminal summary persistence by `flowId` is stored in diagnostics output.
- Correlation ids are emitted across popup/open/redirect/finalize telemetry lines.
- Grouped diagnostics now include both `byFlowId` and `byTerminalReason`.
- Parity and rollback artifacts exist (`parity-matrix-checklist.md`, `cutover-readiness-criteria.md`).

### Pending Before Cutover

- Remove redundant legacy auth flow paths after signoff.

## Evidence Artifacts (Latest)

- Auto-check report: `JB_C/path-a/artifacts/auto-cutover-check/latest-report.md`
- Manual parity evidence: `JB_C/path-a/artifacts/manual-parity/latest-manual-parity.md`
- Staged rollout evidence: `JB_C/path-a/artifacts/staged-rollout/latest-staged-rollout.md`
- Readiness bundle: `JB_C/path-a/artifacts/signoff/latest-readiness-bundle.md`
- Fast runbook: `JB_C/path-a/docs/execution-only-runbook.md`
- Strict signoff checklist: `JB_C/path-a/docs/release-signoff-checklist.md`
