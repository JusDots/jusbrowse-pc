# Path A Manual Parity Matrix Checklist

Use this checklist during dual-run validation and attach evidence (screenshots/log snippets/export JSON) for each row.

Latest evidence tracker:

- `JB_C/path-a/artifacts/manual-parity/latest-manual-parity.md`

## Test Preconditions

- [ ] Dual-run mode enabled with legacy and Path A diagnostics capture.
- [ ] About diagnostics export verified at least once in current build.
- [ ] Clean session profile prepared for provider sign-in tests.

## Google-Family Scenarios

- [ ] `GF-01` Start auth from app surface -> popup intercept observed -> strategy resolves to `external-browser`.
- [ ] `GF-02` Embedded rejection URL (`/signin/rejected`) -> Path A terminal `blocked` with reason `provider-rejected-embedded`.
- [ ] `GF-03` Successful callback with token/code -> terminal `completed` with reason `token-observed`.
- [ ] `GF-04` Leave auth domain without completion token -> terminal `cancelled` with reason `left-auth-domain`.
- [ ] `GF-05` User closes auth tab/window -> terminal `cancelled` with reason `tab-closed` or `window-closed`.
- [ ] `GF-06` Network/load failure (`did-fail-load`) -> terminal `failed` with reason `network-error`.

## Non-Google Scenarios (Microsoft + Generic OAuth)

- [ ] `NG-01` Microsoft authorize URL (`login.microsoftonline.com`) stays in managed-tab policy.
- [ ] `NG-02` Microsoft flow leaves auth domain without token -> terminal `cancelled` with reason `left-auth-domain`.
- [ ] `NG-03` Microsoft successful callback with token/code -> terminal `completed` with reason `token-observed`.
- [ ] `NG-04` Generic OAuth provider (`auth/login/oauth` host pattern) follows managed-tab policy.
- [ ] `NG-05` Unknown provider domain without auth-host match does not false-trigger `left-auth-domain` cancel.

## Diagnostics and Correlation Validation

- [ ] Every flow row records stable `correlationId` across popup, redirect, and finalize telemetry events.
- [ ] Final summary is present by `flowId` with `terminalState`, `reason`, `finalUrl`, and timestamps.
- [ ] Grouped diagnostics include entries under both `byFlowId` and `byTerminalReason`.

## Signoff

- [ ] Runtime owner reviewed all matrix evidence.
- [ ] QA lead verified no user-visible auth regression against baseline.
- [ ] Outstanding mismatches captured with owner and remediation ETA.
- [ ] All rows in `latest-manual-parity.md` are updated from `PENDING` to `PASS`/`FAIL`.

## Quick Auto-Check (Optional but Recommended)

After exporting diagnostics JSON files from the About page, run:

- `npm run patha:check-cutover -- <current-run.json>`
- `npm run patha:check-cutover -- <current-run-1.json> <current-run-2.json> --baseline <baseline-run-1.json> <baseline-run-2.json>`
- `npm run patha:auto-check` (generates baseline/current files automatically, then runs checker)

What this gives you:

- PASS/FAIL for hard gates (`missing correlation id`, `duplicate flow ids`, `invalid telemetry`).
- Baseline-relative threshold checks for completion/block/left-domain regressions when baseline files are provided.
- Auto mode writes generated diagnostics under `JB_C/path-a/artifacts/auto-cutover-check`.
- Auto mode also writes a readable report at `JB_C/path-a/artifacts/auto-cutover-check/latest-report.md`.
- Readiness verdict command: `npm run patha:flagship-ready`.
