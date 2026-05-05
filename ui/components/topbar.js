(() => {
  const vm = window.browserViewModel;
  const api = window.browserApi;

  const $ = (id) => document.getElementById(id);
  const startScreen = $("startScreen");
  const startWallpaperVideo = $("startWallpaperVideo");
  const bottomPill = $("bottomPill");
  const bottomRevealZone = $("bottomRevealZone");
  const tabsDock = $("tabsDock");
  const tabsList = $("tabsList");
  const settingsPage = $("settingsPage");
  const settingsNavButtons = document.querySelectorAll(".settings-nav");
  const settingsSections = document.querySelectorAll(".settings-section");
  const historyList = $("historyList");
  const passwordList = $("passwordList");
  const customThemeRow = $("customThemeRow");
  const aboutOs = $("aboutOs");
  const aboutKernel = $("aboutKernel");
  const aboutVersion = $("aboutVersion");
  const wallpaperSettingsRows = document.querySelectorAll(".wallpaper-option-row");

  const controls = {
    backBtn: $("backBtn"),
    forwardBtn: $("forwardBtn"),
    homeBtn: $("homeBtn"),
    reloadBtn: $("reloadBtn"),
    stopBtn: $("stopBtn"),
    goBtn: $("goBtn"),
    urlInput: $("urlInput"),
    settingsBtn: $("settingsBtn"),
    closeSettingsBtn: $("closeSettingsBtn"),
    newTabBtn: $("newTabBtn"),
    newIncognitoTabBtn: $("newIncognitoTabBtn"),
    incognitoBtn: $("incognitoBtn"),
    openIncognitoFromSettingsBtn: $("openIncognitoFromSettingsBtn"),
    statusText: $("statusText"),
    progressTrack: $("progressTrack")
  };

  const inputs = {
    searchEngineSelect: $("searchEngineSelect"),
    startupBehaviorSelect: $("startupBehaviorSelect"),
    homepageUrlInput: $("homepageUrlInput"),
    autoHidePillToggle: $("autoHidePillToggle"),
    darkModeToggle: $("darkModeToggle"),
    extraDarkModeToggle: $("extraDarkModeToggle"),
    showTabIconsToggle: $("showTabIconsToggle"),
    enableWallpapersToggle: $("enableWallpapersToggle"),
    showStatusTagToggle: $("showStatusTagToggle"),
    startPageWallpaperInput: $("startPageWallpaperInput"),
    chooseWallpaperBtn: $("chooseWallpaperBtn"),
    wallpaperBlurRange: $("wallpaperBlurRange"),
    wallpaperBlurValue: $("wallpaperBlurValue"),
    liveWallpaperToggle: $("liveWallpaperToggle"),
    backgroundColorPicker: $("backgroundColorPicker"),
    fontColorPicker: $("fontColorPicker"),
    accentColorPicker: $("accentColorPicker"),
    mutedColorPicker: $("mutedColorPicker"),
    fontSourceSelect: $("fontSourceSelect"),
    googleFontInput: $("googleFontInput"),
    customFontInput: $("customFontInput"),
    fingerprintEngineSelect: $("fingerprintEngineSelect"),
    protectionWhitelistInput: $("protectionWhitelistInput"),
    doNotTrackToggle: $("doNotTrackToggle"),
    blockTrackersToggle: $("blockTrackersToggle"),
    enableJavaScriptToggle: $("enableJavaScriptToggle"),
    advancedAdBlockToggle: $("advancedAdBlockToggle"),
    httpsOnlyModeToggle: $("httpsOnlyModeToggle"),
    blockCookiePopupsToggle: $("blockCookiePopupsToggle"),
    popupBlockerToggle: $("popupBlockerToggle"),
    multiMediaPlaybackToggle: $("multiMediaPlaybackToggle"),
    follianModeToggle: $("follianModeToggle"),
    follianProtocolToggle: $("follianProtocolToggle"),
    screenshotProtectionToggle: $("screenshotProtectionToggle"),
    shareAnalyticsToggle: $("shareAnalyticsToggle"),
    virusTotalApiKeyInput: $("virusTotalApiKeyInput"),
    koodousApiKeyInput: $("koodousApiKeyInput"),
    customDohUrlInput: $("customDohUrlInput"),
    cacheLimitRange: $("cacheLimitRange"),
    cacheLimitValue: $("cacheLimitValue"),
    cachePolicySelect: $("cachePolicySelect"),
    nuclearWipeToggle: $("nuclearWipeToggle"),
    clearCacheBtn: $("clearCacheBtn"),
    clearDataBtn: $("clearDataBtn"),
    clearHistoryBtn: $("clearHistoryBtn"),
    savePasswordsToggle: $("savePasswordsToggle"),
    clearPasswordsBtn: $("clearPasswordsBtn")
  };

  const themePresetGroup = $("themePresetGroup");
  const fontGroup = $("fontGroup");

  const SEARCH_ENGINES = {
    google: "https://www.google.com/search?q=",
    duckduckgo: "https://duckduckgo.com/?q=",
    bing: "https://www.bing.com/search?q=",
    brave: "https://search.brave.com/search?q="
  };
  const BUILTIN_THEME_WALLPAPERS = [
    "../assets/wallpapers/theme-dark.png",
    "../assets/wallpapers/theme-light.png",
    "../assets/wallpapers/theme-purple.png"
  ];

  let isSettingsPageOpen = false;
  let progressTimer = null;
  let progressValue = 0;
  const TABS_DOCK_HEIGHT = 42;
  const PILL_HEIGHT_WHEN_VISIBLE = 72;

  const updateRuntimeSettings = () => api.updateRuntimeSettings?.(vm.settings);

  const isPillVisible = () => bottomPill.classList.contains("visible") || bottomPill.classList.contains("home-mode");

  const syncLayout = () => {
    if (vm.isHome || isSettingsPageOpen) {
      api.setLayout(0, 0, true);
      return;
    }
    const bottomInset = TABS_DOCK_HEIGHT + (isPillVisible() ? PILL_HEIGHT_WHEN_VISIBLE : 0);
    api.setLayout(0, bottomInset, false);
  };

  const setBottomPillVisible = (visible) => {
    if (visible) bottomPill.classList.add("visible");
    else bottomPill.classList.remove("visible");
    syncLayout();
  };

  const startProgress = () => {
    if (progressTimer) return;
    controls.progressTrack.classList.add("visible");
    progressValue = 8;
    controls.progressTrack.style.setProperty("--progress-value", `${progressValue}%`);
    progressTimer = setInterval(() => {
      progressValue = Math.min(progressValue + 9, 90);
      controls.progressTrack.style.setProperty("--progress-value", `${progressValue}%`);
    }, 120);
  };

  const stopProgress = () => {
    if (progressTimer) {
      clearInterval(progressTimer);
      progressTimer = null;
    }
    controls.progressTrack.style.setProperty("--progress-value", "100%");
    setTimeout(() => {
      controls.progressTrack.classList.remove("visible");
      controls.progressTrack.style.setProperty("--progress-value", "0%");
    }, 180);
  };

  const highlightActiveOption = (container, dataKey, value) => {
    container?.querySelectorAll(".option-chip").forEach((chip) => {
      chip.classList.toggle("active", chip.dataset[dataKey] === value);
    });
  };

  const ensureGoogleFontLink = (family) => {
    const clean = String(family || "").trim();
    let link = document.getElementById("googleFontLink");
    if (!clean) {
      if (link) link.remove();
      return;
    }
    if (!link) {
      link = document.createElement("link");
      link.id = "googleFontLink";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(clean).replace(/%20/g, "+")}:wght@400;600;700&display=swap`;
  };

  const getThemeWallpaperByPreset = (themePreset) => {
    const key = String(themePreset || "").trim().toLowerCase();
    if (!key || key === "custom") return "";
    return BUILTIN_THEME_WALLPAPERS.find((path) => path.toLowerCase().includes(key)) || "";
  };

  const resolveWallpaperSource = () => {
    if (!vm.settings.enableWallpapers) return "";
    const customSource = vm.settings.wallpaperDataUrl || vm.settings.startPageWallpaper;
    if (customSource) return customSource;
    return getThemeWallpaperByPreset(vm.settings.themePreset);
  };

  const syncWallpaperSettingsVisibility = () => {
    const showWallpaperControls = Boolean(vm.settings.enableWallpapers);
    wallpaperSettingsRows.forEach((row) => {
      row.style.display = showWallpaperControls ? "grid" : "none";
    });
  };

  const applyThemeAndAppearance = () => {
    document.body.classList.toggle("extra-dark", vm.settings.extraDarkMode);
    document.body.classList.remove("theme-dark", "theme-purple");
    if (vm.settings.themePreset === "dark") document.body.classList.add("theme-dark");
    if (vm.settings.themePreset === "purple") document.body.classList.add("theme-purple");
    if (vm.settings.themePreset === "light") document.body.classList.add("light-mode");
    else document.body.classList.remove("light-mode");
    const useCustomTheme = vm.settings.themePreset === "custom";
    if (useCustomTheme) {
      document.body.style.background = vm.settings.customBackgroundRgba || vm.settings.customBackgroundHex || "#0b1326";
      document.documentElement.style.setProperty("--text", vm.settings.customFontColor || "#ecf2ff");
      document.documentElement.style.setProperty("--accent", vm.settings.customAccentColor || "#5f8eff");
      document.documentElement.style.setProperty("--accent-2", vm.settings.customAccentColor || "#5f8eff");
      document.documentElement.style.setProperty("--muted", vm.settings.customMutedColor || "#9caecd");
    } else {
      document.body.style.removeProperty("background");
      document.documentElement.style.removeProperty("--text");
      document.documentElement.style.removeProperty("--accent");
      document.documentElement.style.removeProperty("--accent-2");
      document.documentElement.style.removeProperty("--muted");
    }

    document.body.classList.remove("font-serif", "font-mono");
    document.body.style.removeProperty("font-family");
    if (vm.settings.appFont === "serif") document.body.classList.add("font-serif");
    else if (vm.settings.appFont === "mono") document.body.classList.add("font-mono");
    else if (vm.settings.fontSource === "google") {
      ensureGoogleFontLink(vm.settings.googleFontFamily);
      if (vm.settings.googleFontFamily) {
        document.body.style.fontFamily = `"${vm.settings.googleFontFamily}", Inter, "Segoe UI", sans-serif`;
      }
    } else if (vm.settings.fontSource === "custom" && vm.settings.customFontFamily) {
      document.body.style.fontFamily = `${vm.settings.customFontFamily}, Inter, "Segoe UI", sans-serif`;
    }

    const wallpaperSrc = resolveWallpaperSource();
    const hasImageWallpaper = Boolean(wallpaperSrc) && (vm.settings.wallpaperType !== "video" || !vm.settings.liveWallpaper);
    document.body.classList.toggle("has-wallpaper", hasImageWallpaper);
    if (hasImageWallpaper) {
      document.body.style.setProperty("--wallpaper-image", `url("${wallpaperSrc}")`);
    } else {
      document.body.style.removeProperty("--wallpaper-image");
    }

    const hasLiveVideo = Boolean(wallpaperSrc) && vm.settings.wallpaperType === "video" && vm.settings.liveWallpaper;
    document.body.classList.toggle("has-live-wallpaper", hasLiveVideo);
    if (hasLiveVideo) {
      startWallpaperVideo.src = wallpaperSrc;
      startWallpaperVideo.play().catch(() => {});
    } else {
      startWallpaperVideo.pause();
      startWallpaperVideo.removeAttribute("src");
      startWallpaperVideo.load();
    }
    document.body.style.setProperty("--wallpaper-blur", `${vm.settings.wallpaperBlur || 0}px`);
  };

  const applySettingsToUi = () => {
    const s = vm.settings;
    inputs.searchEngineSelect.value = s.searchEngine;
    inputs.startupBehaviorSelect.value = s.startupBehavior;
    inputs.homepageUrlInput.value = s.homepageUrl;
    inputs.autoHidePillToggle.checked = s.autoHidePill;
    inputs.darkModeToggle.checked = s.darkMode;
    inputs.extraDarkModeToggle.checked = s.extraDarkMode;
    inputs.showTabIconsToggle.checked = s.showTabIcons;
    inputs.enableWallpapersToggle.checked = s.enableWallpapers;
    inputs.showStatusTagToggle.checked = s.showStatusTag;
    inputs.startPageWallpaperInput.value = s.startPageWallpaper;
    inputs.wallpaperBlurRange.value = s.wallpaperBlur;
    inputs.wallpaperBlurValue.textContent = `${s.wallpaperBlur} px`;
    inputs.liveWallpaperToggle.checked = s.liveWallpaper;
    const bgHex = s.customBackgroundHex || "#0b1326";
    inputs.backgroundColorPicker.value = bgHex;
    inputs.fontColorPicker.value = s.customFontColor || "#ecf2ff";
    inputs.accentColorPicker.value = s.customAccentColor || "#5f8eff";
    inputs.mutedColorPicker.value = s.customMutedColor || "#9caecd";
    inputs.fontSourceSelect.value = s.fontSource;
    inputs.googleFontInput.value = s.googleFontFamily;
    inputs.customFontInput.value = s.customFontFamily;
    inputs.fingerprintEngineSelect.value = s.fingerprintEngine;
    inputs.protectionWhitelistInput.value = s.protectionWhitelist;
    inputs.doNotTrackToggle.checked = s.sendDoNotTrack;
    inputs.blockTrackersToggle.checked = s.blockTrackers;
    inputs.enableJavaScriptToggle.checked = s.enableJavaScript;
    inputs.advancedAdBlockToggle.checked = s.advancedAdBlock;
    inputs.httpsOnlyModeToggle.checked = s.httpsOnlyMode;
    inputs.blockCookiePopupsToggle.checked = s.blockCookiePopups;
    inputs.popupBlockerToggle.checked = s.popupBlocker;
    inputs.multiMediaPlaybackToggle.checked = s.multiMediaPlayback;
    inputs.follianModeToggle.checked = s.follianMode;
    inputs.follianProtocolToggle.checked = s.follianProtocol;
    inputs.screenshotProtectionToggle.checked = s.screenshotProtection;
    inputs.shareAnalyticsToggle.checked = s.shareAnonymousAnalytics;
    inputs.virusTotalApiKeyInput.value = s.virusTotalApiKey;
    inputs.koodousApiKeyInput.value = s.koodousApiKey;
    inputs.customDohUrlInput.value = s.customDohUrl;
    inputs.cacheLimitRange.value = s.cacheLimitMb;
    inputs.cacheLimitValue.textContent = `${s.cacheLimitMb} MB`;
    inputs.cachePolicySelect.value = s.cachePolicy;
    inputs.nuclearWipeToggle.checked = s.nuclearWipe;
    inputs.savePasswordsToggle.checked = s.savePasswords;
    controls.statusText.style.display = s.showStatusTag ? "block" : "none";

    applyThemeAndAppearance();
    highlightActiveOption(themePresetGroup, "themePreset", s.themePreset);
    highlightActiveOption(fontGroup, "font", s.appFont);
    customThemeRow.style.display = s.themePreset === "custom" ? "grid" : "none";
    syncWallpaperSettingsVisibility();
    renderHistory();
    renderPasswords();
  };

  const saveSettings = (patch, syncRuntime = true) => {
    vm.updateSettings(patch || {});
    applySettingsToUi();
    renderTabs();
    if (syncRuntime) updateRuntimeSettings();
  };

  const applyAboutSystemInfo = async () => {
    const info = (await api.getSystemInfo?.()) || {};
    if (aboutVersion) aboutVersion.textContent = info.version || "v1 Wire";
    if (aboutOs) aboutOs.textContent = info.os || navigator.platform || "-";
    if (aboutKernel) aboutKernel.textContent = info.kernel || "-";
  };

  const activateSettingsSection = (sectionId) => {
    settingsNavButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.section === sectionId));
    settingsSections.forEach((section) => section.classList.toggle("active", section.id === sectionId));
  };

  const openSettingsPage = () => {
    isSettingsPageOpen = true;
    settingsPage.classList.add("visible");
    setBottomPillVisible(true);
    activateSettingsSection("section-general");
    applySettingsToUi();
    syncLayout();
    document.title = "Settings - JusBrowse";
  };

  const closeSettingsPage = () => {
    isSettingsPageOpen = false;
    settingsPage.classList.remove("visible");
    if (!vm.isHome && vm.settings.autoHidePill) setBottomPillVisible(false);
    syncLayout();
  };

  const buildTargetUrl = (raw) => {
    const input = String(raw || "").trim();
    if (!input) return "";
    if (input.startsWith("http://") || input.startsWith("https://")) return input;
    if (input.includes(".") && !input.includes(" ")) return `https://${input}`;
    return `${SEARCH_ENGINES[vm.settings.searchEngine] || SEARCH_ENGINES.google}${encodeURIComponent(input)}`;
  };

  const toHost = (value) => {
    try {
      return new URL(value).hostname;
    } catch {
      return "";
    }
  };

  const faviconUrl = (targetUrl) => {
    const host = toHost(targetUrl);
    if (!host) return "";
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`;
  };

  const renderTabs = () => {
    tabsList.innerHTML = "";
    const tabs = [...(vm.tabs || [])];
    if (!tabs.length && vm.activeTabId) {
      tabs.push({ id: vm.activeTabId, title: vm.title || "New Tab", url: vm.url || "", isActive: true });
    }
    tabs.forEach((tab) => {
      const tabButton = document.createElement("button");
      tabButton.className = `tab-chip${tab.id === vm.activeTabId ? " active" : ""}`;
      tabButton.title = tab.url || tab.title;

      if (vm.settings.showTabIcons) {
        const favicon = document.createElement("img");
        favicon.className = "tab-favicon";
        favicon.src = faviconUrl(tab.url);
        favicon.alt = "";
        favicon.referrerPolicy = "no-referrer";
        tabButton.appendChild(favicon);
      }
      const title = document.createElement("span");
      title.className = "tab-title";
      title.textContent = `${tab.incognito ? "Incognito • " : ""}${tab.title || tab.url || "New Tab"}`;
      tabButton.appendChild(title);

      const close = document.createElement("span");
      close.className = "tab-close";
      close.textContent = "x";
      close.title = "Close tab";
      close.addEventListener("click", async (event) => {
        event.stopPropagation();
        await api.closeTab(tab.id);
      });
      tabButton.appendChild(close);
      tabButton.addEventListener("click", async () => api.switchTab(tab.id));
      tabsList.appendChild(tabButton);
    });
  };

  const renderHistory = () => {
    historyList.innerHTML = "";
    if (!vm.history.length) {
      const empty = document.createElement("div");
      empty.className = "history-item";
      empty.innerHTML = `<div class="history-url">No history yet.</div>`;
      historyList.appendChild(empty);
      return;
    }
    vm.history.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "history-item";
      row.innerHTML = `<div class="history-query">${entry.query || "(typed address)"}</div><div class="history-url">${entry.url || ""}</div>`;
      row.addEventListener("click", () => executeSearchOrGo(entry.url || entry.query || ""));
      historyList.appendChild(row);
    });
  };

  const renderPasswords = async () => {
    passwordList.innerHTML = "";
    const items = (await api.getSavedPasswords?.()) || [];
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "history-item";
      empty.innerHTML = `<div class="history-url">No saved passwords.</div>`;
      passwordList.appendChild(empty);
      return;
    }
    items.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "history-item";
      row.innerHTML = `<div class="history-query">${entry.username || "(unknown user)"}</div><div class="history-url">${entry.host}</div><div class="history-meta">Saved ${new Date(entry.savedAt).toLocaleString()}</div>`;
      passwordList.appendChild(row);
    });
  };

  const executeSearchOrGo = async (value) => {
    const raw = String(value || "").trim();
    if (!raw) return;
    if (raw.toLowerCase() === "chrome://settings" || raw.toLowerCase() === "jusbrowse://settings") {
      openSettingsPage();
      return;
    }
    closeSettingsPage();
    const target = buildTargetUrl(raw);
    if (!target) return;
    vm.addHistoryEntry(raw, target);
    renderHistory();
    await api.go(target);
    if (!vm.isHome && vm.settings.autoHidePill) setBottomPillVisible(false);
  };

  const openIncognitoTab = async () => {
    await api.newIncognitoWindow?.("about:blank");
    setBottomPillVisible(true);
  };

  const render = (fromStateUpdate = false) => {
    controls.backBtn.disabled = !vm.canGoBack;
    controls.forwardBtn.disabled = !vm.canGoForward;
    controls.stopBtn.disabled = !vm.isLoading;
    controls.statusText.textContent = vm.isLoading ? "Loading..." : vm.host || "Ready";
    if (document.activeElement !== controls.urlInput) controls.urlInput.value = vm.url || "";

    startScreen.classList.toggle("hidden", !vm.isHome);
    bottomPill.classList.toggle("home-mode", vm.isHome);
    if (vm.isHome || isSettingsPageOpen || !vm.settings.autoHidePill) setBottomPillVisible(true);

    if (!isSettingsPageOpen) {
      document.title = vm.title ? `${vm.title} - JusBrowse` : "JusBrowse";
    }
    if (fromStateUpdate) {
      if (vm.isLoading) startProgress();
      else stopProgress();
    }
    renderTabs();
    syncLayout();
  };

  controls.backBtn.addEventListener("click", () => api.back());
  controls.forwardBtn.addEventListener("click", () => api.forward());
  controls.homeBtn.addEventListener("click", () => api.home());
  controls.reloadBtn.addEventListener("click", () => api.reload());
  controls.stopBtn.addEventListener("click", () => api.stop());
  controls.settingsBtn.addEventListener("click", openSettingsPage);
  controls.closeSettingsBtn.addEventListener("click", closeSettingsPage);
  controls.newTabBtn.addEventListener("click", () => api.newTab({ url: "about:blank" }));
  controls.newIncognitoTabBtn.addEventListener("click", openIncognitoTab);
  controls.incognitoBtn.addEventListener("click", openIncognitoTab);
  controls.openIncognitoFromSettingsBtn.addEventListener("click", openIncognitoTab);
  controls.goBtn.addEventListener("click", () => executeSearchOrGo(controls.urlInput.value));
  controls.urlInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") executeSearchOrGo(controls.urlInput.value);
  });

  settingsNavButtons.forEach((button) => {
    button.addEventListener("click", () => activateSettingsSection(button.dataset.section));
  });
  themePresetGroup.querySelectorAll("[data-theme-preset]").forEach((chip) => {
    chip.addEventListener("click", () => saveSettings({ themePreset: chip.dataset.themePreset }, false));
  });
  fontGroup.querySelectorAll("[data-font]").forEach((chip) => {
    chip.addEventListener("click", () => saveSettings({ appFont: chip.dataset.font }, false));
  });
  inputs.searchEngineSelect.addEventListener("change", (event) => saveSettings({ searchEngine: event.target.value }, false));
  inputs.startupBehaviorSelect.addEventListener("change", (event) => saveSettings({ startupBehavior: event.target.value }, false));
  inputs.homepageUrlInput.addEventListener("change", (event) => saveSettings({ homepageUrl: event.target.value.trim() }, false));
  inputs.autoHidePillToggle.addEventListener("change", (event) => {
    saveSettings({ autoHidePill: event.target.checked }, false);
    if (!event.target.checked) setBottomPillVisible(true);
  });
  inputs.darkModeToggle.addEventListener("change", (event) => saveSettings({ darkMode: event.target.checked }, false));
  inputs.extraDarkModeToggle.addEventListener("change", (event) => saveSettings({ extraDarkMode: event.target.checked }, false));
  inputs.showTabIconsToggle.addEventListener("change", (event) => saveSettings({ showTabIcons: event.target.checked }, false));
  inputs.enableWallpapersToggle.addEventListener("change", (event) => saveSettings({ enableWallpapers: event.target.checked }, false));
  inputs.showStatusTagToggle.addEventListener("change", (event) => saveSettings({ showStatusTag: event.target.checked }, false));
  inputs.startPageWallpaperInput.addEventListener("change", (event) =>
    saveSettings({ startPageWallpaper: event.target.value.trim(), wallpaperType: "image", wallpaperDataUrl: "" }, false)
  );
  inputs.chooseWallpaperBtn.addEventListener("click", async () => {
    if (!api.chooseWallpaperFile) {
      controls.statusText.textContent = "Wallpaper picker unavailable";
      return;
    }
    try {
      const selected = await api.chooseWallpaperFile();
      if (!selected || !selected.url) return;
      saveSettings(
        { wallpaperDataUrl: selected.url, wallpaperType: selected.isVideo ? "video" : "image", startPageWallpaper: "" },
        false
      );
    } catch {
      controls.statusText.textContent = "Failed to open wallpaper picker";
    }
  });
  inputs.liveWallpaperToggle.addEventListener("change", (event) => saveSettings({ liveWallpaper: event.target.checked }, false));
  inputs.wallpaperBlurRange.addEventListener("input", (event) => saveSettings({ wallpaperBlur: Number(event.target.value) || 0 }, false));
  inputs.backgroundColorPicker.addEventListener("input", (event) =>
    saveSettings({ customBackgroundHex: event.target.value, customBackgroundRgba: event.target.value }, false)
  );
  inputs.fontColorPicker.addEventListener("input", (event) => saveSettings({ customFontColor: event.target.value }, false));
  inputs.accentColorPicker.addEventListener("input", (event) => saveSettings({ customAccentColor: event.target.value }, false));
  inputs.mutedColorPicker.addEventListener("input", (event) => saveSettings({ customMutedColor: event.target.value }, false));
  inputs.fontSourceSelect.addEventListener("change", (event) => saveSettings({ fontSource: event.target.value, appFont: "system" }, false));
  inputs.googleFontInput.addEventListener("change", (event) => saveSettings({ googleFontFamily: event.target.value.trim() }, false));
  inputs.customFontInput.addEventListener("change", (event) => saveSettings({ customFontFamily: event.target.value.trim() }, false));

  inputs.fingerprintEngineSelect.addEventListener("change", (event) => saveSettings({ fingerprintEngine: event.target.value }));
  inputs.protectionWhitelistInput.addEventListener("change", (event) =>
    saveSettings({ protectionWhitelist: event.target.value.trim() })
  );
  inputs.doNotTrackToggle.addEventListener("change", (event) => saveSettings({ sendDoNotTrack: event.target.checked }));
  inputs.blockTrackersToggle.addEventListener("change", (event) => saveSettings({ blockTrackers: event.target.checked }));
  inputs.enableJavaScriptToggle.addEventListener("change", (event) =>
    saveSettings({ enableJavaScript: event.target.checked, follianMode: event.target.checked ? false : vm.settings.follianMode })
  );
  inputs.advancedAdBlockToggle.addEventListener("change", (event) => saveSettings({ advancedAdBlock: event.target.checked }));
  inputs.httpsOnlyModeToggle.addEventListener("change", (event) => saveSettings({ httpsOnlyMode: event.target.checked }));
  inputs.blockCookiePopupsToggle.addEventListener("change", (event) => saveSettings({ blockCookiePopups: event.target.checked }));
  inputs.popupBlockerToggle.addEventListener("change", (event) => saveSettings({ popupBlocker: event.target.checked }));
  inputs.multiMediaPlaybackToggle.addEventListener("change", (event) => saveSettings({ multiMediaPlayback: event.target.checked }));
  inputs.follianModeToggle.addEventListener("change", (event) => saveSettings({ follianMode: event.target.checked, enableJavaScript: !event.target.checked }));
  inputs.follianProtocolToggle.addEventListener("change", (event) => saveSettings({ follianProtocol: event.target.checked }));
  inputs.screenshotProtectionToggle.addEventListener("change", (event) => saveSettings({ screenshotProtection: event.target.checked }));
  inputs.shareAnalyticsToggle.addEventListener("change", (event) => saveSettings({ shareAnonymousAnalytics: event.target.checked }, false));
  inputs.virusTotalApiKeyInput.addEventListener("change", (event) => saveSettings({ virusTotalApiKey: event.target.value.trim() }, false));
  inputs.koodousApiKeyInput.addEventListener("change", (event) => saveSettings({ koodousApiKey: event.target.value.trim() }, false));
  inputs.customDohUrlInput.addEventListener("change", (event) => saveSettings({ customDohUrl: event.target.value.trim() }));

  inputs.cacheLimitRange.addEventListener("input", (event) => saveSettings({ cacheLimitMb: Number(event.target.value) || 1024 }));
  inputs.cachePolicySelect.addEventListener("change", (event) => saveSettings({ cachePolicy: event.target.value }));
  inputs.nuclearWipeToggle.addEventListener("change", (event) => saveSettings({ nuclearWipe: event.target.checked }));
  inputs.clearCacheBtn.addEventListener("click", () => api.clearCache?.());
  inputs.clearDataBtn.addEventListener("click", () => {
    vm.resetData();
    applySettingsToUi();
    renderTabs();
    updateRuntimeSettings();
  });
  inputs.clearHistoryBtn.addEventListener("click", () => {
    vm.clearHistory();
    renderHistory();
  });
  inputs.savePasswordsToggle.addEventListener("change", (event) =>
    saveSettings({ savePasswords: event.target.checked }, true)
  );
  inputs.clearPasswordsBtn.addEventListener("click", async () => {
    await api.clearSavedPasswords?.();
    renderPasswords();
  });

  bottomRevealZone.addEventListener("mouseenter", () => !vm.isHome && setBottomPillVisible(true));
  tabsDock.addEventListener("mouseenter", () => !vm.isHome && setBottomPillVisible(true));
  tabsDock.addEventListener("mouseleave", () => {
    if (!vm.isHome && !isSettingsPageOpen && vm.settings.autoHidePill) setBottomPillVisible(false);
  });
  bottomPill.addEventListener("mouseleave", () => {
    if (!vm.isHome && !isSettingsPageOpen && vm.settings.autoHidePill) setBottomPillVisible(false);
  });
  window.addEventListener("mousemove", (event) => {
    if (vm.isHome || isSettingsPageOpen || !vm.settings.autoHidePill) return;
    const distanceFromBottom = window.innerHeight - event.clientY;
    if (distanceFromBottom < 85) setBottomPillVisible(true);
    if (distanceFromBottom > 170) setBottomPillVisible(false);
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isSettingsPageOpen) return closeSettingsPage();
    if (event.ctrlKey && event.key.toLowerCase() === "l") {
      event.preventDefault();
      setBottomPillVisible(true);
      controls.urlInput.focus();
      controls.urlInput.select();
      return;
    }
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "n") {
      event.preventDefault();
      openIncognitoTab();
      return;
    }
    if (event.ctrlKey && event.key.toLowerCase() === "r") {
      event.preventDefault();
      api.reload();
      return;
    }
    if (event.ctrlKey && event.key.toLowerCase() === "t") {
      event.preventDefault();
      api.newTab({ url: "about:blank" });
      return;
    }
    if (event.altKey && event.key === "ArrowLeft") {
      event.preventDefault();
      api.back();
      return;
    }
    if (event.altKey && event.key === "ArrowRight") {
      event.preventDefault();
      api.forward();
    }
  });

  api.onState((state) => {
    vm.update(state);
    render(true);
  });

  window.addEventListener("resize", syncLayout);
  applySettingsToUi();
  applyAboutSystemInfo();
  updateRuntimeSettings();
  activateSettingsSection("section-general");
  settingsPage.classList.remove("visible");
  render();
  syncLayout();
  setTimeout(syncLayout, 120);

  if (vm.settings.startupBehavior === "homepage" && vm.settings.homepageUrl) {
    executeSearchOrGo(vm.settings.homepageUrl);
  }
})();

