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
    this.externalAuthNotices = [];
    this.passwordPrompts = [];
    this.adblockStats = { blockedCount: 0, hostCount: 0, source: "fallback", ready: false };
    this.downloads = [];
    // Memoized wallpaper resolution: the renderer used to compose the data: URL on every
    // settings render which forced the PNG to re-decode through the cssparser. Cache it by
    // input so subsequent renders reuse the same string.
    this._wallpaperCache = new Map();
    this.settings = this.loadSettings();
    this.history = this.loadHistory();
  }

  resolveWallpaperImage(themePreset) {
    const enableWallpapers = Boolean(this.settings.enableWallpapers);
    if (!enableWallpapers) return "";
    const customSource = this.settings.wallpaperDataUrl || this.settings.startPageWallpaper;
    const themeKey = String(themePreset || this.settings.themePreset || "dark").toLowerCase();
    const cacheKey = customSource ? `c:${customSource}` : `t:${themeKey}`;
    if (this._wallpaperCache.has(cacheKey)) return this._wallpaperCache.get(cacheKey);
    let resolved = "";
    if (customSource) {
      const isRemoteOrFile =
        /^https?:\/\//i.test(customSource) ||
        /^file:\/\//i.test(customSource) ||
        /^data:/i.test(customSource);
      resolved = isRemoteOrFile ? `url("${customSource}")` : customSource;
    } else if (themeKey && themeKey !== "custom") {
      resolved = `url("../assets/wallpapers/theme-${themeKey}.png")`;
    }
    this._wallpaperCache.set(cacheKey, resolved);
    return resolved;
  }

  invalidateWallpaperCache() {
    this._wallpaperCache.clear();
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
      savePasswords: true,
      pillPosition: "bottom",
      showAdblockShield: true,
      tabsPosition: "bottom",
      stickers: []
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
    if (patch && (
      "enableWallpapers" in patch ||
      "wallpaperDataUrl" in patch ||
      "startPageWallpaper" in patch ||
      "themePreset" in patch
    )) {
      this.invalidateWallpaperCache();
    }
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

  addPasswordPrompt(prompt) {
    const safe = prompt && typeof prompt === "object" ? prompt : {};
    const normalized = {
      id: String(safe.id || `pw-${Date.now()}`),
      host: String(safe.host || ""),
      username: String(safe.username || ""),
      capturedAt: Number(safe.capturedAt || Date.now())
    };
    this.passwordPrompts = [...this.passwordPrompts, normalized].slice(-3);
    return normalized;
  }

  removePasswordPrompt(id) {
    this.passwordPrompts = this.passwordPrompts.filter((entry) => entry.id !== id);
  }

  setAdblockStats(stats) {
    if (!stats || typeof stats !== "object") return;
    this.adblockStats = {
      blockedCount: Number(stats.blockedCount || 0),
      hostCount: Number(stats.hostCount || 0),
      source: String(stats.source || "fallback"),
      ready: Boolean(stats.ready)
    };
  }

  setDownloads(items) {
    this.downloads = Array.isArray(items)
      ? items.map((item) => ({
          id: String(item?.id || ""),
          fileName: String(item?.fileName || "Download"),
          url: String(item?.url || ""),
          targetPath: String(item?.targetPath || ""),
          state: String(item?.state || "progressing"),
          startedAt: Number(item?.startedAt || Date.now()),
          endedAt: Number(item?.endedAt || 0),
          totalBytes: Number(item?.totalBytes || 0),
          receivedBytes: Number(item?.receivedBytes || 0),
          percent: Number(item?.percent || 0),
          canOpen: Boolean(item?.canOpen)
        }))
      : [];
  }

  getStickers() {
    return Array.isArray(this.settings.stickers) ? this.settings.stickers : [];
  }

  addSticker(sticker) {
    const safe = sticker && typeof sticker === "object" ? sticker : {};
    const normalized = {
      id: String(safe.id || `sticker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      src: String(safe.src || ""),
      x: Number.isFinite(safe.x) ? Number(safe.x) : 0.5,
      y: Number.isFinite(safe.y) ? Number(safe.y) : 0.6,
      size: Number.isFinite(safe.size) ? Number(safe.size) : 140,
      addedAt: Number(safe.addedAt || Date.now())
    };
    if (!normalized.src) return null;
    const next = [...this.getStickers(), normalized].slice(-40);
    this.updateSettings({ stickers: next });
    return normalized;
  }

  updateStickerPosition(id, x, y) {
    const stickers = this.getStickers().map((s) => (s.id === id ? { ...s, x, y } : s));
    this.updateSettings({ stickers });
  }

  updateStickerSize(id, size) {
    const clamped = Math.max(40, Math.min(420, Number(size) || 140));
    const stickers = this.getStickers().map((s) => (s.id === id ? { ...s, size: clamped } : s));
    this.updateSettings({ stickers });
  }

  removeSticker(id) {
    const stickers = this.getStickers().filter((s) => s.id !== id);
    this.updateSettings({ stickers });
  }

  clearStickers() {
    this.updateSettings({ stickers: [] });
  }

  addExternalAuthNotice(notice) {
    const safeNotice = notice && typeof notice === "object" ? notice : {};
    const normalized = {
      id: String(safeNotice.id || `notice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      at: Number(safeNotice.at || Date.now()),
      noticeType: String(safeNotice.noticeType || "info"),
      message: String(safeNotice.message || ""),
      correlationId: String(safeNotice.correlationId || ""),
      terminalReason: String(safeNotice.terminalReason || "")
    };
    this.externalAuthNotices = [...this.externalAuthNotices, normalized].slice(-5);
    return normalized;
  }
}

window.browserViewModel = new BrowserViewModel();

