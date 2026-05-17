# Electron Bridge Integration Notes (Phase 2)

This document defines how to wire existing `AuthFlowManager` events to the
new Path A bridge without changing runtime behavior.

## Bridge Object

- Import: `path-a/src/adapters/electron/ElectronAuthFlowBridge.js`
- Instantiate once in `electron/main.js` startup:
  - `const pathABridge = new ElectronAuthFlowBridge();`

## Event Mapping from Legacy Manager

### Popup Intercept

Call `pathABridge.onLegacyPopupIntercepted(...)` when legacy manager starts a flow.

Required payload:
- `legacyFlowId`
- `sourceTabId`
- `openerUrl`
- `targetUrl`
- `disposition`
- `tabId` (managed tab id, if created)
- `routeType` (`managed-tab` or `external-browser`)

For Google-family providers (`external-browser`), prepare external PKCE context:

- `prepareLegacyExternalAuth(...)` to create state + PKCE verifier/challenge
- open system browser with Google authorization URL (Auth Code + PKCE)
- `onLegacyExternalAuthLaunch(...)` to emit launch telemetry with correlation ID
- emit an in-app, non-blocking notice to renderer: `Google sign-in continues in your default browser.`
- record user-visible notice telemetry via `onLegacyExternalNoticeEmitted(...)`
- record launch result telemetry via `onLegacyExternalLaunchResult(...)` with success/failure + terminal reason hints

### Navigation/Redirect

Call `pathABridge.onLegacyNavigationEvent(...)` from each navigation hook.

Required payload:
- `legacyFlowId`
- `url`
- `eventName` (`did-navigate`, `did-navigate-in-page`, `did-redirect-navigation`)

### Flow Completion / Cancellation / Failure

Call one of:
- `onLegacyFlowCompleted`
- `onLegacyFlowCancelled`
- `onLegacyFlowFailed`

Required payload:
- `legacyFlowId`
- `reason`

## External callback + token exchange mapping

For Google-family callback (default loopback `http://127.0.0.1:<port>/auth/callback`, fallback `jusbrowse://auth/callback`):

- call `onLegacyExternalCallback(...)` with `callbackUrl`, `state`, `code`, `error`
- callback handler validates state + PKCE presence before token exchange
- perform token exchange in Electron main process
- call `onLegacyExternalTokenExchange(...)` with `success` and endpoint/error metadata
- then call terminal bridge event (`onLegacyFlowCompleted`/`onLegacyFlowFailed`/`onLegacyFlowCancelled`)
- callback acknowledgement notice is optional and must not imply in-app cookie/session transfer for Google-family providers

## Diagnostics Endpoint (Optional)

Expose bridge diagnostics through IPC:

- `ipcMain.handle("patha:get-auth-diagnostics", (_, limit) => pathABridge.getDiagnostics(limit));`

This can run in parallel with existing `authflow:get-trace`.
