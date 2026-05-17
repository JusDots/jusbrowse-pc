# Path A Execution-Only Runbook

Use this when you want the fastest end-to-end readiness execution loop with minimal context switching.

## Sign-in behavior (production-safe)

- Non-Google providers continue through `managed-tab`.
- Google-family providers use external browser OAuth (Auth Code + PKCE).
- JusBrowse shows a non-blocking in-app notice when Google flow is handed off: `Google sign-in continues in your default browser.`
- Callback target defaults to loopback localhost (`http://127.0.0.1:<port>/auth/callback`) and is handled by Electron main process.
- Custom protocol callback (`jusbrowse://auth/callback`) remains supported as fallback.
- State + PKCE verifier are validated before token exchange.
- Path A correlation IDs are preserved across launch decision, in-app notice emission, launch success/failure, callback, token exchange, and terminal reason.

## 1) Refresh automated evidence

Run:

- `npm run patha:auto-check`
- `npm test`
- `npm run patha:flagship-ready`

Expected now:

- auto-check: `PASS`
- tests: all passing
- flagship-ready: `NOT_READY` until manual/staged gates are closed

## 2) Execute manual parity matrix in one session

Primary tracker:

- `JB_C/path-a/artifacts/manual-parity/latest-manual-parity.md`

Required scenario groups:

- Google-family: start/attach, navigate/reject, complete, domain-leave, close
- Non-Google: Microsoft start/attach, domain-leave, complete, generic oauth variation, unknown-domain guard
- Popup/domain variation: external-browser, managed-tab, edge leave-domain paths

For each scenario:

- Set `Result` to `PASS` or `FAIL`
- Add short notes
- If `FAIL`, add mismatch with owner + ETA

## 3) Execute staged rollout checkpoints

Primary tracker:

- `JB_C/path-a/artifacts/staged-rollout/latest-staged-rollout.md`

Checkpoints:

- Checkpoint 1: canary (<10%)
- Checkpoint 2: expanded (25-50%)
- Checkpoint 3: near-full pre-cutover

At each checkpoint, record:

- completion regression (`>= -2.0%`)
- blocked regression (`<= +5.0%`)
- left-auth-domain growth (`<= +30%`)
- missing correlation IDs (`0%`)
- duplicate terminal summaries (`0`)

Mark checkpoint result `PASS`/`FAIL`.

Fast capture command (records checkpoint + prints flagship status in same run):

- `npm run patha:rollout-checkpoint -- canary JB_C/path-a/artifacts/auto-cutover-check/latest-current.json --baseline JB_C/path-a/artifacts/auto-cutover-check/latest-baseline.json`

## 4) Refresh signoff bundle

Run:

- `npm run patha:bundle-readiness`
- `npm run patha:flagship-ready`

Outputs:

- `JB_C/path-a/artifacts/signoff/latest-readiness-bundle.md`
- `JB_C/path-a/artifacts/signoff/latest-readiness-bundle.json`

## 5) Go/No-Go gate

Go only if all below are true:

- `latest-manual-parity.md` has no `PENDING`
- staged rollout checkpoints required for release are `PASS`
- `patha:auto-check` is `PASS`
- `patha:flagship-ready` returns `FLAGSHIP_READY`

If any gate fails:

- keep verdict `NO_GO`
- do not remove legacy runtime paths
- continue dual-run and remediate mismatches

## Troubleshooting (Linux startup + Google auth)

- If launch fails in restricted Linux environments, use `npm run start:linux-safe` (`--no-sandbox --disable-setuid-sandbox`).
- If Google OAuth does not launch, verify `JUSBROWSE_GOOGLE_OAUTH_CLIENT_ID` is set for the desktop app runtime.
- If callback is not captured, confirm system protocol registration for `jusbrowse://` and retry from a fresh app instance.
- If callback is captured but flow fails, inspect `auth.callback.received` and `auth.token.exchange.failed` in Path A diagnostics.
- Google-family sign-in state is not transferred into embedded JusBrowse webviews; complete and continue the signed-in session in your default browser.
