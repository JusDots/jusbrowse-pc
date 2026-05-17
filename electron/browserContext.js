"use strict";

// Per-window browser context. Holds tabs/activeTabId/window/chrome layout/auth flow state
// scoped to a single BrowserWindow. main.js keys these by win.id so a normal window and
// a separate purple incognito window can run side by side without trampling each other.
class BrowserContext {
  constructor(window, options = {}) {
    this.window = window;
    this.windowId = window?.id || 0;
    this.tabs = new Map();
    this.tabOrder = [];
    this.activeTabId = null;
    this.tabCounter = 0;
    this.chromeLayout = { top: 0, bottom: 0, left: 0, right: 0, hideWebView: true };
    this.incognito = Boolean(options.incognito);
    this.themeOverride = options.themeOverride || null;
    this.partition = options.partition || null;
    this.legacyAuthFlowByTabId = new Map();
    this.popupAttemptGuard = new Map();
    this.closedTabsHistory = [];
    // Pill BrowserView (a small native child view layered above the page) and the
    // per-window state that drives its visibility / snapshot forwarding.
    this.pillView = null;
    // Per-window downloads popover BrowserView (floats above the page like Chrome).
    this.downloadsView = null;
    this.downloadsTheme = null;
    this.pillState = {
      chromeWantsVisible: false,
      pillHovered: false,
      pillPosition: "bottom",
      tabsPosition: "bottom",
      isSettingsOpen: false,
      isHome: true,
      isDownloadsOpen: false,
      autoHidePill: true,
      snapshot: null,
      hideTimer: null,
      lastY: null,
      slideTimer: null
    };
  }
}

module.exports = { BrowserContext };
