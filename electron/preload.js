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
  setLayout: (top, bottom, hideWebView = false) =>
    ipcRenderer.send("browser:set-layout", { top, bottom, hideWebView }),
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
  }
});
