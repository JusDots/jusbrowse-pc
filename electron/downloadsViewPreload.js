"use strict";

// Preload for the Downloads popover BrowserView. The popover is its own native child
// view layered above the page so it floats on top of web content the way Chrome's
// downloads dropdown does, without shrinking the page. This preload exposes only the
// surface the popover renderer needs.

const { contextBridge, ipcRenderer } = require("electron");

const isIncognito = process.argv.includes("--jb-incognito");

contextBridge.exposeInMainWorld("downloadsApi", {
  isIncognito,
  openDownload: (id) => ipcRenderer.invoke("downloads:open", id),
  openDownloadFolder: (id) => ipcRenderer.invoke("downloads:open-folder", id),
  requestList: () => ipcRenderer.invoke("downloads:list"),
  requestClose: () => ipcRenderer.send("downloads-popover:close"),
  onSnapshot: (callback) => {
    const handler = (_, payload) => callback(payload);
    ipcRenderer.on("downloads-popover:snapshot", handler);
    return () => ipcRenderer.removeListener("downloads-popover:snapshot", handler);
  },
  onItems: (callback) => {
    const handler = (_, items) => callback(items);
    ipcRenderer.on("downloads-popover:items", handler);
    return () => ipcRenderer.removeListener("downloads-popover:items", handler);
  }
});
