const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");
const os = require("os");
const { app, BrowserWindow, BrowserView, ipcMain, dialog } = require("electron");

const DEFAULT_HOME = "about:blank";

let mainWindow = null;
let chromeLayout = { top: 0, bottom: 0, hideWebView: true };
let tabCounter = 0;
let activeTabId = null;
const tabs = new Map();
const tabOrder = [];
const DEFAULT_USER_AGENT =
  app.userAgentFallback ||
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const TRACKER_PATTERNS = [
  "doubleclick.net",
  "googlesyndication.com",
  "adservice.google.com",
  "adnxs.com",
  "facebook.net",
  "google-analytics.com",
  "analytics",
  "tracker",
  "pixel"
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
  savePasswords: true
};
const attachedSessions = new WeakSet();
const incognitoWindows = new Set();
let passwordDbPath = "";
let savedPasswords = [];

app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-gpu");

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

function captureCredentialsFromRequest(url, uploadData = [], isIncognito = false) {
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
  const params = new URLSearchParams(body);
  const username =
    params.get("username") || params.get("email") || params.get("login") || params.get("user") || "";
  const password =
    params.get("password") || params.get("passwd") || params.get("pass") || params.get("pwd") || "";
  if (!password) return;
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    host,
    username,
    password,
    savedAt: Date.now()
  };
  savedPasswords = [entry, ...savedPasswords.filter((p) => !(p.host === host && p.username === username))].slice(0, 500);
  persistSavedPasswords();
}

function isTrackerUrl(url) {
  const normalized = String(url || "").toLowerCase();
  return TRACKER_PATTERNS.some((token) => normalized.includes(token));
}

function buildUserAgent() {
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
    canGoBack: wc.canGoBack(),
    canGoForward: wc.canGoForward(),
    isLoading: wc.isLoading(),
    tabs: serializeTabs(),
    activeTabId
  });
}

function attachTabListeners(tab) {
  const wc = tab.view.webContents;
  const refresh = () => {
    tab.url = wc.getURL() || "";
    tab.title = wc.getTitle() || "New Tab";
    tab.isLoading = wc.isLoading();
    if (tab.id === activeTabId && mainWindow) {
      mainWindow.setTitle(tab.title || "JusBrowse");
      publishState();
    } else if (mainWindow) {
      mainWindow.webContents.send("browser:tabs", serializeTabs());
    }
  };

  wc.on("did-start-loading", refresh);
  wc.on("did-stop-loading", refresh);
  wc.on("page-title-updated", refresh);
  wc.on("did-navigate", refresh);
  wc.on("did-navigate-in-page", refresh);
  wc.on("did-fail-load", refresh);
  wc.on("did-finish-load", () => {
    if (runtimeSettings.blockCookiePopups) {
      wc.insertCSS(COOKIE_BANNER_CSS).catch(() => {});
    }
    enforceCachePolicy();
  });
  wc.setWindowOpenHandler(() => ({ action: runtimeSettings.popupBlocker ? "deny" : "allow" }));
}

function applyTabRuntimePolicies(tab) {
  const wc = tab.view.webContents;
  wc.setUserAgent(buildUserAgent());
  wc.setWindowOpenHandler(() => ({ action: runtimeSettings.popupBlocker ? "deny" : "allow" }));
}

function syncAudioPolicy() {
  tabOrder.forEach((id) => {
    const tab = tabs.get(id);
    if (!tab) return;
    if (runtimeSettings.multiMediaPlayback) {
      tab.view.webContents.setAudioMuted(false);
      return;
    }
    tab.view.webContents.setAudioMuted(id !== activeTabId);
  });
}

async function enforceCachePolicy() {
  if (!mainWindow) return;
  const activeTab = getActiveTab();
  if (!activeTab) return;
  const ses = activeTab.view.webContents.session;
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

function attachSessionHooks(ses) {
  if (!ses || attachedSessions.has(ses)) return;
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...(details.requestHeaders || {}) };
    if (runtimeSettings.sendDoNotTrack) headers.DNT = "1";
    else delete headers.DNT;
    callback({ requestHeaders: headers });
  });
  ses.webRequest.onBeforeRequest((details, callback) => {
    const { url = "", resourceType = "", uploadData = [], webContentsId } = details;
    const tab = Array.from(tabs.values()).find((item) => item.view.webContents.id === webContentsId);
    captureCredentialsFromRequest(url, uploadData, Boolean(tab?.incognito));
    if (runtimeSettings.httpsOnlyMode && url.startsWith("http://")) {
      callback({ redirectURL: `https://${url.slice("http://".length)}` });
      return;
    }
    if (shouldSkipProtection(url)) {
      callback({ cancel: false });
      return;
    }
    const shouldBlockTracker = runtimeSettings.blockTrackers && isTrackerUrl(url);
    const shouldBlockScript = runtimeSettings.advancedAdBlock && resourceType === "script" && isTrackerUrl(url);
    callback({ cancel: shouldBlockTracker || shouldBlockScript });
  });
  ses.webRequest.onHeadersReceived((details, callback) => {
    if (!runtimeSettings.advancedAdBlock || shouldSkipProtection(details.url)) {
      callback({ responseHeaders: details.responseHeaders });
      return;
    }
    const responseHeaders = { ...(details.responseHeaders || {}) };
    responseHeaders["Content-Security-Policy"] = [
      "default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; script-src 'self' https: 'unsafe-inline' 'unsafe-eval'"
    ];
    callback({ responseHeaders });
  });
  attachedSessions.add(ses);
}

function setActiveTab(tabId) {
  const tab = tabs.get(tabId);
  if (!mainWindow || !tab) return false;
  activeTabId = tabId;
  mainWindow.setBrowserView(tab.view);
  setViewBounds();
  syncAudioPolicy();
  publishState();
  return true;
}

function createTab(config = {}, activate = true) {
  const tabConfig = typeof config === "string" ? { url: config } : config || {};
  const initialUrl = tabConfig.url || DEFAULT_HOME;
  const incognito = Boolean(tabConfig.incognito);
  const id = `tab-${++tabCounter}`;
  const view = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      javascript: Boolean(runtimeSettings.enableJavaScript) && !runtimeSettings.follianMode,
      partition: incognito ? `temporary:jb-incognito-${id}` : undefined
    }
  });

  const tab = {
    id,
    view,
    incognito,
    url: "",
    title: "New Tab",
    isLoading: false
  };
  tabs.set(id, tab);
  tabOrder.push(id);
  attachTabListeners(tab);
  applyTabRuntimePolicies(tab);
  attachSessionHooks(view.webContents.session);

  if (activate || !activeTabId) {
    setActiveTab(id);
  }
  if (initialUrl) {
    view.webContents.loadURL(normalizeUrl(initialUrl));
  } else {
    view.webContents.loadURL(DEFAULT_HOME);
  }

  publishState();
  syncAudioPolicy();
  return id;
}

function closeTab(tabId) {
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
  tabs.delete(tabId);
  tabOrder.splice(idx, 1);
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
    createTab({ url: snap.url || DEFAULT_HOME, incognito: snap.incognito }, snap.active || (!activeTabId && idx === 0));
  });
}

function applySettingsToRuntime(nextSettings = {}) {
  const previousJavascript =
    Boolean(runtimeSettings.enableJavaScript) && !Boolean(runtimeSettings.follianMode);
  runtimeSettings = { ...runtimeSettings, ...(nextSettings || {}) };
  if (mainWindow) {
    mainWindow.setContentProtection(Boolean(runtimeSettings.screenshotProtection));
  }
  tabs.forEach((tab) => applyTabRuntimePolicies(tab));
  syncAudioPolicy();
  enforceCachePolicy();
  const nextJavascript = Boolean(runtimeSettings.enableJavaScript) && !Boolean(runtimeSettings.follianMode);
  if (previousJavascript !== nextJavascript) {
    recreateTabsForJavascriptMode();
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
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "..", "ui", "screens", "browser.html"));
  createTab({ url: DEFAULT_HOME, incognito: false }, true);

  mainWindow.on("resize", setViewBounds);
  mainWindow.on("closed", () => {
    tabs.forEach((tab) => tab.view.webContents.destroy());
    tabs.clear();
    tabOrder.length = 0;
    activeTabId = null;
    mainWindow = null;
  });
}

function createIncognitoWindow(initialUrl = "about:blank") {
  const appIconPath = path.join(__dirname, "..", "ui", "assets", "app-logo.png");
  const win = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 840,
    minHeight: 560,
    icon: appIconPath,
    backgroundColor: "#0d1221",
    autoHideMenuBar: true,
    title: "JusBrowse - Incognito",
    webPreferences: {
      partition: `temporary:jb-incognito-window-${Date.now()}`,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadURL(normalizeUrl(initialUrl));
  incognitoWindows.add(win);
  win.on("closed", () => incognitoWindows.delete(win));
  return win;
}

app.whenReady().then(() => {
  passwordDbPath = path.join(app.getPath("userData"), "saved-passwords.json");
  savedPasswords = loadSavedPasswords();
  createMainWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("browser:go", (_, url) => {
  loadUrl(url);
  return true;
});

ipcMain.handle("browser:home", () => {
  const activeTab = getActiveTab();
  if (!activeTab) return false;
  activeTab.view.webContents.loadURL(DEFAULT_HOME);
  publishState();
  return true;
});

ipcMain.handle("browser:back", () => {
  const activeTab = getActiveTab();
  if (!activeTab) return false;
  const wc = activeTab.view.webContents;
  if (!wc.canGoBack()) return false;
  wc.goBack();
  return true;
});

ipcMain.handle("browser:forward", () => {
  const activeTab = getActiveTab();
  if (!activeTab) return false;
  const wc = activeTab.view.webContents;
  if (!wc.canGoForward()) return false;
  wc.goForward();
  return true;
});

ipcMain.handle("browser:reload", () => {
  const activeTab = getActiveTab();
  if (!activeTab) return false;
  activeTab.view.webContents.reload();
  return true;
});

ipcMain.handle("browser:stop", () => {
  const activeTab = getActiveTab();
  if (!activeTab) return false;
  if (!activeTab.view.webContents.isLoading()) return false;
  activeTab.view.webContents.stop();
  return true;
});

ipcMain.handle("tabs:new", (_, payload) => {
  let config = { url: DEFAULT_HOME, incognito: false };
  if (typeof payload === "string") {
    config = { url: payload || DEFAULT_HOME, incognito: false };
  } else if (payload && typeof payload === "object") {
    config = {
      url: payload.url || DEFAULT_HOME,
      incognito: Boolean(payload.incognito)
    };
  }
  const id = createTab(config, true);
  return { id };
});

ipcMain.handle("windows:new-incognito", (_, url) => {
  createIncognitoWindow(url || "about:blank");
  return true;
});

ipcMain.handle("tabs:switch", (_, tabId) => {
  return setActiveTab(tabId);
});

ipcMain.handle("tabs:close", (_, tabId) => {
  return closeTab(tabId);
});

ipcMain.on("browser:set-layout", (_, layout) => {
  if (!layout || typeof layout !== "object") return;
  chromeLayout = {
    top: Number(layout.top) || 0,
    bottom: Number(layout.bottom) || 0,
    hideWebView: Boolean(layout.hideWebView)
  };
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
    version: "v1 Wire"
  };
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

