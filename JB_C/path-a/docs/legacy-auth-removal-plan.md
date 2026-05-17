# Path A Legacy Auth Removal Plan (Post-Signoff)

This plan prepares legacy auth path cleanup without changing runtime behavior today.

## Scope and Guardrails

- No deletion before all cutover gates are marked pass.
- Remove in small reversible stages, one runtime concern at a time.
- Keep `patha:get-auth-diagnostics` available through the cleanup window.
- Use one release window per stage with rollback validation before moving forward.

## Legacy Runtime Surfaces Targeted for Removal

Primary file: `electron/main.js`

1) Legacy flow bookkeeping and trace buffering:
- `legacyAuthFlowByTabId`
- `legacyAuthTrace`
- `MAX_LEGACY_AUTH_TRACE`
- `pushLegacyAuthTrace()`
- `createLegacyFlowId()`

2) Legacy bridge orchestration wrappers:
- `isAuthBridgeUrl()`
- `ensureLegacyBridgeFlow()`
- `bridgeAuthNavigation()`
- `finalizeAllLegacyFlows()`

3) Legacy diagnostics IPC endpoint:
- `ipcMain.handle("authflow:get-trace", ...)`

4) Remaining legacy cancel/fail emissions:
- `onLegacyFlowCancelled` invocations tied to tab/window close cleanup
- `onLegacyFlowFailed` invocations tied to runtime load failures

## Reversible Stage Plan

### Stage 0 - Signoff Prereq (No Runtime Change)

- Confirm pass state for:
  - manual parity matrix
  - staged rollout checkpoints
  - auto-check report
  - runtime owner + QA signoff
- Freeze and archive diagnostics evidence in `JB_C/path-a/artifacts/signoff`.

### Stage 1 - Read-Only Legacy Trace Retirement

- Keep flow lifecycle behavior unchanged.
- Remove legacy trace-only buffers and writes.
- Preserve terminal behavior and Path A diagnostics export.
- Rollback: restore trace writes only.

### Stage 2 - Legacy Flow Map Retirement

- Replace remaining `legacyAuthFlowByTabId` ownership with Path A-only flow tracking.
- Keep external behavior identical for popup/navigation/cancel/fail paths.
- Rollback: restore legacy map and bridge wrappers.

### Stage 3 - Legacy IPC Endpoint Removal

- Remove `authflow:get-trace` endpoint once downstream diagnostics consumers are migrated.
- Keep `diagnostics:export-auth` and `patha:get-auth-diagnostics` stable.
- Rollback: re-add endpoint handler only.

### Stage 4 - Final Dead Code Sweep

- Remove now-unreferenced helper functions and constants.
- Re-run Path A tests and auto-check.
- Rollback: revert this stage commit only.

## Exit Checks Per Stage

- `npm test`
- `npm run patha:auto-check`
- `npm run patha:flagship-ready` (expected failure until all manual gates close)
- Verify auth flows: start, navigate, reject, complete, leave-domain, close, fail

## Not In Scope

- Deleting baseline folders.
- Reworking Electron tab/runtime architecture.
- Policy changes that alter current auth behavior.
