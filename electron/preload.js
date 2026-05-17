const { contextBridge, ipcRenderer } = require("electron");

// additionalArguments lands here when the main window opts the renderer into incognito mode.
const isIncognito = process.argv.includes("--jb-incognito");

contextBridge.exposeInMainWorld("browserApi", {
  isIncognito,
  go: (url) => ipcRenderer.invoke("browser:go", url),
  home: () => ipcRenderer.invoke("browser:home"),
  back: () => ipcRenderer.invoke("browser:back"),
  forward: () => ipcRenderer.invoke("browser:forward"),
  reload: () => ipcRenderer.invoke("browser:reload"),
  hardReload: () => ipcRenderer.invoke("browser:hard-reload"),
  stop: () => ipcRenderer.invoke("browser:stop"),
  zoom: (action) => ipcRenderer.invoke("browser:zoom", action),
  toggleFullScreen: () => ipcRenderer.invoke("window:toggle-fullscreen"),
  newTab: (payload) => ipcRenderer.invoke("tabs:new", payload),
  newIncognitoWindow: (url) => ipcRenderer.invoke("windows:new-incognito", url),
  switchTab: (tabId) => ipcRenderer.invoke("tabs:switch", tabId),
  closeTab: (tabId) => ipcRenderer.invoke("tabs:close", tabId),
  reopenClosedTab: () => ipcRenderer.invoke("tabs:reopen-closed"),
  reopenClosedTabAt: (index) => ipcRenderer.invoke("tabs:reopen-closed-at", index),
  getClosedTabs: () => ipcRenderer.invoke("tabs:list-closed"),
  updateRuntimeSettings: (settings) => ipcRenderer.invoke("settings:update-runtime", settings),
  clearCache: () => ipcRenderer.invoke("settings:clear-cache"),
  chooseWallpaperFile: () => ipcRenderer.invoke("settings:choose-wallpaper-file"),
  getSystemInfo: () => ipcRenderer.invoke("app:get-system-info"),
  copyToClipboard: (text) => ipcRenderer.invoke("app:copy-to-clipboard", text),
  exportAuthDiagnostics: (limit) => ipcRenderer.invoke("diagnostics:export-auth", limit),
  getAuthFlowTrace: (limit) => ipcRenderer.invoke("authflow:get-trace", limit),
  getPathAAuthDiagnostics: (limit) => ipcRenderer.invoke("patha:get-auth-diagnostics", limit),
  getSavedPasswords: () => ipcRenderer.invoke("passwords:list"),
  clearSavedPasswords: () => ipcRenderer.invoke("passwords:clear"),
  respondToPasswordPrompt: (id, action) => ipcRenderer.invoke("passwords:respond", { id, action }),
  getAdblockStats: () => ipcRenderer.invoke("adblock:get-stats"),
  getDownloads: () => ipcRenderer.invoke("downloads:list"),
  openDownload: (downloadId) => ipcRenderer.invoke("downloads:open", downloadId),
  openDownloadFolder: (downloadId) => ipcRenderer.invoke("downloads:open-folder", downloadId),
  setLayout: (top, bottom, left = 0, right = 0, hideWebView = false) =>
    ipcRenderer.send("browser:set-layout", { top, bottom, left, right, hideWebView }),
  // Notifies main of the current pill context so it can drive the pill BrowserView's
  // bounds (visible rect vs collapsed-off-screen).
  setPillState: (payload) => ipcRenderer.send("pill:set-state", payload),
  setPillTheme: (theme) => ipcRenderer.send("pill:set-theme", theme),
  onPillToggleDownloads: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("pill:toggle-downloads", handler);
    return () => ipcRenderer.removeListener("pill:toggle-downloads", handler);
  },
  onPillOpenSettings: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("pill:open-settings", handler);
    return () => ipcRenderer.removeListener("pill:open-settings", handler);
  },
  onPillToggleAdblock: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("pill:toggle-adblock", handler);
    return () => ipcRenderer.removeListener("pill:toggle-adblock", handler);
  },
  onPillGo: (callback) => {
    const handler = (_, raw) => callback(raw);
    ipcRenderer.on("pill:go", handler);
    return () => ipcRenderer.removeListener("pill:go", handler);
  },
  onState: (callback) => {
    const handler = (_, state) => callback(state);
    ipcRenderer.on("browser:state", handler);
    return () => ipcRenderer.removeListener("browser:state", handler);
  },
  onExternalAuthNotice: (callback) => {
    const handler = (_, payload) => callback(payload);
    ipcRenderer.on("auth:external-notice", handler);
    return () => ipcRenderer.removeListener("auth:external-notice", handler);
  },
  onPasswordOffer: (callback) => {
    const handler = (_, payload) => callback(payload);
    ipcRenderer.on("passwords:offer", handler);
    return () => ipcRenderer.removeListener("passwords:offer", handler);
  },
  onAdblockStats: (callback) => {
    const handler = (_, payload) => callback(payload);
    ipcRenderer.on("adblock:stats", handler);
    return () => ipcRenderer.removeListener("adblock:stats", handler);
  },
  onDownloadsUpdated: (callback) => {
    const handler = (_, payload) => callback(payload);
    ipcRenderer.on("downloads:updated", handler);
    return () => ipcRenderer.removeListener("downloads:updated", handler);
  }
});
