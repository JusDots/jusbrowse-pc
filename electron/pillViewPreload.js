"use strict";

// Preload for the bottom-pill BrowserView. The pill lives in its own native child
// BrowserView so it can paint above the page BrowserView without the page having to
// resize when the pill appears. This file exposes just the API surface the pill UI
// needs — page navigation, theme/state sync, and an explicit revealed/hidden ping
// the main process uses to size the pill view.

const { contextBridge, ipcRenderer } = require("electron");

const isIncognito = process.argv.includes("--jb-incognito");

contextBridge.exposeInMainWorld("pillApi", {
  isIncognito,
  // The chrome owns URL/search resolution (executeSearchOrGo + buildTargetUrl), so
  // the pill forwards the raw input to main as a "request" event; main re-emits it on
  // the chrome's webContents which runs the canonical resolver. This avoids the
  // "hello" -> "https://hello/" pitfall where the pill bypassed the resolver.
  requestGo: (rawInput) => ipcRenderer.send("pill:request-go", String(rawInput || "")),
  home: () => ipcRenderer.invoke("browser:home"),
  back: () => ipcRenderer.invoke("browser:back"),
  forward: () => ipcRenderer.invoke("browser:forward"),
  reload: () => ipcRenderer.invoke("browser:reload"),
  stop: () => ipcRenderer.invoke("browser:stop"),
  toggleDownloads: () => ipcRenderer.send("pill:request-toggle-downloads"),
  openSettings: () => ipcRenderer.send("pill:request-open-settings"),
  openIncognito: () => ipcRenderer.send("pill:request-new-incognito"),
  toggleAdblock: () => ipcRenderer.send("pill:request-toggle-adblock"),
  setHovered: (hovered) => ipcRenderer.send("pill:set-hovered", Boolean(hovered)),
  onSnapshot: (callback) => {
    const handler = (_, payload) => callback(payload);
    ipcRenderer.on("pill:snapshot", handler);
    return () => ipcRenderer.removeListener("pill:snapshot", handler);
  },
  onFocusUrl: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("pill:focus-url", handler);
    return () => ipcRenderer.removeListener("pill:focus-url", handler);
  }
});
