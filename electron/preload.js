const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("browserApi", {
  go: (url) => ipcRenderer.invoke("browser:go", url),
  home: () => ipcRenderer.invoke("browser:home"),
  back: () => ipcRenderer.invoke("browser:back"),
  forward: () => ipcRenderer.invoke("browser:forward"),
  reload: () => ipcRenderer.invoke("browser:reload"),
  stop: () => ipcRenderer.invoke("browser:stop"),
  newTab: (payload) => ipcRenderer.invoke("tabs:new", payload),
  newIncognitoWindow: (url) => ipcRenderer.invoke("windows:new-incognito", url),
  switchTab: (tabId) => ipcRenderer.invoke("tabs:switch", tabId),
  closeTab: (tabId) => ipcRenderer.invoke("tabs:close", tabId),
  updateRuntimeSettings: (settings) => ipcRenderer.invoke("settings:update-runtime", settings),
  clearCache: () => ipcRenderer.invoke("settings:clear-cache"),
  chooseWallpaperFile: () => ipcRenderer.invoke("settings:choose-wallpaper-file"),
  getSystemInfo: () => ipcRenderer.invoke("app:get-system-info"),
  getSavedPasswords: () => ipcRenderer.invoke("passwords:list"),
  clearSavedPasswords: () => ipcRenderer.invoke("passwords:clear"),
  setLayout: (top, bottom, hideWebView = false) =>
    ipcRenderer.send("browser:set-layout", { top, bottom, hideWebView }),
  onState: (callback) => {
    const handler = (_, state) => callback(state);
    ipcRenderer.on("browser:state", handler);
    return () => ipcRenderer.removeListener("browser:state", handler);
  }
});

