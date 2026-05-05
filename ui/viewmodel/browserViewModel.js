class BrowserViewModel {
  constructor() {
    this.url = "";
    this.title = "JusBrowse";
    this.host = "";
    this.isSecure = false;
    this.isHome = true;
    this.canGoBack = false;
    this.canGoForward = false;
    this.isLoading = false;
    this.tabs = [];
    this.activeTabId = null;
    this.settings = this.loadSettings();
    this.history = this.loadHistory();
  }

  update(next) {
    this.url = next.url || "";
    this.title = next.title || "JusBrowse";
    this.host = next.host || "";
    this.isSecure = Boolean(next.isSecure);
    this.isHome = Boolean(next.isHome);
    this.canGoBack = Boolean(next.canGoBack);
    this.canGoForward = Boolean(next.canGoForward);
    this.isLoading = Boolean(next.isLoading);
    this.tabs = Array.isArray(next.tabs) ? next.tabs : this.tabs;
    this.activeTabId = next.activeTabId || this.activeTabId;
  }

  loadSearchEngine() {
    return this.settings.searchEngine;
  }

  loadSettings() {
    const defaults = {
      searchEngine: "google",
      startupBehavior: "newtab",
      homepageUrl: "https://www.google.com",
      showStatusTag: true,
      autoHidePill: true,
      sendDoNotTrack: true,
      blockTrackers: true,
      darkMode: true,
      extraDarkMode: false,
      themePreset: "dark",
      appFont: "system",
      showTabIcons: true,
      enableWallpapers: false,
      startPageWallpaper: "",
      wallpaperBlur: 0,
      customBackgroundHex: "#0b1326",
      customBackgroundRgba: "rgba(11, 19, 38, 1)",
      customFontColor: "#ecf2ff",
      customAccentColor: "#5f8eff",
      customMutedColor: "#9caecd",
      fingerprintEngine: "default",
      follianProtocol: false,
      protectionWhitelist: "",
      enableJavaScript: true,
      adBlocker: true,
      advancedAdBlock: false,
      httpsOnlyMode: true,
      screenshotProtection: false,
      shareAnonymousAnalytics: true,
      blockCookiePopups: true,
      popupBlocker: true,
      multiMediaPlayback: true,
      follianMode: false,
      virusTotalApiKey: "",
      koodousApiKey: "",
      customDohUrl: "",
      cacheLimitMb: 1024,
      cachePolicy: "smart",
      nuclearWipe: false,
      liveWallpaper: false,
      wallpaperType: "image",
      wallpaperDataUrl: "",
      fontSource: "system",
      googleFontFamily: "Inter",
      customFontFamily: "",
      savePasswords: true
    };

    try {
      const raw = localStorage.getItem("jusbrowse.settings");
      const parsed = raw ? JSON.parse(raw) : {};
      return { ...defaults, ...(parsed || {}) };
    } catch {
      return defaults;
    }
  }

  saveSettings() {
    localStorage.setItem("jusbrowse.settings", JSON.stringify(this.settings));
  }

  updateSettings(patch) {
    this.settings = { ...this.settings, ...(patch || {}) };
    this.saveSettings();
  }

  resetData() {
    localStorage.removeItem("jusbrowse.settings");
    localStorage.removeItem("jusbrowse.history");
    this.settings = this.loadSettings();
    this.history = this.loadHistory();
  }

  loadHistory() {
    try {
      const raw = localStorage.getItem("jusbrowse.history");
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.slice(0, 200);
    } catch {
      return [];
    }
  }

  saveHistory() {
    localStorage.setItem("jusbrowse.history", JSON.stringify(this.history.slice(0, 200)));
  }

  addHistoryEntry(query, targetUrl) {
    const text = String(query || "").trim();
    const url = String(targetUrl || "").trim();
    if (!text && !url) return;
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      query: text,
      url,
      createdAt: Date.now()
    };
    this.history = [entry, ...this.history.filter((item) => item.url !== url || item.query !== text)].slice(0, 200);
    this.saveHistory();
  }

  clearHistory() {
    this.history = [];
    this.saveHistory();
  }
}

window.browserViewModel = new BrowserViewModel();

