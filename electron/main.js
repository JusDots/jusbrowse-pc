const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");
const os = require("os");
const http = require("http");
const https = require("https");
const {
  app,
  BrowserWindow,
  BrowserView,
  ipcMain,
  dialog,
  Menu,
  clipboard,
  shell,
  webFrameMain,
  session
} = require("electron");
const { ElectronAuthFlowBridge } = require("../JB_C/path-a/src/adapters/electron/ElectronAuthFlowBridge");
const { resolveProviderPolicy } = require("../JB_C/path-a/src/compatibility/providerCompatibilityPolicy");
const { MAIN_WORLD_SPOOF_SCRIPT, CHROME_FULL, CHROME_MAJOR } = require("./mainWorldSpoof");
const { BrowserContext } = require("./browserContext");
const { AdblockManager } = require("./adblock");

const DEFAULT_HOME = "about:blank";

// Strip the embedded-browser fingerprints that providers like Google use to reject sign-in.
// These must run before app.whenReady() and before any BrowserWindow is created.
//
// Note: previous builds also enabled `enable-zero-copy` and `ignore-gpu-blocklist`, but on
// Linux integrated GPUs (esp. Intel/iGPU with stale VAAPI) those flags caused HTML5 video
// to render a fully-transparent surface (only audio audible) once hardware video decoding
// kicked in after page load. We rely on Chromium's default GPU policy now and explicitly
// pin the video decoder to a path that's known to render correctly on the widest set of
// Linux hosts. If a user hits driver issues they can always set ELECTRON_DISABLE_GPU=1.
app.commandLine.appendSwitch("disable-blink-features", "AutomationControlled");
if (process.platform === "linux") {
  // Comma-joined feature list. UseChromeOSDirectVideoDecoder is the feature that broke HTML5
  // video on most Linux iGPU drivers (frame surface goes transparent while audio decode
  // continues). Pinning Vaapi to the GL path fixes it on Intel/AMD without regressing
  // hardware decoding on healthy hosts. OverlayScrollbar stays a cosmetic win.
  app.commandLine.appendSwitch("enable-features", "OverlayScrollbar,VaapiVideoDecodeLinuxGL");
  app.commandLine.appendSwitch("disable-features", "UseChromeOSDirectVideoDecoder");
} else {
  app.commandLine.appendSwitch("enable-features", "OverlayScrollbar");
}
app.userAgentFallback =
  `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`;

let mainWindow = null;
let chromeLayout = { top: 0, bottom: 0, hideWebView: true };
let tabCounter = 0;
let activeTabId = null;
const tabs = new Map();
const tabOrder = [];
// Per-window context registry. Keyed by BrowserWindow.id. Each context holds its own tabs
// map / activeTabId so a normal window and a separate purple incognito window can run side
// by side without trampling each other's state. The wcIdToTab map is the hot-path lookup
// that replaced the linear Array.from(tabs.values()).find() scan in attachSessionHooks.
const contextsByWindowId = new Map();
const wcIdToTab = new Map();
const tabIdToContext = new Map();
let primaryWindowRef = null;
const DEFAULT_USER_AGENT =
  `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`;
const APP_VERSION_LABEL = "V2.0.0 \"Atlantis\"";
const COMPATIBILITY_HOSTS = [
  "whatsapp.com",
  "web.whatsapp.com",
  "accounts.google.com",
  "google.com",
  "youtube.com",
  "youtu.be",
  "gstatic.com",
  "googleapis.com",
  "googleusercontent.com"
];
const TRACKER_HOST_PATTERNS = [
  "doubleclick.net",
  "googlesyndication.com",
  "adservice.google.com",
  "adnxs.com",
  "facebook.net",
  "google-analytics.com",
  "googletagmanager.com",
  "taboola.com",
  "outbrain.com",
  "criteo.com",
  "scorecardresearch.com",
  "quantserve.com",
  "amazon-adsystem.com",
  "moatads.com",
  "rubiconproject.com",
  "openx.net",
  "pubmatic.com",
  "yahoo.com/p.gif",
  "yieldmo.com",
  "casalemedia.com",
  "indexww.com",
  "smartadserver.com",
  "33across.com",
  "media.net",
  "adform.net",
  "bidswitch.net",
  "spotxchange.com",
  "demdex.net",
  "everesttech.net",
  "hotjar.com",
  "mixpanel.com",
  "segment.io",
  "amplitude.com",
  "fullstory.com"
];
const TRACKER_URL_KEYWORDS = [
  "/ads/",
  "adservice",
  "analytics",
  "tracking",
  "tracker",
  "pixel",
  "beacon",
  "sponsor"
];
const COOKIE_BANNER_CSS = `
#onetrust-banner-sdk, .onetrust-pc-dark-filter, #cookie-law-info-bar, #cookie-consent, .cookie-consent,
[id*="cookie-banner"], [class*="cookie-banner"], [id*="consent-banner"], [class*="consent-banner"],
[aria-label*="cookie"], [data-testid*="cookie"] { display: none !important; visibility: hidden !important; }
`;

let runtimeSettings = {
  sendDoNotTrack: true,
  blockTrackers: true,
  advancedAdBlock: false,
  httpsOnlyMode: true,
  popupBlocker: true,
  blockCookiePopups: true,
  multiMediaPlayback: true,
  enableJavaScript: true,
  follianMode: false,
  fingerprintEngine: "default",
  follianProtocol: false,
  protectionWhitelist: "",
  screenshotProtection: false,
  customDohUrl: "",
  cacheLimitMb: 1024,
  cachePolicy: "smart",
  nuclearWipe: false,
  savePasswords: true,
  shareAnonymousAnalytics: true,
  virusTotalApiKey: "",
  koodousApiKey: ""
};
const attachedSessions = new WeakSet();
const incognitoWindows = new Set();
const sessionLastCacheCheck = new WeakMap();
const CACHE_CHECK_THROTTLE_MS = 30_000;
const IDLE_SUSPEND_MS = 5 * 60 * 1000;
let passwordDbPath = "";
let savedPasswords = [];
const pendingPasswordPrompts = new Map();
const neverSaveHosts = new Set();
// Username-only hints captured before the password page renders. Keyed by host. Hints
// expire after USERNAME_HINT_TTL_MS so a stale username never gets paired with a fresh
// password from a later session. This is what makes "Save password?" actually fire on
// real Google logins, where the identifier (email) and challenge (password) live on
// separate documents.
const usernameHintByHost = new Map();
const USERNAME_HINT_TTL_MS = 5 * 60 * 1000;
const adblockManager = new AdblockManager();
const pendingDownloadScans = new WeakSet();
let idleSweepTimer = null;
const popupAttemptGuard = new Map();
const legacyAuthFlowByTabId = new Map();
const closedTabsHistory = [];
const MAX_CLOSED_TABS_HISTORY = 25;
const pathAAuthBridge = new ElectronAuthFlowBridge();
const legacyAuthTrace = [];
const MAX_LEGACY_AUTH_TRACE = 250;
const AUTH_CALLBACK_LOOPBACK_HOST = "127.0.0.1";
const AUTH_CALLBACK_PROTOCOL = "jusbrowse";
const AUTH_CALLBACK_HOST = "auth";
const AUTH_CALLBACK_PATH = "/auth/callback";
const AUTH_CALLBACK_URI = `${AUTH_CALLBACK_PROTOCOL}://${AUTH_CALLBACK_HOST}${AUTH_CALLBACK_PATH}`;
const GOOGLE_AUTH_SCOPES = ["openid", "email", "profile"];
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const pendingExternalGoogleAuthByState = new Map();
const GOOGLE_EXTERNAL_NOTICE_MESSAGE = "Google sign-in continues in your default browser.";

function pushLegacyAuthTrace(type, payload = {}) {
  legacyAuthTrace.push({
    id: `legacy-trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    type,
    payload
  });
  if (legacyAuthTrace.length > MAX_LEGACY_AUTH_TRACE) {
    legacyAuthTrace.splice(0, legacyAuthTrace.length - MAX_LEGACY_AUTH_TRACE);
  }
}

function emitExternalAuthNotice(payload = {}) {
  const notice = {
    id: `ext-auth-notice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    providerKey: "google-family",
    noticeType: String(payload.noticeType || "info"),
    message: String(payload.message || GOOGLE_EXTERNAL_NOTICE_MESSAGE),
    legacyFlowId: String(payload.legacyFlowId || ""),
    tabId: String(payload.tabId || ""),
    correlationId: String(payload.correlationId || ""),
    terminalReason: String(payload.terminalReason || "")
  };
  if (mainWindow?.webContents && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("auth:external-notice", notice);
  }
  if (notice.legacyFlowId) {
    void pathAAuthBridge
      .onLegacyExternalNoticeEmitted({
        legacyFlowId: notice.legacyFlowId,
        noticeType: notice.noticeType,
        message: notice.message,
        channel: "toast"
      })
      .catch(() => {});
  }
  return notice;
}

function createLegacyFlowId() {
  return `legacy-auth-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isAuthBridgeUrl(url) {
  const policy = resolveProviderPolicy(String(url || ""));
  return String(policy.providerKey || "unknown") !== "unknown";
}

function isGoogleCredentialEntryUrl(url) {
  try {
    const parsed = new URL(String(url || ""));
    const host = parsed.hostname.toLowerCase();
    if (host !== "accounts.google.com" && !host.endsWith(".accounts.google.com")) return false;
    const pathName = parsed.pathname.toLowerCase();
    return (
      pathName.includes("/signin") ||
      pathName.includes("/servicelogin") ||
      pathName.includes("/identifier") ||
      pathName.startsWith("/o/oauth2/") ||
      pathName.startsWith("/device/")
    );
  } catch {
    return false;
  }
}

function ensureLegacyBridgeFlow(tabId, context = {}) {
  if (!tabId) return null;
  const existing = legacyAuthFlowByTabId.get(tabId);
  if (existing) return existing;
  const targetUrl = String(context.targetUrl || "");
  const fallbackUrl = targetUrl || String(context.openerUrl || "");
  const policy = resolveProviderPolicy(fallbackUrl);
  const routeType = String(context.routeType || policy.popupStrategy || "navigation-observed");
  const legacyFlowId = createLegacyFlowId();
  legacyAuthFlowByTabId.set(tabId, legacyFlowId);
  pushLegacyAuthTrace("legacy-flow-start", {
    legacyFlowId,
    tabId,
    targetUrl,
    openerUrl: context.openerUrl || "",
    routeType,
    providerKey: policy.providerKey || "unknown"
  });
  void pathAAuthBridge.onLegacyPopupIntercepted({
    legacyFlowId,
    sourceTabId: tabId,
    openerUrl: String(context.openerUrl || ""),
    targetUrl,
    disposition: context.disposition || "",
    tabId: tabId,
    routeType,
    incognito: Boolean(context.incognito)
  });
  return legacyFlowId;
}

function bridgeAuthNavigation(tabId, url, eventName) {
  if (!tabId) return;
  const existingFlowId = legacyAuthFlowByTabId.get(tabId);
  if (!existingFlowId && !isAuthBridgeUrl(url)) return;
  const legacyFlowId =
    existingFlowId ||
    ensureLegacyBridgeFlow(tabId, {
      targetUrl: url,
      routeType: "navigation-observed"
    });
  if (!legacyFlowId) return;
  pushLegacyAuthTrace("legacy-flow-navigation", {
    legacyFlowId,
    tabId,
    eventName,
    url
  });
  void pathAAuthBridge.onLegacyNavigationEvent({
    legacyFlowId,
    url,
    eventName
  });
}

function getGoogleOAuthClientId() {
  return String(process.env.JUSBROWSE_GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID || "").trim();
}

function buildGoogleAuthorizationUrl({ clientId, redirectUri, state, codeChallenge }) {
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", String(clientId || ""));
  authUrl.searchParams.set("redirect_uri", String(redirectUri || AUTH_CALLBACK_URI));
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", GOOGLE_AUTH_SCOPES.join(" "));
  authUrl.searchParams.set("state", String(state || ""));
  authUrl.searchParams.set("code_challenge", String(codeChallenge || ""));
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("prompt", "select_account");
  authUrl.searchParams.set("access_type", "offline");
  return authUrl.toString();
}

function isProtocolAuthCallback(url) {
  try {
    const parsed = new URL(String(url || ""));
    return (
      parsed.protocol.toLowerCase() === `${AUTH_CALLBACK_PROTOCOL}:` &&
      parsed.hostname.toLowerCase() === AUTH_CALLBACK_HOST &&
      parsed.pathname.toLowerCase() === AUTH_CALLBACK_PATH
    );
  } catch {
    return false;
  }
}

function extractAuthCallbackArg(argv = []) {
  for (const arg of argv) {
    if (isProtocolAuthCallback(arg)) {
      return String(arg);
    }
  }
  return "";
}

function parseAuthCallback(url) {
  const parsed = new URL(String(url || ""));
  const state = String(parsed.searchParams.get("state") || "");
  return {
    callbackUrl: parsed.toString(),
    state,
    code: String(parsed.searchParams.get("code") || ""),
    error: String(parsed.searchParams.get("error") || ""),
    errorDescription: String(parsed.searchParams.get("error_description") || "")
  };
}

function createLoopbackCallbackServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const requestUrl = new URL(String(req.url || "/"), `http://${AUTH_CALLBACK_LOOPBACK_HOST}`);
      if (requestUrl.pathname !== AUTH_CALLBACK_PATH) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      const callbackUrl = `http://${AUTH_CALLBACK_LOOPBACK_HOST}:${port}${requestUrl.pathname}${requestUrl.search}`;
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<html><body><h3>Authentication received.</h3><p>You can close this window.</p></body></html>");
      setTimeout(() => {
        void handleExternalAuthCallback(callbackUrl);
      }, 0);
      server.close();
    });
    server.on("error", reject);
    server.listen(0, AUTH_CALLBACK_LOOPBACK_HOST, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      if (!port) {
        reject(new Error("loopback-listener-port-unavailable"));
        return;
      }
      resolve({
        redirectUri: `http://${AUTH_CALLBACK_LOOPBACK_HOST}:${port}${AUTH_CALLBACK_PATH}`,
        close: () =>
          new Promise((innerResolve) => {
            server.close(() => innerResolve(true));
          })
      });
    });
  });
}

function postGoogleTokenExchange({ code, clientId, redirectUri, codeVerifier }) {
  return new Promise((resolve) => {
    const payload = new URLSearchParams({
      code: String(code || ""),
      client_id: String(clientId || ""),
      code_verifier: String(codeVerifier || ""),
      grant_type: "authorization_code",
      redirect_uri: String(redirectUri || AUTH_CALLBACK_URI)
    }).toString();
    const request = https.request(
      GOOGLE_TOKEN_ENDPOINT,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(payload)
        },
        timeout: 15_000
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          let parsed = {};
          try {
            parsed = body ? JSON.parse(body) : {};
          } catch {
            parsed = {};
          }
          const status = Number(response.statusCode || 0);
          if (status >= 200 && status < 300 && parsed?.access_token) {
            resolve({ ok: true, payload: parsed });
            return;
          }
          resolve({
            ok: false,
            error: String(parsed?.error || `http-${status || "unknown"}`),
            errorDescription: String(parsed?.error_description || "")
          });
        });
      }
    );
    request.on("timeout", () => {
      request.destroy(new Error("timeout"));
    });
    request.on("error", (error) => {
      resolve({
        ok: false,
        error: String(error?.message || "token-request-failed")
      });
    });
    request.write(payload);
    request.end();
  });
}

function cleanupPendingExternalAuth(state) {
  const key = String(state || "");
  if (!key) return null;
  const pending = pendingExternalGoogleAuthByState.get(key) || null;
  pendingExternalGoogleAuthByState.delete(key);
  return pending;
}

function cleanupPendingExternalAuthByTabId(tabId) {
  const safeTabId = String(tabId || "");
  if (!safeTabId) return;
  for (const [state, pending] of pendingExternalGoogleAuthByState.entries()) {
    if (String(pending?.tabId || "") === safeTabId) {
      if (typeof pending?.closeCallbackServer === "function") {
        void pending.closeCallbackServer();
      }
      pendingExternalGoogleAuthByState.delete(state);
    }
  }
}

async function handleExternalAuthCallback(rawUrl) {
  const parsed = parseAuthCallback(rawUrl);
  const pending = cleanupPendingExternalAuth(parsed.state);
  if (!pending) {
    pushLegacyAuthTrace("legacy-flow-callback-unmatched", {
      callbackUrl: parsed.callbackUrl,
      state: parsed.state
    });
    return true;
  }

  pushLegacyAuthTrace("legacy-flow-callback-received", {
    legacyFlowId: pending.legacyFlowId,
    tabId: pending.tabId,
    callbackUrl: parsed.callbackUrl,
    state: parsed.state
  });
  if (typeof pending.closeCallbackServer === "function") {
    await pending.closeCallbackServer();
  }

  const callbackResult = await pathAAuthBridge.onLegacyExternalCallback({
    legacyFlowId: pending.legacyFlowId,
    callbackUrl: parsed.callbackUrl,
    state: parsed.state,
    code: parsed.code,
    error: parsed.error || parsed.errorDescription
  });

  if (!callbackResult?.ok) {
    pushLegacyAuthTrace("legacy-flow-callback-rejected", {
      legacyFlowId: pending.legacyFlowId,
      reason: callbackResult?.reason || "unknown"
    });
    return true;
  }

  emitExternalAuthNotice({
    noticeType: "callback-success",
    message: "Google callback received. Continue in your default browser session.",
    legacyFlowId: pending.legacyFlowId,
    tabId: pending.tabId,
    correlationId: String(callbackResult.correlationId || "")
  });

  const tokenResult = await postGoogleTokenExchange({
    code: callbackResult.code,
    clientId: callbackResult.clientId,
    redirectUri: callbackResult.redirectUri,
    codeVerifier: callbackResult.pkceVerifier
  });

  await pathAAuthBridge.onLegacyExternalTokenExchange({
    legacyFlowId: pending.legacyFlowId,
    success: tokenResult.ok,
    tokenEndpoint: GOOGLE_TOKEN_ENDPOINT,
    error: tokenResult.ok ? "" : tokenResult.error
  });

  if (tokenResult.ok) {
    pushLegacyAuthTrace("legacy-flow-token-exchange-success", {
      legacyFlowId: pending.legacyFlowId,
      tabId: pending.tabId
    });
    await pathAAuthBridge.onLegacyFlowCompleted({
      legacyFlowId: pending.legacyFlowId,
      reason: "token-exchange-succeeded"
    });
  } else {
    pushLegacyAuthTrace("legacy-flow-token-exchange-failed", {
      legacyFlowId: pending.legacyFlowId,
      tabId: pending.tabId,
      error: tokenResult.error || "token-exchange-failed"
    });
    await pathAAuthBridge.onLegacyFlowFailed({
      legacyFlowId: pending.legacyFlowId,
      reason: "token-exchange-failed"
    });
  }

  if (pending.tabId) {
    legacyAuthFlowByTabId.delete(pending.tabId);
  }
  return true;
}

async function handleProtocolAuthCallback(rawUrl) {
  if (!isProtocolAuthCallback(rawUrl)) return false;
  return handleExternalAuthCallback(rawUrl);
}

function finalizeAllLegacyFlows(reason = "window-closed") {
  const pending = Array.from(legacyAuthFlowByTabId.entries());
  pending.forEach(([tabId, legacyFlowId]) => {
    pushLegacyAuthTrace("legacy-flow-cancelled", {
      legacyFlowId,
      tabId,
      reason
    });
    void pathAAuthBridge.onLegacyFlowCancelled({
      legacyFlowId,
      reason
    });
  });
  legacyAuthFlowByTabId.clear();
  pendingExternalGoogleAuthByState.clear();
}

async function buildDiagnosticsExport(limit = 200) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 200, MAX_LEGACY_AUTH_TRACE));
  const pathADiagnostics = await pathAAuthBridge.getDiagnostics(safeLimit);
  const pathATelemetry = Array.isArray(pathADiagnostics?.telemetry) ? pathADiagnostics.telemetry : [];
  const pathATerminalSummaries = Array.isArray(pathADiagnostics?.terminalSummaries)
    ? pathADiagnostics.terminalSummaries
    : [];
  const pathAGroupedDiagnostics =
    pathADiagnostics?.groupedDiagnostics && typeof pathADiagnostics.groupedDiagnostics === "object"
      ? pathADiagnostics.groupedDiagnostics
      : { byFlowId: {}, byTerminalReason: {} };
  const telemetryValidation =
    pathADiagnostics?.telemetryValidation && typeof pathADiagnostics.telemetryValidation === "object"
      ? pathADiagnostics.telemetryValidation
      : {
          totalEvents: pathATelemetry.length,
          validEvents: pathATelemetry.length,
          invalidEvents: 0,
          violations: []
        };
  return {
    metadata: {
      version: APP_VERSION_LABEL,
      electron: process.versions.electron,
      chromium: process.versions.chrome,
      os: `${os.platform()} ${os.arch()}`,
      kernel: os.release(),
      time: new Date().toISOString()
    },
    legacy: {
      summary: {
        activeCount: legacyAuthFlowByTabId.size,
        activeFlows: Array.from(legacyAuthFlowByTabId.entries()).map(([tabId, flowId]) => ({
          id: flowId,
          sourceTabId: tabId
        })),
        lastEvent: legacyAuthTrace[legacyAuthTrace.length - 1] || null
      },
      trace: legacyAuthTrace.slice(-safeLimit)
    },
    pathA: {
      activeFlows: Array.isArray(pathADiagnostics?.activeFlows) ? pathADiagnostics.activeFlows : [],
      telemetry: pathATelemetry,
      telemetryValidation,
      terminalSummaries: pathATerminalSummaries,
      groupedDiagnostics: pathAGroupedDiagnostics
    }
  };
}

function normalizeUrl(raw) {
  const trimmed = (raw || "").trim();
  if (!trimmed) return DEFAULT_HOME;
  if (trimmed === "about:blank" || trimmed.startsWith("about:")) return trimmed;
  if (trimmed.startsWith("jusbrowse://")) return DEFAULT_HOME;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("file://")) {
    if (runtimeSettings.httpsOnlyMode && trimmed.startsWith("http://")) {
      return `https://${trimmed.slice("http://".length)}`;
    }
    return trimmed;
  }
  return `https://${trimmed}`;
}

function shouldSkipProtection(url) {
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  })();
  if (!host) return false;
  const hostLower = host.toLowerCase();
  const whitelist = String(runtimeSettings.protectionWhitelist || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (isCompatibilityHost(url)) return true;
  return whitelist.some((entry) => hostLower === entry || hostLower.endsWith(`.${entry}`));
}

function loadSavedPasswords() {
  try {
    if (!passwordDbPath || !fs.existsSync(passwordDbPath)) return [];
    const raw = fs.readFileSync(passwordDbPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistSavedPasswords() {
  if (!passwordDbPath) return;
  try {
    fs.writeFileSync(passwordDbPath, JSON.stringify(savedPasswords.slice(0, 500), null, 2), "utf8");
  } catch {
    // Ignore IO errors.
  }
}

function parseCredentialFromBody(body) {
  const text = String(body || "").trim();
  if (!text) return null;
  const usernameKeys = ["username", "email", "login", "user", "identifier"];
  const passwordKeys = ["password", "passwd", "pass", "pwd"];
  const pick = (source, keys) =>
    keys.map((key) => source?.[key]).find((value) => typeof value === "string" && value.trim());

  try {
    const json = JSON.parse(text);
    const username = pick(json, usernameKeys) || "";
    const password = pick(json, passwordKeys) || "";
    if (password) return { username, password };
  } catch {
    // Not JSON.
  }

  const params = new URLSearchParams(text);
  const username = usernameKeys.map((key) => params.get(key)).find(Boolean) || "";
  const password = passwordKeys.map((key) => params.get(key)).find(Boolean) || "";
  if (password) return { username, password };

  // Very basic multipart fallback for common form uploads.
  const multipartUser =
    text.match(/name="(?:username|email|login|user|identifier)"\s*\r?\n\r?\n([^\r\n]+)/i)?.[1] || "";
  const multipartPass = text.match(/name="(?:password|passwd|pass|pwd)"\s*\r?\n\r?\n([^\r\n]+)/i)?.[1] || "";
  if (multipartPass) return { username: multipartUser, password: multipartPass };
  return null;
}

// Non-blocking, Chrome-style "Save password?" banner. We fire an IPC to the originating
// renderer (the one that owns the tab where the credential was observed); the renderer
// renders a bottom-right banner with Save / Never buttons that round-trips back via
// passwords:respond. dialog.showMessageBox would block the entire UI thread, which on
// Google's multi-page flow felt awful — the banner is async and dismissable.
function offerSavePassword(entry, targetWebContents = null) {
  if (!runtimeSettings.savePasswords) return;
  if (!entry?.password || !entry.host) return;
  if (neverSaveHosts.has(entry.host)) return;
  const alreadyStored = savedPasswords.some(
    (item) => item.host === entry.host && item.username === entry.username && item.password === entry.password
  );
  if (alreadyStored) return;
  for (const pending of pendingPasswordPrompts.values()) {
    if (
      pending.entry.host === entry.host &&
      pending.entry.username === entry.username &&
      pending.entry.password === entry.password
    ) {
      return;
    }
  }
  const wc = (() => {
    if (targetWebContents && !targetWebContents.isDestroyed?.()) return targetWebContents;
    if (mainWindow?.webContents && !mainWindow.isDestroyed()) return mainWindow.webContents;
    return null;
  })();
  if (!wc) return;
  const id = `pwprompt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  pendingPasswordPrompts.set(id, { entry });
  wc.send("passwords:offer", {
    id,
    host: entry.host,
    username: entry.username || "",
    capturedAt: entry.savedAt || Date.now()
  });
}

function rememberUsernameHint(host, username) {
  if (!host || !username) return;
  usernameHintByHost.set(host, { username, at: Date.now() });
}

function consumeUsernameHint(host) {
  if (!host) return "";
  const entry = usernameHintByHost.get(host);
  if (!entry) return "";
  if (Date.now() - entry.at > USERNAME_HINT_TTL_MS) {
    usernameHintByHost.delete(host);
    return "";
  }
  return entry.username;
}

function captureCredentialsFromRequest(url, uploadData = [], isIncognito = false, ownerWebContents = null) {
  if (!runtimeSettings.savePasswords || isIncognito) return;
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return "";
    }
  })();
  if (!host || shouldSkipProtection(url)) return;
  const body = uploadData
    .map((item) => (item.bytes ? Buffer.from(item.bytes).toString("utf8") : ""))
    .join("&");
  if (!body) return;
  const credential = parseCredentialFromBody(body);
  if (!credential) return;
  const username = credential.username || consumeUsernameHint(host);
  const password = credential.password || "";
  if (!password) return;
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    host,
    username,
    password,
    savedAt: Date.now()
  };
  offerSavePassword(entry, ownerWebContents);
}

function captureCredentialsFromFields(url, fields = {}, isIncognito = false, ownerWebContents = null) {
  if (!runtimeSettings.savePasswords || isIncognito) return;
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return "";
    }
  })();
  if (!host || shouldSkipProtection(url)) return;
  const fieldMap = fields && typeof fields === "object" ? fields : {};
  const normalizedEntries = Object.entries(fieldMap)
    .map(([rawKey, rawValue]) => [String(rawKey || "").trim().toLowerCase(), String(rawValue || "").trim()])
    .filter(([key, value]) => key && value);
  const pick = (...keys) => normalizedEntries.find(([key]) => keys.includes(key))?.[1] || "";
  const pickByKeyword = (keywords) =>
    normalizedEntries.find(([key]) => keywords.some((keyword) => key.includes(keyword)))?.[1] || "";
  const username =
    pick("username", "email", "login", "user", "identifier") || pickByKeyword(["user", "mail", "login", "identifier"]);
  const password = pick("password", "passwd", "pass", "pwd") || pickByKeyword(["pass", "pwd", "secret"]);
  // No password yet? Stash the username as a hint for whatever password POST follows.
  if (!password) {
    if (username) rememberUsernameHint(host, username);
    return;
  }
  const finalUsername = username || consumeUsernameHint(host);
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    host,
    username: finalUsername,
    password,
    savedAt: Date.now()
  };
  offerSavePassword(entry, ownerWebContents);
}

function isTrackerUrl(url) {
  const normalized = String(url || "").toLowerCase();
  const host = (() => {
    try {
      return new URL(normalized).hostname;
    } catch {
      return "";
    }
  })();
  return (
    TRACKER_HOST_PATTERNS.some((token) => host === token || host.endsWith(`.${token}`)) ||
    TRACKER_URL_KEYWORDS.some((token) => normalized.includes(token))
  );
}

function isCompatibilityHost(url) {
  const host = (() => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();
  if (!host) return false;
  return COMPATIBILITY_HOSTS.some((entry) => host === entry || host.endsWith(`.${entry}`));
}

function isCompatibilityTab(tab) {
  if (!tab?.view?.webContents) return false;
  const currentUrl = tab.view.webContents.getURL() || tab.url || "";
  return isCompatibilityHost(currentUrl);
}

function isLikelyAdResource(url, resourceType) {
  const normalized = String(url || "").toLowerCase();
  const adLikeResource = ["script", "image", "xhr", "fetch", "subFrame"].includes(resourceType);
  if (!adLikeResource) return false;
  return (
    normalized.includes("/ad") ||
    normalized.includes("banner") ||
    normalized.includes("sponsor") ||
    normalized.includes("promo")
  );
}

function triggerExternalAuthHandoff(tab, openerUrl, externalUrl, disposition) {
  const legacyFlowId = ensureLegacyBridgeFlow(tab.id, {
    openerUrl,
    targetUrl: externalUrl,
    disposition,
    routeType: "external-browser",
    incognito: Boolean(tab.incognito)
  });
  void (async () => {
    let callbackServer = null;
    try {
      let decisionContext = null;
      if (legacyFlowId) {
        decisionContext = await pathAAuthBridge.onLegacyExternalLaunchDecision({
          legacyFlowId,
          decision: "external-browser",
          targetUrl: externalUrl
        });
      }
      const clientId = getGoogleOAuthClientId();
      if (!legacyFlowId || !clientId) {
        pushLegacyAuthTrace("legacy-flow-external-launch-failed", {
          legacyFlowId,
          tabId: tab.id,
          reason: clientId ? "missing-legacy-flow" : "missing-google-client-id"
        });
        if (legacyFlowId) {
          await pathAAuthBridge.onLegacyExternalLaunchResult({
            legacyFlowId,
            launchUrl: externalUrl,
            success: false,
            error: clientId ? "missing-legacy-flow" : "missing-google-client-id",
            terminalReason: "provider-error"
          });
          emitExternalAuthNotice({
            noticeType: "launch-failed",
            message: "Google sign-in could not open your default browser. Please try again.",
            legacyFlowId,
            tabId: tab.id,
            correlationId: String(decisionContext?.correlationId || ""),
            terminalReason: "provider-error"
          });
          await pathAAuthBridge.onLegacyFlowFailed({
            legacyFlowId,
            reason: "provider-error"
          });
          legacyAuthFlowByTabId.delete(tab.id);
        }
        return;
      }

      callbackServer = await createLoopbackCallbackServer();
      const prepared = await pathAAuthBridge.prepareLegacyExternalAuth({
        legacyFlowId,
        redirectUri: callbackServer.redirectUri,
        tokenEndpoint: GOOGLE_TOKEN_ENDPOINT,
        clientId
      });
      if (!prepared) {
        pushLegacyAuthTrace("legacy-flow-external-launch-failed", {
          legacyFlowId,
          tabId: tab.id,
          reason: "patha-flow-not-ready"
        });
        await pathAAuthBridge.onLegacyExternalLaunchResult({
          legacyFlowId,
          launchUrl: externalUrl,
          success: false,
          error: "patha-flow-not-ready",
          terminalReason: "adapter-error"
        });
        emitExternalAuthNotice({
          noticeType: "launch-failed",
          message: "Google sign-in could not start in your default browser. Please try again.",
          legacyFlowId,
          tabId: tab.id,
          correlationId: String(decisionContext?.correlationId || ""),
          terminalReason: "adapter-error"
        });
        await pathAAuthBridge.onLegacyFlowFailed({
          legacyFlowId,
          reason: "adapter-error"
        });
        legacyAuthFlowByTabId.delete(tab.id);
        if (callbackServer) {
          await callbackServer.close();
        }
        return;
      }

      const launchUrl = buildGoogleAuthorizationUrl({
        clientId,
        redirectUri: prepared.redirectUri,
        state: prepared.state,
        codeChallenge: prepared.pkceChallenge
      });
      pendingExternalGoogleAuthByState.set(prepared.state, {
        legacyFlowId,
        tabId: tab.id,
        createdAt: Date.now(),
        closeCallbackServer: callbackServer?.close
      });
      const launchContext = await pathAAuthBridge.onLegacyExternalAuthLaunch({
        legacyFlowId,
        launchUrl,
        redirectUri: prepared.redirectUri
      });
      pushLegacyAuthTrace("legacy-flow-external-launch", {
        legacyFlowId,
        tabId: tab.id,
        launchUrl
      });
      emitExternalAuthNotice({
        noticeType: "launch-started",
        message: GOOGLE_EXTERNAL_NOTICE_MESSAGE,
        legacyFlowId,
        tabId: tab.id,
        correlationId: String(launchContext?.correlationId || decisionContext?.correlationId || "")
      });
      try {
        await shell.openExternal(launchUrl);
        await pathAAuthBridge.onLegacyExternalLaunchResult({
          legacyFlowId,
          launchUrl,
          success: true,
          error: "",
          terminalReason: ""
        });
      } catch {
        const pending = cleanupPendingExternalAuth(prepared.state);
        if (typeof pending?.closeCallbackServer === "function") {
          await pending.closeCallbackServer();
        }
        pushLegacyAuthTrace("legacy-flow-external-launch-failed", {
          legacyFlowId,
          tabId: tab.id,
          reason: "open-external-failed"
        });
        await pathAAuthBridge.onLegacyExternalLaunchResult({
          legacyFlowId,
          launchUrl,
          success: false,
          error: "open-external-failed",
          terminalReason: "provider-error"
        });
        emitExternalAuthNotice({
          noticeType: "launch-failed",
          message: "Google sign-in could not open your default browser. Please try again.",
          legacyFlowId,
          tabId: tab.id,
          correlationId: String(launchContext?.correlationId || decisionContext?.correlationId || ""),
          terminalReason: "provider-error"
        });
        await pathAAuthBridge.onLegacyFlowFailed({
          legacyFlowId,
          reason: "provider-error"
        });
        legacyAuthFlowByTabId.delete(tab.id);
      }
    } catch (error) {
      if (callbackServer) {
        await callbackServer.close();
      }
      pushLegacyAuthTrace("legacy-flow-external-launch-failed", {
        legacyFlowId,
        tabId: tab.id,
        reason: "external-launch-exception",
        error: String(error?.message || "unknown-error")
      });
      if (legacyFlowId) {
        await pathAAuthBridge.onLegacyExternalLaunchResult({
          legacyFlowId,
          launchUrl: externalUrl,
          success: false,
          error: String(error?.message || "external-launch-exception"),
          terminalReason: "adapter-error"
        });
        emitExternalAuthNotice({
          noticeType: "launch-failed",
          message: "Google sign-in could not start in your default browser. Please try again.",
          legacyFlowId,
          tabId: tab.id,
          terminalReason: "adapter-error"
        });
        await pathAAuthBridge.onLegacyFlowFailed({
          legacyFlowId,
          reason: "adapter-error"
        });
        legacyAuthFlowByTabId.delete(tab.id);
      }
    }
  })();
}

function configureWindowOpenHandler(tab) {
  const wc = tab.view.webContents;
  wc.setWindowOpenHandler((details) => {
    const disposition = String(details.disposition || "").toLowerCase();
    const targetUrl = details.url || DEFAULT_HOME;
    const openerUrl = wc.getURL() || tab.url || "";
    const externalUrl = (() => {
      const candidate = String(targetUrl || "");
      if (candidate && candidate !== DEFAULT_HOME && !candidate.startsWith("about:")) return candidate;
      const openerCandidate = String(openerUrl || "");
      if (openerCandidate && openerCandidate !== DEFAULT_HOME && !openerCandidate.startsWith("about:")) return openerCandidate;
      return candidate || openerCandidate || DEFAULT_HOME;
    })();
    const providerPolicy = resolveProviderPolicy(targetUrl || openerUrl);
    if (providerPolicy.externalHandoffRequired) {
      triggerExternalAuthHandoff(tab, openerUrl, externalUrl, disposition);
      return { action: "deny" };
    }
    const compatibilityContext = isCompatibilityHost(openerUrl) || isCompatibilityHost(targetUrl);
    if (compatibilityContext) {
      ensureLegacyBridgeFlow(tab.id, {
        openerUrl,
        targetUrl,
        disposition,
        routeType: "managed-tab",
        incognito: Boolean(tab.incognito)
      });
    }
    const popupKey = `${tab.id}|${targetUrl}|${disposition}`;
    const now = Date.now();
    const lastAttempt = popupAttemptGuard.get(popupKey) || 0;
    if (now - lastAttempt < 1800) {
      return { action: "deny" };
    }
    popupAttemptGuard.set(popupKey, now);

    const canOpenAsTab = ["foreground-tab", "background-tab", "new-window"].includes(disposition);
    if (runtimeSettings.popupBlocker && !canOpenAsTab) {
      return { action: "deny" };
    }
    createTab(
      {
        url: targetUrl || DEFAULT_HOME,
        incognito: Boolean(tab.incognito),
        forceJavascript: isCompatibilityHost(targetUrl || "")
      },
      true
    );
    return { action: "deny" };
  });
}

function showContextMenu(tab, params = {}) {
  const wc = tab?.view?.webContents;
  if (!wc) return;
  const hasLink = Boolean(params.linkURL);
  const hasImage = Boolean(params.srcURL) && params.mediaType === "image";
  const hasSelection = Boolean(params.selectionText);

  const template = [
    {
      label: "Back",
      enabled: wc.navigationHistory.canGoBack(),
      click: () => wc.navigationHistory.goBack()
    },
    {
      label: "Forward",
      enabled: wc.navigationHistory.canGoForward(),
      click: () => wc.navigationHistory.goForward()
    },
    { label: "Reload", click: () => wc.reload() },
    { type: "separator" },
    {
      label: "Open Link in New Tab",
      visible: hasLink,
      click: () => {
        if (!params.linkURL) return;
        createTab({ url: params.linkURL, incognito: Boolean(tab.incognito) }, true);
      }
    },
    {
      label: "Open Link in New Incognito Tab",
      visible: hasLink,
      click: () => {
        if (!params.linkURL) return;
        createTab({ url: params.linkURL, incognito: true }, true);
      }
    },
    {
      label: "Copy Link Address",
      visible: hasLink,
      click: () => {
        if (params.linkURL) clipboard.writeText(String(params.linkURL));
      }
    },
    {
      label: "Save Link As...",
      visible: hasLink,
      click: () => {
        if (params.linkURL) wc.downloadURL(String(params.linkURL));
      }
    },
    { type: "separator", visible: hasLink },
    {
      label: "Open Image in New Tab",
      visible: hasImage,
      click: () => {
        if (params.srcURL) createTab({ url: params.srcURL, incognito: Boolean(tab.incognito) }, true);
      }
    },
    {
      label: "Save Image As...",
      visible: hasImage,
      click: () => {
        if (params.srcURL) wc.downloadURL(String(params.srcURL));
      }
    },
    {
      label: "Copy Image Address",
      visible: hasImage,
      click: () => {
        if (params.srcURL) clipboard.writeText(String(params.srcURL));
      }
    },
    { type: "separator", visible: hasImage },
    {
      label: `Search the web for "${(params.selectionText || "").slice(0, 32)}"`,
      visible: hasSelection,
      click: () => {
        const term = String(params.selectionText || "").trim();
        if (!term) return;
        const url = `https://www.google.com/search?q=${encodeURIComponent(term)}`;
        createTab({ url, incognito: Boolean(tab.incognito) }, true);
      }
    },
    { type: "separator", visible: hasSelection },
    { role: "cut", enabled: params.isEditable },
    { role: "copy", enabled: params.editFlags?.canCopy || hasSelection },
    { role: "paste", enabled: params.isEditable },
    { role: "selectAll" },
    { type: "separator" },
    {
      label: "View Page Source",
      click: () => {
        const sourceUrl = `view-source:${wc.getURL()}`;
        createTab({ url: sourceUrl, incognito: Boolean(tab.incognito) }, true);
      }
    },
    {
      label: "Inspect Element",
      click: () => {
        const x = Number(params.x) || 0;
        const y = Number(params.y) || 0;
        wc.inspectElement(x, y);
        if (wc.devToolsWebContents) wc.devToolsWebContents.focus();
      }
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  menu.popup({ window: mainWindow || BrowserWindow.getFocusedWindow() || undefined });
}

function buildUserAgent(targetUrl = "") {
  if (isCompatibilityHost(targetUrl)) return DEFAULT_USER_AGENT;
  if (runtimeSettings.follianMode || runtimeSettings.fingerprintEngine === "follian") {
    return "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0";
  }
  if (runtimeSettings.fingerprintEngine === "jusfake" || runtimeSettings.follianProtocol) {
    return `${DEFAULT_USER_AGENT} JusBrowsePrivacy/1.0`;
  }
  return DEFAULT_USER_AGENT;
}

function getActiveTab() {
  if (!activeTabId) return null;
  return tabs.get(activeTabId) || null;
}

function setViewBounds() {
  if (!mainWindow) return;
  const activeTab = getActiveTab();
  if (!activeTab) return;

  const [width, height] = mainWindow.getContentSize();
  const hideWebView = Boolean(chromeLayout.hideWebView);
  if (hideWebView) {
    activeTab.view.setBounds({ x: 0, y: 0, width: 1, height: 1 });
    return;
  }

  const topInset = Math.max(0, Number(chromeLayout.top) || 0);
  const bottomInset = Math.max(0, Number(chromeLayout.bottom) || 0);
  const availableHeight = Math.max(height - topInset - bottomInset, 120);
  activeTab.view.setBounds({
    x: 0,
    y: topInset,
    width,
    height: availableHeight
  });
}

function serializeTabs() {
  return tabOrder
    .map((id) => tabs.get(id))
    .filter(Boolean)
    .map((tab) => ({
      id: tab.id,
      title: tab.title || "New Tab",
      url: tab.url || "",
      isLoading: Boolean(tab.isLoading),
      isActive: tab.id === activeTabId,
      incognito: Boolean(tab.incognito)
    }));
}

function publishState() {
  if (!mainWindow) return;
  const activeTab = getActiveTab();
  if (!activeTab) return;
  const wc = activeTab.view.webContents;
  const currentUrl = wc.getURL() || "";
  let host = "";
  try {
    host = currentUrl ? new URL(currentUrl).host : "";
  } catch {
    host = "";
  }

  mainWindow.webContents.send("browser:state", {
    url: currentUrl,
    title: wc.getTitle() || "JusBrowse",
    host,
    isSecure: currentUrl.startsWith("https://"),
    isHome: !currentUrl || currentUrl === "about:blank",
    canGoBack: wc.navigationHistory.canGoBack(),
    canGoForward: wc.navigationHistory.canGoForward(),
    isLoading: wc.isLoading(),
    tabs: serializeTabs(),
    activeTabId
  });
}

function attachTabListeners(tab) {
  const wc = tab.view.webContents;

  // Inject the main-world spoof every time a frame is created or finishes navigating.
  // Cross-origin sub-frames (Google sign-in uses several iframes) don't run our preload, so
  // this is the only path that gets the spoof into their main world.
  wc.on("frame-created", (_event, details) => {
    const frame = details && details.frame;
    if (frame) injectSpoofIntoFrame(frame);
  });
  wc.on("did-frame-navigate", (_event, _url, _httpResponseCode, _httpStatusText, _isMainFrame, frameProcessId, frameRoutingId) => {
    try {
      const frame = webFrameMain.fromId(frameProcessId, frameRoutingId);
      if (frame) injectSpoofIntoFrame(frame);
    } catch {
      // Frame may have been replaced; nothing to do.
    }
  });
  wc.on("did-start-navigation", () => {
    // Belt-and-suspenders: re-inject into the main frame as soon as the new document is created
    // but before any page scripts run.
    if (wc.mainFrame) injectSpoofIntoFrame(wc.mainFrame);
  });
  wc.on("dom-ready", () => injectSpoofIntoAllFrames(wc));

  const refresh = () => {
    tab.url = wc.getURL() || "";
    tab.title = wc.getTitle() || "New Tab";
    tab.isLoading = wc.isLoading();
    tab.lastActiveAt = Date.now();
    if (tab.id === activeTabId && mainWindow) {
      mainWindow.setTitle(tab.title || "JusBrowse");
      publishState();
    } else if (mainWindow) {
      mainWindow.webContents.send("browser:tabs", serializeTabs());
    }
  };

  wc.on("will-navigate", (event, url) => {
    const targetUrl = String(url || "");
    const policy = resolveProviderPolicy(targetUrl);
    if (!policy.externalHandoffRequired || !isGoogleCredentialEntryUrl(targetUrl)) return;
    event.preventDefault();
    const now = Date.now();
    const navGuardKey = `${tab.id}|${targetUrl}|external-auth-fallback`;
    const lastAttempt = popupAttemptGuard.get(navGuardKey) || 0;
    if (now - lastAttempt < 1800) return;
    popupAttemptGuard.set(navGuardKey, now);
    triggerExternalAuthHandoff(tab, wc.getURL() || tab.url || "", targetUrl, "navigation-observed");
  });

  wc.on("did-start-loading", refresh);
  wc.on("did-stop-loading", refresh);
  wc.on("page-title-updated", refresh);
  wc.on("did-navigate", (_, url) => {
    bridgeAuthNavigation(tab.id, url, "did-navigate");
    refresh();
  });
  wc.on("did-navigate-in-page", (_, url) => {
    bridgeAuthNavigation(tab.id, url, "did-navigate-in-page");
    refresh();
  });
  wc.on("did-redirect-navigation", (_, url) => {
    bridgeAuthNavigation(tab.id, url, "did-redirect-navigation");
  });
  wc.on("did-fail-load", (_, code, description, validatedURL) => {
    const legacyFlowId = legacyAuthFlowByTabId.get(tab.id);
    if (legacyFlowId) {
      cleanupPendingExternalAuthByTabId(tab.id);
      pushLegacyAuthTrace("legacy-flow-failed", {
        legacyFlowId,
        tabId: tab.id,
        code,
        description: description || "",
        url: validatedURL || ""
      });
      void pathAAuthBridge.onLegacyFlowFailed({
        legacyFlowId,
        reason: "network-error",
        url: validatedURL || ""
      });
      legacyAuthFlowByTabId.delete(tab.id);
    }
    refresh();
  });
  wc.on("did-finish-load", () => {
    if (runtimeSettings.blockCookiePopups) {
      wc.insertCSS(COOKIE_BANNER_CSS).catch(() => {});
    }
    if (runtimeSettings.advancedAdBlock) {
      wc.insertCSS(adblockManager.getCosmeticCss()).catch(() => {});
    }
    enforceCachePolicy();
  });
  wc.on("context-menu", (_, params) => showContextMenu(tab, params));
  configureWindowOpenHandler(tab);
}

function applyTabRuntimePolicies(tab) {
  const wc = tab.view.webContents;
  wc.setUserAgent(buildUserAgent(wc.getURL() || tab.url || ""));
  configureWindowOpenHandler(tab);
}

function syncAudioPolicy() {
  tabOrder.forEach((id) => {
    const tab = tabs.get(id);
    if (!tab) return;
    if (runtimeSettings.multiMediaPlayback) {
      tab.view.webContents.setAudioMuted(false);
    } else {
      tab.view.webContents.setAudioMuted(id !== activeTabId);
    }
    tab.view.webContents.setBackgroundThrottling(id !== activeTabId);
  });
}

async function enforceCachePolicy() {
  if (!mainWindow) return;
  const activeTab = getActiveTab();
  if (!activeTab) return;
  const ses = activeTab.view.webContents.session;
  // did-finish-load fires once per tab per nav, which on a 5-tab YouTube session was
  // triggering getCacheSize() ~30 times per minute. The 30-second per-session throttle
  // collapses that to at most twice per minute without skipping the actual eviction.
  const last = sessionLastCacheCheck.get(ses) || 0;
  const now = Date.now();
  if (now - last < CACHE_CHECK_THROTTLE_MS) return;
  sessionLastCacheCheck.set(ses, now);
  const limitBytes = Math.max(128, Number(runtimeSettings.cacheLimitMb) || 1024) * 1024 * 1024;
  try {
    const cacheSize = await ses.getCacheSize();
    if (cacheSize <= limitBytes) return;
    if (runtimeSettings.nuclearWipe) {
      await Promise.all([ses.clearCache(), ses.clearStorageData()]);
      return;
    }
    if (runtimeSettings.cachePolicy === "smart" || runtimeSettings.cachePolicy === "aggressive") {
      await ses.clearCache();
    }
  } catch {
    // Ignore transient session errors.
  }
}

// Idle-tab suspension. Every minute, walk the non-active tabs; if any has been idle for
// more than IDLE_SUSPEND_MS (5 min) and is silent, throttle its background timers and
// drop its session cache. setActiveTab/loadUrl flip the suspended bit back off when the
// user returns to the tab.
function startIdleSweep() {
  if (idleSweepTimer) return;
  idleSweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, tab] of tabs.entries()) {
      if (id === activeTabId) continue;
      if (tab.suspended) continue;
      const idleFor = now - (tab.lastActiveAt || now);
      if (idleFor < IDLE_SUSPEND_MS) continue;
      const wc = tab.view.webContents;
      if (wc.isCurrentlyAudible?.()) continue;
      try {
        wc.setBackgroundThrottling(true);
        wc.session?.clearCache?.().catch(() => {});
        tab.suspended = true;
      } catch {
        // Ignore destroyed webContents.
      }
    }
  }, 60_000);
  if (idleSweepTimer.unref) idleSweepTimer.unref();
}

function sanitizeUserAgentHeader(rawValue, targetUrl, tab) {
  const value = String(rawValue || "");
  // Always nuke embedded-browser fingerprints (Electron/<ver>, JusBrowse-Desktop/<ver>) before they hit the wire.
  if (/Electron\//i.test(value) || /JusBrowse-Desktop\//i.test(value) || !value) {
    return buildUserAgent(targetUrl);
  }
  if (isCompatibilityHost(targetUrl) || isCompatibilityTab(tab)) {
    return DEFAULT_USER_AGENT;
  }
  return value;
}

// Clean Chrome User-Agent Client Hints. Chromium/Electron's built-in values include an
// "Electron" entry in Sec-CH-UA-Full-Version-List which Google's sign-in fingerprinter uses to
// route requests to /v3/signin/rejected. Overwriting them here is what flips that decision.
const CLEAN_SEC_CH_UA = `"Chromium";v="${CHROME_MAJOR}", "Google Chrome";v="${CHROME_MAJOR}", "Not_A Brand";v="99"`;
const CLEAN_SEC_CH_UA_FULL_VERSION_LIST =
  `"Chromium";v="${CHROME_FULL}", "Google Chrome";v="${CHROME_FULL}", "Not_A Brand";v="99.0.0.0"`;

function applyCleanClientHintHeaders(headers, force = false) {
  for (const headerName of Object.keys(headers)) {
    const lower = headerName.toLowerCase();
    if (lower === "sec-ch-ua" && (force || /Electron/i.test(String(headers[headerName] || "")))) {
      headers[headerName] = CLEAN_SEC_CH_UA;
    } else if (
      lower === "sec-ch-ua-full-version-list" &&
      (force || /Electron/i.test(String(headers[headerName] || "")))
    ) {
      headers[headerName] = CLEAN_SEC_CH_UA_FULL_VERSION_LIST;
    } else if (lower === "sec-ch-ua-full-version" && (force || /Electron/i.test(String(headers[headerName] || "")))) {
      headers[headerName] = `"${CHROME_FULL}"`;
    } else if (lower === "sec-ch-ua-platform" && force) {
      headers[headerName] = '"Linux"';
    } else if (lower === "sec-ch-ua-mobile" && force) {
      headers[headerName] = "?0";
    }
  }
  if (force) {
    if (!Object.keys(headers).some((k) => k.toLowerCase() === "sec-ch-ua")) {
      headers["Sec-CH-UA"] = CLEAN_SEC_CH_UA;
    }
    if (!Object.keys(headers).some((k) => k.toLowerCase() === "sec-ch-ua-mobile")) {
      headers["Sec-CH-UA-Mobile"] = "?0";
    }
    if (!Object.keys(headers).some((k) => k.toLowerCase() === "sec-ch-ua-platform")) {
      headers["Sec-CH-UA-Platform"] = '"Linux"';
    }
  }
}

function injectSpoofIntoFrame(frame) {
  if (!frame) return;
  try {
    const url = String(frame.url || "");
    // Skip about:blank / chrome-error pages — the spoof relies on a real document.
    if (!url || url.startsWith("about:") || url.startsWith("chrome-error://")) return;
    frame.executeJavaScript(MAIN_WORLD_SPOOF_SCRIPT, false).catch(() => {});
  } catch {
    // Frame may have been destroyed mid-injection. Safe to ignore.
  }
}

function injectSpoofIntoAllFrames(wc) {
  if (!wc || wc.isDestroyed()) return;
  try {
    const main = wc.mainFrame;
    if (!main) return;
    const visit = (frame) => {
      if (!frame) return;
      injectSpoofIntoFrame(frame);
      const children = frame.frames || [];
      children.forEach(visit);
    };
    visit(main);
  } catch {
    // Some Electron 41 builds may not expose mainFrame.frames synchronously yet.
  }
}

function attachSessionHooks(ses) {
  if (!ses || attachedSessions.has(ses)) return;
  try {
    // Belt + suspenders: pin the Chrome UA at session level so embedded resources/workers also use it.
    ses.setUserAgent(DEFAULT_USER_AGENT);
  } catch {
    // Older Electron builds may not expose this; the fallback UA still applies.
  }
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    const tab = wcIdToTab.get(details.webContentsId) || null;
    const compatibilityContext = isCompatibilityHost(details.url) || isCompatibilityTab(tab);
    const headers = { ...(details.requestHeaders || {}) };
    headers["User-Agent"] = sanitizeUserAgentHeader(headers["User-Agent"], details.url, tab);
    // Always rewrite leaked client-hint values; force the full clean set on Google/etc. so the
    // sign-in fingerprinter doesn't see "Electron" in Sec-CH-UA-Full-Version-List.
    applyCleanClientHintHeaders(headers, compatibilityContext);
    if (compatibilityContext) {
      delete headers.DNT;
    } else if (runtimeSettings.sendDoNotTrack) headers.DNT = "1";
    else delete headers.DNT;
    callback({ requestHeaders: headers });
  });
  ses.webRequest.onBeforeRequest((details, callback) => {
    const { url = "", resourceType = "", uploadData = [], webContentsId } = details;
    const tab = wcIdToTab.get(webContentsId) || null;
    const ownerWc = tab?.view?.webContents || null;
    const compatibilityContext = isCompatibilityHost(url) || isCompatibilityTab(tab);
    captureCredentialsFromRequest(url, uploadData, Boolean(tab?.incognito), ownerWc);
    if (compatibilityContext) {
      callback({ cancel: false });
      return;
    }
    if (runtimeSettings.httpsOnlyMode && url.startsWith("http://")) {
      callback({ redirectURL: `https://${url.slice("http://".length)}` });
      return;
    }
    if (shouldSkipProtection(url)) {
      callback({ cancel: false });
      return;
    }
    if (runtimeSettings.blockTrackers && (adblockManager.matchUrl(url) || isTrackerUrl(url))) {
      adblockManager.incrementBlocked();
      callback({ cancel: true });
      return;
    }
    if (runtimeSettings.advancedAdBlock && isLikelyAdResource(url, resourceType)) {
      adblockManager.incrementBlocked();
      callback({ cancel: true });
      return;
    }
    callback({ cancel: false });
  });
  ses.webRequest.onHeadersReceived((details, callback) => {
    const tab = wcIdToTab.get(details.webContentsId) || null;
    const compatibilityContext = isCompatibilityHost(details.url) || isCompatibilityTab(tab);
    if (compatibilityContext || !runtimeSettings.advancedAdBlock || shouldSkipProtection(details.url)) {
      callback({ responseHeaders: details.responseHeaders });
      return;
    }
    const responseHeaders = { ...(details.responseHeaders || {}) };
    responseHeaders["Content-Security-Policy"] = [
      "default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; script-src 'self' https: 'unsafe-inline' 'unsafe-eval'"
    ];
    callback({ responseHeaders });
  });
  ses.on("will-download", (_event, item) => {
    handleVirusScanForDownload(item).catch(() => {});
  });
  attachedSessions.add(ses);
}

// --- VirusTotal/Koodous scanning on download --------------------------------------------

function handleVirusScanForDownload(item) {
  if (!item || pendingDownloadScans.has(item)) return Promise.resolve();
  pendingDownloadScans.add(item);
  const targetUrl = String(item.getURL?.() || "");
  if (!targetUrl) return Promise.resolve();
  const vtKey = String(runtimeSettings.virusTotalApiKey || "").trim();
  const koodousKey = String(runtimeSettings.koodousApiKey || "").trim();
  if (!vtKey && !koodousKey) return Promise.resolve();
  // Best-effort URL scan. Don't pause the download — surface the result as an in-page notice.
  return Promise.allSettled([
    vtKey ? scanWithVirusTotal(targetUrl, vtKey) : Promise.resolve(null),
    koodousKey ? scanWithKoodous(targetUrl, koodousKey) : Promise.resolve(null)
  ]).then((results) => {
    const hits = results.map((res) => (res.status === "fulfilled" ? res.value : null)).filter(Boolean);
    const malicious = hits.find((h) => h.malicious);
    if (malicious) {
      emitExternalAuthNotice({
        noticeType: "launch-failed",
        message: `Download flagged by ${malicious.source}: ${malicious.reason || "malicious"}`
      });
    }
  });
}

function scanWithVirusTotal(targetUrl, apiKey) {
  return new Promise((resolve) => {
    const encoded = Buffer.from(targetUrl).toString("base64").replace(/=+$/, "").replace(/\//g, "_").replace(/\+/g, "-");
    const url = `https://www.virustotal.com/api/v3/urls/${encoded}`;
    const req = https.request(
      url,
      { method: "GET", headers: { "x-apikey": apiKey }, timeout: 8000 },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(body);
            const stats = parsed?.data?.attributes?.last_analysis_stats || {};
            const malicious = Number(stats.malicious || 0) > 0 || Number(stats.suspicious || 0) > 0;
            resolve({
              source: "VirusTotal",
              malicious,
              reason: malicious ? `${stats.malicious || 0} engines flagged` : ""
            });
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
    req.end();
  });
}

function scanWithKoodous(targetUrl, apiKey) {
  return new Promise((resolve) => {
    const url = `https://api.koodous.com/apks/?search=${encodeURIComponent(targetUrl)}`;
    const req = https.request(
      url,
      { method: "GET", headers: { Authorization: `Token ${apiKey}` }, timeout: 8000 },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(body);
            const malicious = Array.isArray(parsed?.results) && parsed.results.some((r) => r.detected);
            resolve({
              source: "Koodous",
              malicious,
              reason: malicious ? "Koodous detection match" : ""
            });
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
    req.end();
  });
}

function setActiveTab(tabId) {
  const tab = tabs.get(tabId);
  if (!mainWindow || !tab) return false;
  activeTabId = tabId;
  tab.lastActiveAt = Date.now();
  if (tab.suspended) {
    tab.suspended = false;
    try {
      tab.view.webContents.setBackgroundThrottling(false);
    } catch {
      // webContents may be destroyed.
    }
  }
  mainWindow.setBrowserView(tab.view);
  setViewBounds();
  syncAudioPolicy();
  publishState();
  return true;
}

function createTab(config = {}, activate = true) {
  const tabConfig = typeof config === "string" ? { url: config } : config || {};
  const initialUrl = tabConfig.url || DEFAULT_HOME;
  const normalizedInitial = normalizeUrl(initialUrl);
  const incognito = Boolean(tabConfig.incognito);
  const javascriptEnabled =
    Boolean(tabConfig.forceJavascript) ||
    isCompatibilityHost(normalizedInitial) ||
    (Boolean(runtimeSettings.enableJavaScript) && !runtimeSettings.follianMode);
  const id = `tab-${++tabCounter}`;
  const view = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, "tabPreload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      backgroundThrottling: true,
      javascript: javascriptEnabled,
      partition: incognito ? `temporary:jb-incognito-${id}` : undefined
    }
  });

  const tab = {
    id,
    view,
    incognito,
    javascriptEnabled,
    url: "",
    title: "New Tab",
    isLoading: false,
    lastActiveAt: Date.now(),
    suspended: false
  };
  tabs.set(id, tab);
  tabOrder.push(id);
  // Hot-path lookup: every web request handler turns webContentsId into a tab via this Map.
  wcIdToTab.set(view.webContents.id, tab);
  attachTabListeners(tab);
  applyTabRuntimePolicies(tab);
  attachSessionHooks(view.webContents.session);

  if (activate || !activeTabId) {
    setActiveTab(id);
  }
  if (normalizedInitial) {
    view.webContents.setUserAgent(buildUserAgent(normalizedInitial));
    view.webContents.loadURL(normalizedInitial);
  } else {
    view.webContents.loadURL(DEFAULT_HOME);
  }

  publishState();
  syncAudioPolicy();
  return id;
}

function rememberClosedTab(tab) {
  if (!tab) return;
  const url = tab.view?.webContents?.getURL?.() || tab.url || DEFAULT_HOME;
  closedTabsHistory.unshift({
    url: url || DEFAULT_HOME,
    incognito: Boolean(tab.incognito),
    closedAt: Date.now()
  });
  if (closedTabsHistory.length > MAX_CLOSED_TABS_HISTORY) {
    closedTabsHistory.splice(MAX_CLOSED_TABS_HISTORY);
  }
}

function reopenClosedTab() {
  const snapshot = closedTabsHistory.shift();
  if (!snapshot) return null;
  const id = createTab(
    {
      url: snapshot.url || DEFAULT_HOME,
      incognito: Boolean(snapshot.incognito)
    },
    true
  );
  return id;
}

function reopenClosedTabAt(index) {
  const safeIndex = Number(index);
  if (!Number.isInteger(safeIndex) || safeIndex < 0 || safeIndex >= closedTabsHistory.length) {
    return null;
  }
  const [snapshot] = closedTabsHistory.splice(safeIndex, 1);
  if (!snapshot) return null;
  return createTab(
    {
      url: snapshot.url || DEFAULT_HOME,
      incognito: Boolean(snapshot.incognito)
    },
    true
  );
}

function serializeClosedTabs() {
  return closedTabsHistory.map((item, index) => ({
    index,
    url: item.url || DEFAULT_HOME,
    incognito: Boolean(item.incognito),
    closedAt: Number(item.closedAt) || Date.now()
  }));
}

function closeTab(tabId, options = {}) {
  const shouldRemember = options.remember !== false;
  if (!tabs.has(tabId)) return false;
  if (tabs.size === 1) {
    const onlyTab = tabs.get(tabId);
    onlyTab.view.webContents.loadURL(DEFAULT_HOME);
    setActiveTab(tabId);
    syncAudioPolicy();
    return true;
  }

  const idx = tabOrder.indexOf(tabId);
  const fallbackId = tabOrder[idx + 1] || tabOrder[idx - 1];
  const tab = tabs.get(tabId);
  if (shouldRemember) {
    rememberClosedTab(tab);
  }
  const legacyFlowId = legacyAuthFlowByTabId.get(tabId);
  if (legacyFlowId) {
    cleanupPendingExternalAuthByTabId(tabId);
    pushLegacyAuthTrace("legacy-flow-cancelled", {
      legacyFlowId,
      tabId,
      reason: "tab-closed"
    });
    void pathAAuthBridge.onLegacyFlowCancelled({
      legacyFlowId,
      reason: "tab-closed"
    });
    legacyAuthFlowByTabId.delete(tabId);
  }
  tabs.delete(tabId);
  tabOrder.splice(idx, 1);
  wcIdToTab.delete(tab.view.webContents.id);
  tab.view.webContents.destroy();

  if (activeTabId === tabId) {
    setActiveTab(fallbackId);
  } else {
    publishState();
  }
  syncAudioPolicy();
  return true;
}

function loadUrl(url) {
  const activeTab = getActiveTab();
  if (!activeTab) return;
  const normalized = normalizeUrl(url);
  if (isCompatibilityHost(normalized) && !activeTab.javascriptEnabled) {
    const oldTabId = activeTab.id;
    const replacementId = createTab(
      { url: normalized, incognito: Boolean(activeTab.incognito), forceJavascript: true },
      true
    );
    if (oldTabId !== replacementId) {
      closeTab(oldTabId, { remember: false });
    }
    return;
  }
  activeTab.view.webContents.setUserAgent(buildUserAgent(normalized));
  activeTab.view.webContents.loadURL(normalized);
}

function recreateTabsForJavascriptMode() {
  const snapshots = tabOrder
    .map((id) => tabs.get(id))
    .filter(Boolean)
    .map((tab) => ({
      url: tab.view.webContents.getURL() || tab.url || DEFAULT_HOME,
      active: tab.id === activeTabId,
      incognito: Boolean(tab.incognito)
    }));
  tabs.forEach((tab) => tab.view.webContents.destroy());
  tabs.clear();
  tabOrder.length = 0;
  activeTabId = null;

  if (!snapshots.length) {
    createTab(DEFAULT_HOME, true);
    return;
  }
  snapshots.forEach((snap, idx) => {
    createTab(
      { url: snap.url || DEFAULT_HOME, incognito: snap.incognito, forceJavascript: isCompatibilityHost(snap.url || "") },
      snap.active || (!activeTabId && idx === 0)
    );
  });
}

function applySettingsToRuntime(nextSettings = {}) {
  const previousJavascript =
    Boolean(runtimeSettings.enableJavaScript) && !Boolean(runtimeSettings.follianMode);
  const previousDoh = String(runtimeSettings.customDohUrl || "");
  runtimeSettings = { ...runtimeSettings, ...(nextSettings || {}) };
  if (mainWindow) {
    mainWindow.setContentProtection(Boolean(runtimeSettings.screenshotProtection));
  }
  for (const ctx of contextsByWindowId.values()) {
    if (ctx.window && !ctx.window.isDestroyed()) {
      ctx.window.setContentProtection(Boolean(runtimeSettings.screenshotProtection));
    }
  }
  tabs.forEach((tab) => applyTabRuntimePolicies(tab));
  syncAudioPolicy();
  enforceCachePolicy();
  const nextDoh = String(runtimeSettings.customDohUrl || "");
  if (nextDoh !== previousDoh) applyDohConfiguration(nextDoh);
  const nextJavascript = Boolean(runtimeSettings.enableJavaScript) && !Boolean(runtimeSettings.follianMode);
  if (previousJavascript !== nextJavascript) {
    recreateTabsForJavascriptMode();
  }
}

// session.defaultSession.configureHostResolver shipped in Electron 24+; guard so older
// runtimes don't crash. Empty url -> automatic (system) DoH; otherwise pin to the user's
// custom server.
function applyDohConfiguration(rawUrl) {
  const url = String(rawUrl || "").trim();
  const ses = session.defaultSession;
  if (!ses?.configureHostResolver) return;
  try {
    if (!url) {
      ses.configureHostResolver({ secureDnsMode: "automatic", secureDnsServers: [] });
    } else {
      ses.configureHostResolver({ secureDnsMode: "secure", secureDnsServers: [url] });
    }
  } catch {
    // Some platforms reject DoH config; ignore.
  }
}

function createMainWindow() {
  const appIconPath = path.join(__dirname, "..", "ui", "assets", "app-logo.png");
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 620,
    icon: appIconPath,
    backgroundColor: "#0f172a",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: true,
      spellcheck: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "..", "ui", "screens", "browser.html"));
  primaryWindowRef = mainWindow;
  createTab({ url: DEFAULT_HOME, incognito: false }, true);

  mainWindow.on("resize", setViewBounds);
  mainWindow.on("closed", () => {
    finalizeAllLegacyFlows("window-closed");
    tabs.forEach((tab) => {
      wcIdToTab.delete(tab.view.webContents.id);
      tab.view.webContents.destroy();
    });
    tabs.clear();
    tabOrder.length = 0;
    activeTabId = null;
    mainWindow = null;
    if (primaryWindowRef === mainWindow) primaryWindowRef = null;
  });
  startIdleSweep();
  // Push the initial adblock badge state once the renderer is alive.
  mainWindow.webContents.once("did-finish-load", () => {
    mainWindow?.webContents?.send("adblock:stats", adblockManager.getStats());
  });
}

// Spawn a real chrome incognito window: same browser.html shell, separate BrowserContext
// (its own tabs/activeTabId map), forced purple theme via the --jb-incognito additional
// argument that preload.js reads. The window's tab BrowserViews share an ephemeral session
// partition so cookies/cache disappear on close.
function createIncognitoWindow(initialUrl = "about:blank") {
  const appIconPath = path.join(__dirname, "..", "ui", "assets", "app-logo.png");
  const win = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 840,
    minHeight: 560,
    icon: appIconPath,
    backgroundColor: "#1d0e2b",
    autoHideMenuBar: true,
    title: "JusBrowse - Incognito",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: true,
      spellcheck: false,
      additionalArguments: ["--jb-incognito"]
    }
  });
  const incognitoPartition = `persist:jb-incognito-tabs-${win.id}-${Date.now()}`;
  const ctx = new BrowserContext(win, {
    incognito: true,
    partition: incognitoPartition,
    themeOverride: "purple"
  });
  contextsByWindowId.set(win.id, ctx);
  incognitoWindows.add(win);
  win.loadFile(path.join(__dirname, "..", "ui", "screens", "browser.html"));
  win.on("resize", () => {
    const activeTabId = ctx.activeTabId;
    const tab = activeTabId ? ctx.tabs.get(activeTabId) : null;
    if (!tab) return;
    const [width, height] = win.getContentSize();
    const top = Math.max(0, Number(ctx.chromeLayout.top) || 0);
    const bottom = Math.max(0, Number(ctx.chromeLayout.bottom) || 0);
    const hide = Boolean(ctx.chromeLayout.hideWebView);
    if (hide) tab.view.setBounds({ x: 0, y: 0, width: 1, height: 1 });
    else tab.view.setBounds({ x: 0, y: top, width, height: Math.max(120, height - top - bottom) });
  });
  win.webContents.once("did-finish-load", () => {
    win.webContents.send("adblock:stats", adblockManager.getStats());
    publishStateForContext(ctx);
  });
  // The first navigation in this window. Keep it simple: just bootstrap the chrome and let
  // the renderer call tabs:new with the user's URL after onState boots up. We pre-create a
  // first tab in this window's context so the chrome has something to show.
  const firstTabId = createIncognitoContextTab(ctx, normalizeUrl(initialUrl));
  ctx.activeTabId = firstTabId;
  win.on("closed", () => {
    incognitoWindows.delete(win);
    for (const tab of ctx.tabs.values()) {
      wcIdToTab.delete(tab.view.webContents.id);
      tabIdToContext.delete(tab.id);
      try {
        tab.view.webContents.destroy();
      } catch {
        // Ignore.
      }
    }
    ctx.tabs.clear();
    ctx.tabOrder.length = 0;
    contextsByWindowId.delete(win.id);
  });
  return win;
}

// Lightweight per-window tab creation for incognito windows. We mirror createTab() but
// scope state to the BrowserContext rather than the global tabs map. The tab is also
// attached to the global wcIdToTab so session hooks still find it.
function createIncognitoContextTab(ctx, initialUrl) {
  const id = `tab-w${ctx.windowId}-${++ctx.tabCounter}`;
  const view = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, "tabPreload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      backgroundThrottling: true,
      javascript: true,
      partition: ctx.partition
    }
  });
  const tab = {
    id,
    view,
    incognito: true,
    javascriptEnabled: true,
    url: "",
    title: "New Tab",
    isLoading: false,
    lastActiveAt: Date.now(),
    suspended: false,
    contextRef: ctx
  };
  ctx.tabs.set(id, tab);
  ctx.tabOrder.push(id);
  wcIdToTab.set(view.webContents.id, tab);
  tabIdToContext.set(id, ctx);
  // Re-use the shared session hook (it will only attach once per session).
  attachSessionHooks(view.webContents.session);
  ctx.window.setBrowserView(view);
  view.setBounds({ x: 0, y: 0, width: 1, height: 1 });
  view.webContents.setUserAgent(buildUserAgent(initialUrl));
  view.webContents.loadURL(initialUrl || DEFAULT_HOME);
  // Mirror the basic listeners; we keep this file lean by only wiring what the chrome
  // actually drives. The full attachTabListeners path is reserved for the primary window.
  const wc = view.webContents;
  wc.on("frame-created", (_event, details) => {
    const frame = details && details.frame;
    if (frame) injectSpoofIntoFrame(frame);
  });
  wc.on("dom-ready", () => injectSpoofIntoAllFrames(wc));
  wc.on("did-start-navigation", () => {
    if (wc.mainFrame) injectSpoofIntoFrame(wc.mainFrame);
  });
  wc.on("did-finish-load", () => {
    if (runtimeSettings.blockCookiePopups) wc.insertCSS(COOKIE_BANNER_CSS).catch(() => {});
    if (runtimeSettings.advancedAdBlock) wc.insertCSS(adblockManager.getCosmeticCss()).catch(() => {});
  });
  attachIncognitoTabRefreshListeners(ctx, tab);
  return id;
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const callbackArg = extractAuthCallbackArg(argv);
    if (callbackArg) {
      void handleProtocolAuthCallback(callbackArg);
    }
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  app.on("open-url", (event, url) => {
    event.preventDefault();
    void handleProtocolAuthCallback(url);
  });
  passwordDbPath = path.join(app.getPath("userData"), "saved-passwords.json");
  savedPasswords = loadSavedPasswords();
  adblockManager.cachePath = path.join(app.getPath("userData"), "blocklist.txt");
  void adblockManager.warmUp().then(() => publishAdblockStatsToAllWindows());
  // Periodic publish so the renderer's blocked-count badge keeps ticking.
  const adblockStatsTimer = setInterval(() => publishAdblockStatsToAllWindows(), 4000);
  if (adblockStatsTimer.unref) adblockStatsTimer.unref();
  applyDohConfiguration(runtimeSettings.customDohUrl);
  createMainWindow();
  const initialCallbackArg = extractAuthCallbackArg(process.argv);
  if (initialCallbackArg) {
    void handleProtocolAuthCallback(initialCallbackArg);
  }
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

function getActiveTabForRoute(route) {
  if (route?.kind === "incognito") {
    const ctx = route.ctx;
    return ctx?.activeTabId ? ctx.tabs.get(ctx.activeTabId) || null : null;
  }
  return getActiveTab();
}

ipcMain.handle("browser:go", (event, url) => {
  const route = ipcRouteForEvent(event);
  if (route.kind === "incognito") {
    const tab = getActiveTabForRoute(route);
    if (!tab) return false;
    const normalized = normalizeUrl(url);
    tab.view.webContents.setUserAgent(buildUserAgent(normalized));
    tab.view.webContents.loadURL(normalized);
    return true;
  }
  loadUrl(url);
  return true;
});

ipcMain.handle("browser:home", (event) => {
  const route = ipcRouteForEvent(event);
  const tab = getActiveTabForRoute(route);
  if (!tab) return false;
  tab.view.webContents.loadURL(DEFAULT_HOME);
  if (route.kind === "incognito") publishStateForContext(route.ctx);
  else publishState();
  return true;
});

ipcMain.handle("browser:back", (event) => {
  const route = ipcRouteForEvent(event);
  const tab = getActiveTabForRoute(route);
  if (!tab) return false;
  const wc = tab.view.webContents;
  if (!wc.navigationHistory.canGoBack()) return false;
  wc.navigationHistory.goBack();
  return true;
});

ipcMain.handle("browser:forward", (event) => {
  const route = ipcRouteForEvent(event);
  const tab = getActiveTabForRoute(route);
  if (!tab) return false;
  const wc = tab.view.webContents;
  if (!wc.navigationHistory.canGoForward()) return false;
  wc.navigationHistory.goForward();
  return true;
});

ipcMain.handle("browser:reload", (event) => {
  const route = ipcRouteForEvent(event);
  const tab = getActiveTabForRoute(route);
  if (!tab) return false;
  tab.view.webContents.reload();
  return true;
});

ipcMain.handle("browser:hard-reload", (event) => {
  const route = ipcRouteForEvent(event);
  const tab = getActiveTabForRoute(route);
  if (!tab) return false;
  tab.view.webContents.reloadIgnoringCache();
  return true;
});

ipcMain.handle("browser:stop", (event) => {
  const route = ipcRouteForEvent(event);
  const tab = getActiveTabForRoute(route);
  if (!tab) return false;
  if (!tab.view.webContents.isLoading()) return false;
  tab.view.webContents.stop();
  return true;
});

ipcMain.handle("browser:zoom", (event, action) => {
  const route = ipcRouteForEvent(event);
  const tab = getActiveTabForRoute(route);
  if (!tab) return false;
  const wc = tab.view.webContents;
  const current = Number(wc.getZoomFactor()) || 1;
  let next = current;
  const verb = String(action || "").toLowerCase();
  if (verb === "in") next = Math.min(5, current + 0.1);
  else if (verb === "out") next = Math.max(0.25, current - 0.1);
  else if (verb === "reset") next = 1;
  else if (typeof action === "number" && Number.isFinite(action)) next = action;
  wc.setZoomFactor(Number(next.toFixed(2)));
  return true;
});

ipcMain.handle("window:toggle-fullscreen", (event) => {
  const sender = event?.sender;
  const win = sender ? BrowserWindow.fromWebContents(sender) : (mainWindow || BrowserWindow.getFocusedWindow());
  if (!win || win.isDestroyed()) return false;
  win.setFullScreen(!win.isFullScreen());
  return true;
});

ipcMain.handle("tabs:new", (event, payload) => {
  const route = ipcRouteForEvent(event);
  let url = DEFAULT_HOME;
  if (typeof payload === "string") url = payload || DEFAULT_HOME;
  else if (payload && typeof payload === "object") url = payload.url || DEFAULT_HOME;
  if (route.kind === "incognito") {
    const id = createIncognitoContextTab(route.ctx, normalizeUrl(url));
    setIncognitoActiveTab(route.ctx, id);
    return { id };
  }
  const config = {
    url,
    incognito: typeof payload === "object" && payload ? Boolean(payload.incognito) : false
  };
  const id = createTab(config, true);
  return { id };
});

ipcMain.handle("windows:new-incognito", (_event, url) => {
  createIncognitoWindow(url || "about:blank");
  return true;
});

ipcMain.handle("tabs:switch", (event, tabId) => {
  const route = ipcRouteForEvent(event);
  if (route.kind === "incognito") return setIncognitoActiveTab(route.ctx, tabId);
  return setActiveTab(tabId);
});

ipcMain.handle("tabs:close", (event, tabId) => {
  const route = ipcRouteForEvent(event);
  if (route.kind === "incognito") return closeIncognitoTab(route.ctx, tabId);
  return closeTab(tabId);
});

ipcMain.handle("tabs:reopen-closed", (event) => {
  const route = ipcRouteForEvent(event);
  if (route.kind === "incognito") return null; // no closed-tabs history kept for incognito
  const reopenedId = reopenClosedTab();
  return reopenedId ? { id: reopenedId } : null;
});

ipcMain.handle("tabs:reopen-closed-at", (event, index) => {
  const route = ipcRouteForEvent(event);
  if (route.kind === "incognito") return null;
  const reopenedId = reopenClosedTabAt(index);
  return reopenedId ? { id: reopenedId } : null;
});

ipcMain.handle("tabs:list-closed", (event) => {
  const route = ipcRouteForEvent(event);
  if (route.kind === "incognito") return [];
  return serializeClosedTabs();
});

ipcMain.on("browser:set-layout", (event, layout) => {
  if (!layout || typeof layout !== "object") return;
  const route = ipcRouteForEvent(event);
  const nextLayout = {
    top: Number(layout.top) || 0,
    bottom: Number(layout.bottom) || 0,
    hideWebView: Boolean(layout.hideWebView)
  };
  if (route.kind === "incognito") {
    route.ctx.chromeLayout = nextLayout;
    const tab = getActiveTabForRoute(route);
    if (!tab) return;
    const [width, height] = route.window.getContentSize();
    if (nextLayout.hideWebView) tab.view.setBounds({ x: 0, y: 0, width: 1, height: 1 });
    else
      tab.view.setBounds({
        x: 0,
        y: nextLayout.top,
        width,
        height: Math.max(120, height - nextLayout.top - nextLayout.bottom)
      });
    return;
  }
  chromeLayout = nextLayout;
  setViewBounds();
});

ipcMain.handle("settings:update-runtime", (_, settings) => {
  applySettingsToRuntime(settings || {});
  return true;
});

ipcMain.handle("settings:clear-cache", async () => {
  const activeTab = getActiveTab();
  if (!activeTab) return false;
  const ses = activeTab.view.webContents.session;
  await ses.clearCache();
  return true;
});

ipcMain.handle("settings:choose-wallpaper-file", async () => {
  const owner = mainWindow || BrowserWindow.getFocusedWindow();
  const dialogOptions = {
    title: "Choose Wallpaper",
    properties: ["openFile"],
    filters: [
      { name: "Images and Videos", extensions: ["png", "jpg", "jpeg", "webp", "gif", "mp4", "webm", "mkv"] }
    ]
  };
  const result = owner ? await dialog.showOpenDialog(owner, dialogOptions) : await dialog.showOpenDialog(dialogOptions);
  if (result.canceled || !result.filePaths.length) return null;
  const filePath = result.filePaths[0];
  const ext = path.extname(filePath).toLowerCase();
  const isVideo = [".mp4", ".webm", ".mkv"].includes(ext);
  return { url: pathToFileURL(filePath).toString(), isVideo, filePath };
});

ipcMain.handle("app:get-system-info", () => {
  return {
    os: `${os.platform()} ${os.arch()}`,
    kernel: os.release(),
    version: APP_VERSION_LABEL,
    electron: process.versions.electron,
    chromium: process.versions.chrome
  };
});

ipcMain.handle("app:copy-to-clipboard", (_, text) => {
  const safeText = String(text || "");
  if (!safeText) return false;
  clipboard.writeText(safeText);
  return true;
});

ipcMain.handle("diagnostics:export-auth", async (_, limit) => {
  return buildDiagnosticsExport(limit);
});

ipcMain.handle("patha:get-auth-diagnostics", async (_, limit) => {
  return pathAAuthBridge.getDiagnostics(limit);
});

ipcMain.handle("authflow:get-trace", async (_, limit) => {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 120, MAX_LEGACY_AUTH_TRACE));
  return {
    summary: {
      activeCount: legacyAuthFlowByTabId.size,
      activeFlows: Array.from(legacyAuthFlowByTabId.entries()).map(([tabId, flowId]) => ({
        id: flowId,
        sourceTabId: tabId
      })),
      lastEvent: legacyAuthTrace[legacyAuthTrace.length - 1] || null
    },
    trace: legacyAuthTrace.slice(-safeLimit)
  };
});

ipcMain.handle("authflow:emit-external-notice", (_, payload) => {
  return emitExternalAuthNotice(payload);
});

ipcMain.handle("passwords:list", () => {
  return savedPasswords.map((item) => ({
    id: item.id,
    host: item.host,
    username: item.username,
    savedAt: item.savedAt
  }));
});

ipcMain.handle("passwords:clear", () => {
  savedPasswords = [];
  persistSavedPasswords();
  return true;
});

ipcMain.on("passwords:capture-form", (event, payload) => {
  const senderId = event?.sender?.id;
  const tab = wcIdToTab.get(senderId) || null;
  if (!tab) return;
  const targetUrl = payload?.url || tab.view.webContents.getURL() || "";
  captureCredentialsFromFields(
    targetUrl,
    payload?.fields || {},
    Boolean(tab.incognito),
    tab.view.webContents
  );
});

// Renderer round-trip for the in-page Save Password banner. action is "save" or "never".
ipcMain.handle("passwords:respond", (_event, payload) => {
  const id = String(payload?.id || "");
  const action = String(payload?.action || "").toLowerCase();
  const pending = id ? pendingPasswordPrompts.get(id) : null;
  if (!pending) return false;
  pendingPasswordPrompts.delete(id);
  if (action === "save") {
    const entry = pending.entry;
    savedPasswords = [
      entry,
      ...savedPasswords.filter((p) => !(p.host === entry.host && p.username === entry.username))
    ].slice(0, 500);
    persistSavedPasswords();
    return true;
  }
  if (action === "never") {
    neverSaveHosts.add(pending.entry.host);
    return true;
  }
  return false;
});

ipcMain.handle("adblock:get-stats", () => adblockManager.getStats());

function publishAdblockStatsToAllWindows() {
  const stats = adblockManager.getStats();
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send("adblock:stats", stats);
  }
}

// --- Incognito-window IPC routing ---------------------------------------------------------
// The main browser window operates on the global tabs/activeTabId/mainWindow state. The
// incognito window operates on its own BrowserContext. ipcRouteForEvent picks which one
// based on the IPC sender's BrowserWindow. The incognito branch uses incognito-specific
// helpers (createIncognitoContextTab et al) that mirror the main-window equivalents but
// keep state scoped to the BrowserContext.
function ipcRouteForEvent(event) {
  const sender = event?.sender;
  if (!sender) return { kind: "main" };
  const win = BrowserWindow.fromWebContents(sender);
  if (win && win !== mainWindow && contextsByWindowId.has(win.id)) {
    return { kind: "incognito", ctx: contextsByWindowId.get(win.id), window: win };
  }
  return { kind: "main" };
}

function publishStateForContext(ctx) {
  if (!ctx?.window || ctx.window.isDestroyed()) return;
  const tabId = ctx.activeTabId;
  const tab = tabId ? ctx.tabs.get(tabId) : null;
  if (!tab) return;
  const wc = tab.view.webContents;
  const currentUrl = wc.getURL() || "";
  let host = "";
  try {
    host = currentUrl ? new URL(currentUrl).host : "";
  } catch {
    host = "";
  }
  const serializedTabs = ctx.tabOrder
    .map((id) => ctx.tabs.get(id))
    .filter(Boolean)
    .map((t) => ({
      id: t.id,
      title: t.title || "New Tab",
      url: t.url || "",
      isLoading: Boolean(t.isLoading),
      isActive: t.id === ctx.activeTabId,
      incognito: true
    }));
  ctx.window.webContents.send("browser:state", {
    url: currentUrl,
    title: wc.getTitle() || "JusBrowse",
    host,
    isSecure: currentUrl.startsWith("https://"),
    isHome: !currentUrl || currentUrl === "about:blank",
    canGoBack: wc.navigationHistory.canGoBack(),
    canGoForward: wc.navigationHistory.canGoForward(),
    isLoading: wc.isLoading(),
    tabs: serializedTabs,
    activeTabId: ctx.activeTabId,
    incognito: true
  });
}

function setIncognitoActiveTab(ctx, tabId) {
  const tab = ctx.tabs.get(tabId);
  if (!ctx.window || !tab) return false;
  ctx.activeTabId = tabId;
  tab.lastActiveAt = Date.now();
  ctx.window.setBrowserView(tab.view);
  const [width, height] = ctx.window.getContentSize();
  const top = Math.max(0, Number(ctx.chromeLayout.top) || 0);
  const bottom = Math.max(0, Number(ctx.chromeLayout.bottom) || 0);
  const hide = Boolean(ctx.chromeLayout.hideWebView);
  if (hide) {
    tab.view.setBounds({ x: 0, y: 0, width: 1, height: 1 });
  } else {
    tab.view.setBounds({ x: 0, y: top, width, height: Math.max(120, height - top - bottom) });
  }
  publishStateForContext(ctx);
  return true;
}

function closeIncognitoTab(ctx, tabId) {
  const tab = ctx.tabs.get(tabId);
  if (!tab) return false;
  if (ctx.tabs.size === 1) {
    tab.view.webContents.loadURL(DEFAULT_HOME);
    setIncognitoActiveTab(ctx, tabId);
    return true;
  }
  const idx = ctx.tabOrder.indexOf(tabId);
  const fallbackId = ctx.tabOrder[idx + 1] || ctx.tabOrder[idx - 1];
  ctx.tabs.delete(tabId);
  if (idx >= 0) ctx.tabOrder.splice(idx, 1);
  wcIdToTab.delete(tab.view.webContents.id);
  tabIdToContext.delete(tabId);
  try {
    tab.view.webContents.destroy();
  } catch {
    // Ignore.
  }
  if (ctx.activeTabId === tabId && fallbackId) setIncognitoActiveTab(ctx, fallbackId);
  else publishStateForContext(ctx);
  return true;
}

function attachIncognitoTabRefreshListeners(ctx, tab) {
  const wc = tab.view.webContents;
  const refresh = () => {
    tab.url = wc.getURL() || "";
    tab.title = wc.getTitle() || "New Tab";
    tab.isLoading = wc.isLoading();
    tab.lastActiveAt = Date.now();
    publishStateForContext(ctx);
  };
  wc.on("did-start-loading", refresh);
  wc.on("did-stop-loading", refresh);
  wc.on("page-title-updated", refresh);
  wc.on("did-navigate", refresh);
  wc.on("did-navigate-in-page", refresh);
}

