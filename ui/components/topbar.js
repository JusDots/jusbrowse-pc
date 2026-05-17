(() => {
  const vm = window.browserViewModel;
  const api = window.browserApi;
  const isIncognitoWindow = Boolean(api?.isIncognito);

  if (isIncognitoWindow) {
    // Force the purple/dark profile for incognito windows without persisting it to
    // localStorage — the next normal-window launch should restore the user's preferred
    // theme. We also tag <body> so styles.css can scope additional accents.
    vm.settings = { ...vm.settings, themePreset: "purple", darkMode: true };
    document.body.classList.add("incognito-window");
  }

  const $ = (id) => document.getElementById(id);
  const startScreen = $("startScreen");
  const startWallpaperVideo = $("startWallpaperVideo");
  const bottomPill = $("bottomPill");
  const bottomRevealZone = $("bottomRevealZone");
  const tabsDock = $("tabsDock");
  const tabsList = $("tabsList");
  const tabSearchInput = $("tabSearchInput");
  const settingsPage = $("settingsPage");
  const downloadsPanel = $("downloadsPanel");
  const downloadsList = $("downloadsList");
  const settingsNavButtons = document.querySelectorAll(".settings-nav");
  const settingsSections = document.querySelectorAll(".settings-section");
  const historyList = $("historyList");
  const recentlyClosedList = $("recentlyClosedList");
  const passwordList = $("passwordList");
  const customThemeRow = $("customThemeRow");
  const aboutOs = $("aboutOs");
  const aboutKernel = $("aboutKernel");
  const aboutVersion = $("aboutVersion");
  const aboutChromium = $("aboutChromium");
  const aboutElectron = $("aboutElectron");
  const refreshAuthTraceBtn = $("refreshAuthTraceBtn");
  const copyDiagnosticsBtn = $("copyDiagnosticsBtn");
  const copyDiagnosticsStatus = $("copyDiagnosticsStatus");
  const authFlowTrace = $("authFlowTrace");
  const pathAAuthTrace = $("pathAAuthTrace");
  const externalAuthNoticeStack = $("externalAuthNoticeStack");
  const passwordPromptStack = $("passwordPromptStack");
  const adblockBadge = $("adblockBadge");
  const wallpaperSettingsRows = document.querySelectorAll(".wallpaper-option-row");
  const stickerLayer = $("stickerLayer");
  const stickerGallery = $("stickerGallery");
  const pillPositionGroup = $("pillPositionGroup");
  const tabsPositionGroup = $("tabsPositionGroup");

  const controls = {
    backBtn: $("backBtn"),
    forwardBtn: $("forwardBtn"),
    homeBtn: $("homeBtn"),
    reloadBtn: $("reloadBtn"),
    stopBtn: $("stopBtn"),
    downloadsBtn: $("downloadsBtn"),
    goBtn: $("goBtn"),
    urlInput: $("urlInput"),
    settingsBtn: $("settingsBtn"),
    closeSettingsBtn: $("closeSettingsBtn"),
    newTabBtn: $("newTabBtn"),
    newIncognitoTabBtn: $("newIncognitoTabBtn"),
    incognitoBtn: $("incognitoBtn"),
    adblockShieldBtn: $("adblockShieldBtn"),
    addStickerBtn: $("addStickerBtn"),
    clearStickersBtn: $("clearStickersBtn"),
    closeDownloadsBtn: $("closeDownloadsBtn"),
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
    clearPasswordsBtn: $("clearPasswordsBtn"),
    showAdblockShieldToggle: $("showAdblockShieldToggle"),
    tabsPositionGroup
  };

  const themePresetGroup = $("themePresetGroup");
  const fontGroup = $("fontGroup");

  const SEARCH_ENGINES = {
    google: "https://www.google.com/search?q=",
    duckduckgo: "https://duckduckgo.com/?q=",
    bing: "https://www.bing.com/search?q=",
    brave: "https://search.brave.com/search?q="
  };
  const BUILTIN_THEME_WALLPAPERS = {
    dark: 'url("../assets/wallpapers/theme-dark.png")',
    light: 'url("../assets/wallpapers/theme-light.png")',
    purple: 'url("../assets/wallpapers/theme-purple.png")'
  };

  let isSettingsPageOpen = false;
  let isDownloadsOpen = false;
  let activeSettingsSectionId = "section-general";
  let isUserEditingUrl = false;
  let tabSearchQuery = "";
  let closedTabsSnapshot = [];
  let progressTimer = null;
  let progressValue = 0;
  const activeNoticeTimers = new Map();
  // Shared layout-decision helpers live in ui/viewmodel/layoutDecisions.js so the same
  // inset math is unit-tested in node and consumed here in the renderer.
  const layoutDecisions = window.JusBrowseLayoutDecisions || {};
  const TABS_DOCK_HEIGHT = layoutDecisions.TABS_DOCK_HEIGHT || 42;
  const TOP_PILL_RESERVE = layoutDecisions.PILL_TOP_RESERVE || 46;

  const formatBytes = (value) => {
    const bytes = Math.max(0, Number(value) || 0);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const updateRuntimeSettings = () => api.updateRuntimeSettings?.(vm.settings);

  const dismissNotice = (noticeId) => {
    if (!externalAuthNoticeStack) return;
    const node = externalAuthNoticeStack.querySelector(`[data-notice-id="${noticeId}"]`);
    if (!node) return;
    node.classList.add("dismissed");
    setTimeout(() => node.remove(), 220);
    const timer = activeNoticeTimers.get(noticeId);
    if (timer) {
      clearTimeout(timer);
      activeNoticeTimers.delete(noticeId);
    }
  };

  const dismissPasswordBanner = (id) => {
    if (!passwordPromptStack) return;
    const node = passwordPromptStack.querySelector(`[data-prompt-id="${id}"]`);
    if (!node) return;
    node.classList.add("dismissed");
    setTimeout(() => node.remove(), 220);
    vm.removePasswordPrompt(id);
  };

  const renderPasswordBanner = (prompt) => {
    if (!passwordPromptStack || !prompt?.id || !prompt?.host) return;
    if (passwordPromptStack.querySelector(`[data-prompt-id="${prompt.id}"]`)) return;
    const banner = document.createElement("div");
    banner.className = "password-prompt-banner";
    banner.dataset.promptId = prompt.id;
    const title = document.createElement("div");
    title.className = "password-prompt-title";
    title.textContent = "Save password?";
    const detail = document.createElement("div");
    detail.className = "password-prompt-detail";
    detail.textContent = `${prompt.host}${prompt.username ? `  ${prompt.username}` : ""}`;
    const actions = document.createElement("div");
    actions.className = "password-prompt-actions";
    const saveBtn = document.createElement("button");
    saveBtn.className = "primary";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", async () => {
      await api.respondToPasswordPrompt?.(prompt.id, "save");
      dismissPasswordBanner(prompt.id);
      renderPasswords();
    });
    const neverBtn = document.createElement("button");
    neverBtn.className = "danger";
    neverBtn.textContent = "Never";
    neverBtn.addEventListener("click", async () => {
      await api.respondToPasswordPrompt?.(prompt.id, "never");
      dismissPasswordBanner(prompt.id);
    });
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Not now";
    closeBtn.addEventListener("click", () => dismissPasswordBanner(prompt.id));
    actions.appendChild(saveBtn);
    actions.appendChild(neverBtn);
    actions.appendChild(closeBtn);
    banner.appendChild(title);
    banner.appendChild(detail);
    banner.appendChild(actions);
    passwordPromptStack.appendChild(banner);
    setTimeout(() => dismissPasswordBanner(prompt.id), 30_000);
  };

  const renderAdblockBadge = () => {
    if (!adblockBadge) return;
    const stats = vm.adblockStats || {};
    const count = Number(stats.blockedCount || 0);
    adblockBadge.textContent = count >= 1 ? `${count.toLocaleString()} blocked` : "0 blocked";
    adblockBadge.title = `Adblock source: ${stats.source || "fallback"}, ${stats.hostCount || 0} hosts`;
  };

  const renderAdblockShield = () => {
    const btn = controls.adblockShieldBtn;
    if (!btn) return;
    const enabled = Boolean(vm.settings.blockTrackers);
    btn.classList.toggle("adblock-on", enabled);
    btn.classList.toggle("adblock-off", !enabled);
    btn.title = enabled
      ? "Ad blocker ON — click to disable"
      : "Ad blocker OFF — click to enable";
    btn.setAttribute("aria-pressed", String(enabled));
  };

  const stickerDragState = { id: null, pointerId: null, offsetX: 0, offsetY: 0, layer: null };

  const renderStickers = () => {
    if (!stickerLayer) return;
    stickerLayer.innerHTML = "";
    const stickers = vm.getStickers();
    if (!stickers.length) return;
    stickers.forEach((sticker) => {
      const node = document.createElement("div");
      node.className = "sticker-item";
      node.dataset.stickerId = sticker.id;
      const size = Math.max(40, Math.min(420, Number(sticker.size) || 140));
      node.style.width = `${size}px`;
      node.style.height = `${size}px`;
      const xPct = Math.max(0, Math.min(1, Number(sticker.x) || 0)) * 100;
      const yPct = Math.max(0, Math.min(1, Number(sticker.y) || 0)) * 100;
      node.style.left = `calc(${xPct}% - ${size / 2}px)`;
      node.style.top = `calc(${yPct}% - ${size / 2}px)`;
      const img = document.createElement("img");
      img.src = sticker.src;
      img.alt = "Sticker";
      img.draggable = false;
      node.appendChild(img);
      node.addEventListener("dblclick", () => {
        vm.removeSticker(sticker.id);
        renderStickers();
        renderStickerGallery();
      });
      node.addEventListener(
        "wheel",
        (event) => {
          // Wheel-resize: scroll = ±4 px, +Shift = ±16 px for fast resize. Persist on settle.
          event.preventDefault();
          const step = event.shiftKey ? 16 : 4;
          const delta = event.deltaY > 0 ? -step : step;
          const current = Number(sticker.size) || 140;
          const next = Math.max(40, Math.min(420, current + delta));
          if (next === current) return;
          sticker.size = next;
          node.style.width = `${next}px`;
          node.style.height = `${next}px`;
          const xPct = Math.max(0, Math.min(1, Number(sticker.x) || 0)) * 100;
          const yPct = Math.max(0, Math.min(1, Number(sticker.y) || 0)) * 100;
          node.style.left = `calc(${xPct}% - ${next / 2}px)`;
          node.style.top = `calc(${yPct}% - ${next / 2}px)`;
          // Debounce persistence so a single scroll gesture writes once.
          clearTimeout(node._sizePersistTimer);
          node._sizePersistTimer = setTimeout(() => {
            vm.updateStickerSize(sticker.id, next);
            renderStickerGallery();
          }, 180);
        },
        { passive: false }
      );
      node.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        const rect = stickerLayer.getBoundingClientRect();
        stickerDragState.id = sticker.id;
        stickerDragState.pointerId = event.pointerId;
        stickerDragState.offsetX = event.clientX - rect.left - (rect.width * (Number(sticker.x) || 0));
        stickerDragState.offsetY = event.clientY - rect.top - (rect.height * (Number(sticker.y) || 0));
        stickerDragState.layer = rect;
        node.classList.add("dragging");
        node.setPointerCapture(event.pointerId);
        event.preventDefault();
      });
      node.addEventListener("pointermove", (event) => {
        if (stickerDragState.id !== sticker.id) return;
        const rect = stickerLayer.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const nx = (event.clientX - rect.left - stickerDragState.offsetX) / rect.width;
        const ny = (event.clientY - rect.top - stickerDragState.offsetY) / rect.height;
        const clampedX = Math.max(0.02, Math.min(0.98, nx));
        const clampedY = Math.max(0.02, Math.min(0.98, ny));
        node.style.left = `calc(${clampedX * 100}% - ${size / 2}px)`;
        node.style.top = `calc(${clampedY * 100}% - ${size / 2}px)`;
        stickerDragState.lastX = clampedX;
        stickerDragState.lastY = clampedY;
      });
      const releaseDrag = (event) => {
        if (stickerDragState.id !== sticker.id) return;
        node.classList.remove("dragging");
        try {
          node.releasePointerCapture(event.pointerId);
        } catch {}
        if (Number.isFinite(stickerDragState.lastX) && Number.isFinite(stickerDragState.lastY)) {
          vm.updateStickerPosition(sticker.id, stickerDragState.lastX, stickerDragState.lastY);
        }
        stickerDragState.id = null;
        stickerDragState.lastX = undefined;
        stickerDragState.lastY = undefined;
      };
      node.addEventListener("pointerup", releaseDrag);
      node.addEventListener("pointercancel", releaseDrag);
      stickerLayer.appendChild(node);
    });
  };

  const renderStickerGallery = () => {
    if (!stickerGallery) return;
    stickerGallery.innerHTML = "";
    const stickers = vm.getStickers();
    if (!stickers.length) {
      const empty = document.createElement("div");
      empty.className = "settings-hint";
      empty.textContent = "No stickers added yet. Click \"Add sticker\" above to drop one on the start page.";
      stickerGallery.appendChild(empty);
      return;
    }
    stickers.forEach((sticker, index) => {
      const card = document.createElement("div");
      card.className = "sticker-card";

      const preview = document.createElement("div");
      preview.className = "sticker-card-preview";
      const img = document.createElement("img");
      img.src = sticker.src;
      img.alt = "Sticker";
      preview.appendChild(img);
      card.appendChild(preview);

      const meta = document.createElement("div");
      meta.className = "sticker-card-meta";
      meta.innerHTML = `<span>Sticker ${index + 1}</span><span class="sticker-card-size-value">${Math.round(sticker.size || 140)} px</span>`;
      card.appendChild(meta);

      const sizeWrap = document.createElement("div");
      sizeWrap.className = "sticker-card-size";
      const sizeLabel = document.createElement("label");
      sizeLabel.textContent = "Size";
      sizeLabel.style.fontSize = "11px";
      sizeLabel.style.color = "var(--muted)";
      const sizeRange = document.createElement("input");
      sizeRange.type = "range";
      sizeRange.min = "40";
      sizeRange.max = "420";
      sizeRange.step = "2";
      sizeRange.value = String(Math.round(sticker.size || 140));
      sizeRange.addEventListener("input", (event) => {
        const next = Number(event.target.value) || 140;
        vm.updateStickerSize(sticker.id, next);
        const valueLabel = meta.querySelector(".sticker-card-size-value");
        if (valueLabel) valueLabel.textContent = `${next} px`;
        // Live-update only the sticker that changed so dragging the slider feels smooth
        // instead of rebuilding the whole sticker layer on every input event.
        const node = stickerLayer?.querySelector(`[data-sticker-id="${sticker.id}"]`);
        if (node) {
          node.style.width = `${next}px`;
          node.style.height = `${next}px`;
          const xPct = Math.max(0, Math.min(1, Number(sticker.x) || 0)) * 100;
          const yPct = Math.max(0, Math.min(1, Number(sticker.y) || 0)) * 100;
          node.style.left = `calc(${xPct}% - ${next / 2}px)`;
          node.style.top = `calc(${yPct}% - ${next / 2}px)`;
        }
      });
      sizeRange.addEventListener("change", () => renderStickers());
      sizeWrap.appendChild(sizeLabel);
      sizeWrap.appendChild(sizeRange);
      card.appendChild(sizeWrap);

      const actions = document.createElement("div");
      actions.className = "sticker-card-actions";

      const presetSmall = document.createElement("button");
      presetSmall.type = "button";
      presetSmall.textContent = "S";
      presetSmall.title = "Small (80 px)";
      presetSmall.addEventListener("click", () => {
        vm.updateStickerSize(sticker.id, 80);
        renderStickers();
        renderStickerGallery();
      });

      const presetMedium = document.createElement("button");
      presetMedium.type = "button";
      presetMedium.textContent = "M";
      presetMedium.title = "Medium (140 px)";
      presetMedium.addEventListener("click", () => {
        vm.updateStickerSize(sticker.id, 140);
        renderStickers();
        renderStickerGallery();
      });

      const presetLarge = document.createElement("button");
      presetLarge.type = "button";
      presetLarge.textContent = "L";
      presetLarge.title = "Large (240 px)";
      presetLarge.addEventListener("click", () => {
        vm.updateStickerSize(sticker.id, 240);
        renderStickers();
        renderStickerGallery();
      });

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "sticker-card-remove";
      remove.textContent = "Remove";
      remove.addEventListener("click", () => {
        vm.removeSticker(sticker.id);
        renderStickers();
        renderStickerGallery();
      });

      actions.appendChild(presetSmall);
      actions.appendChild(presetMedium);
      actions.appendChild(presetLarge);
      actions.appendChild(remove);
      card.appendChild(actions);

      stickerGallery.appendChild(card);
    });
  };

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("read-error"));
    reader.readAsDataURL(file);
  });

  const triggerStickerPicker = async () => {
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = "image/png,image/gif,image/webp,image/jpeg,image/svg+xml";
    picker.style.display = "none";
    document.body.appendChild(picker);
    try {
      await new Promise((resolve) => {
        picker.addEventListener("change", resolve, { once: true });
        picker.addEventListener("cancel", resolve, { once: true });
        picker.click();
      });
      const file = picker.files && picker.files[0];
      if (!file) return;
      // Cap at ~3MB to keep localStorage healthy. Stickers are stored as data URLs.
      if (file.size > 3 * 1024 * 1024) {
        controls.statusText.textContent = "Sticker too large (max 3MB)";
        return;
      }
      const dataUrl = await readFileAsDataUrl(file);
      if (!dataUrl) return;
      vm.addSticker({ src: dataUrl, x: 0.5, y: 0.5, size: 140 });
      renderStickers();
      renderStickerGallery();
    } catch {
      controls.statusText.textContent = "Failed to add sticker";
    } finally {
      picker.remove();
    }
  };

  const renderExternalAuthNotice = (notice) => {
    if (!externalAuthNoticeStack || !notice?.message) return;
    const item = document.createElement("div");
    item.className = `external-auth-notice ${notice.noticeType === "launch-failed" ? "error" : "info"}`;
    item.dataset.noticeId = notice.id;
    const message = document.createElement("span");
    message.className = "external-auth-notice-message";
    message.textContent = notice.message;
    item.appendChild(message);
    if (notice.correlationId) {
      const meta = document.createElement("span");
      meta.className = "external-auth-notice-meta";
      meta.textContent = notice.correlationId;
      item.appendChild(meta);
    }
    externalAuthNoticeStack.appendChild(item);
    const timer = setTimeout(() => dismissNotice(notice.id), notice.noticeType === "launch-failed" ? 6500 : 4200);
    activeNoticeTimers.set(notice.id, timer);
  };

  const isPillVisible = () => bottomPill.classList.contains("visible") || bottomPill.classList.contains("home-mode");
  const isTopPillMode = () => vm.settings.pillPosition === "top";
  const DOWNLOAD_PANEL_MARGIN = 12;

  // The bottom pill renders in a dedicated native BrowserView layered above the page
  // (see electron/main.js: createPillView). The local #bottomPill element is hidden
  // via CSS while bottom-pill mode is active; it remains the rendering host only in
  // top-pill mode. publishPillState forwards the renderer's "should the pill be
  // visible" decision plus modal context to main so the pill view bounds track it.
  let lastPillStateJson = "";
  const publishPillState = () => {
    if (!api?.setPillState) return;
    const payload = {
      chromeWantsVisible: isPillVisible(),
      pillPosition: vm.settings.pillPosition || "bottom",
      tabsPosition: vm.settings.tabsPosition || "bottom",
      isSettingsOpen: Boolean(isSettingsPageOpen),
      isHome: Boolean(vm.isHome),
      isDownloadsOpen: Boolean(isDownloadsOpen),
      autoHidePill: vm.settings.autoHidePill !== false
    };
    const serialized = JSON.stringify(payload);
    if (serialized === lastPillStateJson) return;
    lastPillStateJson = serialized;
    api.setPillState(payload);
  };

  const publishPillTheme = () => {
    if (!api?.setPillTheme) return;
    const computed = getComputedStyle(document.documentElement);
    const pick = (token) => String(computed.getPropertyValue(token) || "").trim();
    const themeClass = document.body.classList.contains("theme-purple")
      ? "purple"
      : document.body.classList.contains("theme-dark")
      ? "dark"
      : "";
    api.setPillTheme({
      themeClass,
      lightMode: document.body.classList.contains("light-mode"),
      extraDark: document.body.classList.contains("extra-dark"),
      cssVars: {
        "--text": pick("--text"),
        "--accent": pick("--accent"),
        "--accent-2": pick("--accent-2"),
        "--muted": pick("--muted"),
        "--border": pick("--border"),
        "--glass-2": pick("--glass-2")
      }
    });
  };

  const syncDownloadsPanelPlacement = () => {
    if (!downloadsPanel) return;
    const tabsOnTop = vm.settings.tabsPosition === "top";
    const tabsOnBottom = vm.settings.tabsPosition === "bottom";
    const topOffset = DOWNLOAD_PANEL_MARGIN + (tabsOnTop ? TABS_DOCK_HEIGHT : 0) + (isTopPillMode() ? TOP_PILL_RESERVE : 0);
    const bottomOffset = DOWNLOAD_PANEL_MARGIN + (tabsOnBottom ? TABS_DOCK_HEIGHT : 0);
    downloadsPanel.style.top = `${topOffset}px`;
    downloadsPanel.style.bottom = `${bottomOffset}px`;
    downloadsPanel.style.maxHeight = `calc(100vh - ${topOffset + bottomOffset}px)`;
  };

  // syncLayout drives the BrowserView's reserved insets via api.setLayout. In Electron a
  // BrowserView is a native child view that paints over any renderer DOM within its
  // bounds, so the pill and downloads panel can only stay visible above the page by
  // carving out a real inset for the duration of their visible state. The pure inset
  // math is computed in ui/viewmodel/layoutDecisions.js (unit-tested) and consumed here.
  const syncLayout = () => {
    syncDownloadsPanelPlacement();
    const compute = layoutDecisions.computeBrowserViewLayout;
    if (typeof compute !== "function") {
      // Defensive fallback: collapse the WebView so we never paint over chrome that
      // would otherwise be hidden under it. Should never run if layoutDecisions.js
      // loaded correctly.
      api.setLayout(0, 0, 0, 0, true);
      return;
    }
    const layout = compute({
      isHome: Boolean(vm.isHome),
      isSettingsOpen: Boolean(isSettingsPageOpen),
      tabsPosition: vm.settings.tabsPosition || "bottom",
      pillPosition: vm.settings.pillPosition || "bottom",
      isPillVisible: isPillVisible(),
      isDownloadsOpen: Boolean(isDownloadsOpen),
      viewportWidth: Math.max(0, Number(window.innerWidth) || 0)
    });
    api.setLayout(layout.top, layout.bottom, layout.left, layout.right, layout.hideWebView);
    publishPillState();
  };

  // The pill must stay visible for at least PILL_MIN_VISIBLE_MS after being summoned
  // so the user can react and click it. A naive hide (e.g., a stray mousemove) gets
  // deferred via pendingPillHideTimer until the grace window elapses.
  const PILL_MIN_VISIBLE_MS = 5000;
  let lastPillShownAt = 0;
  let pendingPillHideTimer = null;
  const setBottomPillVisible = (visible) => {
    if (visible) {
      if (pendingPillHideTimer) {
        clearTimeout(pendingPillHideTimer);
        pendingPillHideTimer = null;
      }
      const wasHidden = !bottomPill.classList.contains("visible");
      bottomPill.classList.add("visible");
      // Reset the grace timer on every fresh show OR when re-affirming visibility
      // during the grace window — the user expects the 5-second clock to restart
      // whenever the pill is summoned, not just the first time.
      if (wasHidden) lastPillShownAt = Date.now();
      else if (lastPillShownAt === 0) lastPillShownAt = Date.now();
      syncLayout();
      return;
    }
    // Hide path: enforce the 5-second floor by deferring if the pill was shown too
    // recently. If a defer is already armed, leave it — it'll re-check on fire.
    const elapsed = Date.now() - lastPillShownAt;
    if (lastPillShownAt > 0 && elapsed < PILL_MIN_VISIBLE_MS) {
      if (pendingPillHideTimer) return;
      pendingPillHideTimer = setTimeout(() => {
        pendingPillHideTimer = null;
        // Re-evaluate at fire time: the chrome may have raised the pill again, in
        // which case the visible class is still there and we leave it alone.
        if (!shouldAutoTrackPill()) return;
        bottomPill.classList.remove("visible");
        lastPillShownAt = 0;
        syncLayout();
      }, PILL_MIN_VISIBLE_MS - elapsed);
      return;
    }
    bottomPill.classList.remove("visible");
    lastPillShownAt = 0;
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
    return BUILTIN_THEME_WALLPAPERS[key] || "";
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
    const effectiveThemePreset =
      vm.settings.darkMode || vm.settings.themePreset === "custom" ? vm.settings.themePreset : "light";
    document.body.classList.toggle("extra-dark", vm.settings.extraDarkMode);
    document.body.classList.remove("theme-dark", "theme-purple");
    if (effectiveThemePreset === "dark") document.body.classList.add("theme-dark");
    if (effectiveThemePreset === "purple") document.body.classList.add("theme-purple");
    if (effectiveThemePreset === "light") document.body.classList.add("light-mode");
    else document.body.classList.remove("light-mode");
    const useCustomTheme = effectiveThemePreset === "custom";
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

    // Resolve the wallpaper URL through the view-model cache so we don't redecode the
    // theme PNGs on every settings render. The cache is invalidated whenever any of the
    // wallpaper-relevant settings change (see vm.updateSettings).
    const wallpaperImage = vm.resolveWallpaperImage(effectiveThemePreset);
    const wallpaperSrc = vm.settings.enableWallpapers
      ? vm.settings.wallpaperDataUrl || vm.settings.startPageWallpaper || ""
      : "";
    const hasImageWallpaper = Boolean(wallpaperImage) && (vm.settings.wallpaperType !== "video" || !vm.settings.liveWallpaper);
    document.body.classList.toggle("has-wallpaper", hasImageWallpaper);
    if (hasImageWallpaper) {
      document.body.style.setProperty("--wallpaper-image", wallpaperImage);
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
    // Push theme tokens to the pill BrowserView's renderer so its bubble matches.
    publishPillTheme();
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
    if (inputs.showAdblockShieldToggle) inputs.showAdblockShieldToggle.checked = s.showAdblockShield !== false;
    controls.statusText.style.display = s.showStatusTag ? "block" : "none";

    const isTop = s.pillPosition === "top";
    const tabsPosition = s.tabsPosition || "bottom";
    document.body.classList.toggle("pill-top", isTop);
    document.body.classList.toggle("pill-bottom-mode", !isTop);
    document.body.classList.toggle("tabs-top", tabsPosition === "top");
    document.body.classList.toggle("tabs-bottom", tabsPosition === "bottom");
    document.body.classList.toggle("tabs-left", tabsPosition === "left");
    document.body.classList.toggle("adblock-shield-hidden", !s.showAdblockShield);

    applyThemeAndAppearance();
    highlightActiveOption(themePresetGroup, "themePreset", s.themePreset);
    highlightActiveOption(fontGroup, "font", s.appFont);
    highlightActiveOption(pillPositionGroup, "pillPosition", s.pillPosition || "bottom");
    highlightActiveOption(tabsPositionGroup, "tabsPosition", tabsPosition);
    customThemeRow.style.display = s.themePreset === "custom" ? "grid" : "none";
    syncWallpaperSettingsVisibility();
    renderHistory();
    renderPasswords();
    renderAdblockShield();
    renderStickers();
    renderStickerGallery();
  };

  const saveSettings = (patch, syncRuntime = true) => {
    let effectivePatch = patch || {};
    if (isIncognitoWindow) {
      // Incognito windows should never persist theme/darkMode flips back to the shared
      // localStorage — keep that scoped to this window only by mutating vm.settings in
      // memory but skipping the saveSettings() write for theme keys.
      const filtered = { ...effectivePatch };
      delete filtered.themePreset;
      delete filtered.darkMode;
      vm.settings = { ...vm.settings, ...effectivePatch };
      vm.invalidateWallpaperCache();
      if (Object.keys(filtered).length) {
        const before = vm.settings;
        vm.updateSettings(filtered);
        // updateSettings overwrote with shallow merge; restore the in-memory theme keys
        // that we don't want persisted but do want active for this window.
        vm.settings = {
          ...vm.settings,
          themePreset: "purple",
          darkMode: true
        };
        void before;
      }
    } else {
      vm.updateSettings(effectivePatch);
    }
    applySettingsToUi();
    renderTabs();
    if (syncRuntime) updateRuntimeSettings();
  };

  const applyAboutSystemInfo = async () => {
    const info = (await api.getSystemInfo?.()) || {};
    if (aboutVersion) aboutVersion.textContent = info.version || "V2.1.0 \"Atlantis\"";
    if (aboutChromium) aboutChromium.textContent = info.chromium || "-";
    if (aboutElectron) aboutElectron.textContent = info.electron || "-";
    if (aboutOs) aboutOs.textContent = info.os || navigator.platform || "-";
    if (aboutKernel) aboutKernel.textContent = info.kernel || "-";
  };

  const formatTraceLine = (event) => {
    const stamp = new Date(event?.at || Date.now()).toLocaleTimeString();
    const type = event?.type || event?.eventName || "event";
    const payload = event?.payload && typeof event.payload === "object" ? event.payload : {};
    return `[${stamp}] ${type} ${JSON.stringify(payload)}`;
  };

  const formatReasonBreakdown = (groupedDiagnostics) => {
    const byTerminalReason =
      groupedDiagnostics?.byTerminalReason && typeof groupedDiagnostics.byTerminalReason === "object"
        ? groupedDiagnostics.byTerminalReason
        : {};
    const entries = Object.entries(byTerminalReason);
    if (!entries.length) return "none";
    return entries
      .map(([reason, records]) => `${reason}:${Array.isArray(records) ? records.length : 0}`)
      .sort((a, b) => a.localeCompare(b))
      .join(", ");
  };

  const refreshAuthDiagnostics = async () => {
    if (authFlowTrace) authFlowTrace.textContent = "Loading legacy diagnostics...";
    if (pathAAuthTrace) pathAAuthTrace.textContent = "Loading Path A diagnostics...";

    try {
      const legacyResult = (await api.getAuthFlowTrace?.(120)) || {};
      const legacySummary = legacyResult.summary || {};
      const legacyTrace = Array.isArray(legacyResult.trace) ? legacyResult.trace : [];
      const legacyHeader = `Active flows: ${legacySummary.activeCount || 0}`;
      if (authFlowTrace) {
        authFlowTrace.textContent = legacyTrace.length
          ? `${legacyHeader}\n${legacyTrace.map(formatTraceLine).join("\n")}`
          : `${legacyHeader}\nNo legacy auth events captured yet.`;
      }
    } catch {
      if (authFlowTrace) authFlowTrace.textContent = "Failed to load legacy auth diagnostics.";
    }

    try {
      const pathAResult = (await api.getPathAAuthDiagnostics?.(120)) || {};
      const activeFlows = Array.isArray(pathAResult.activeFlows) ? pathAResult.activeFlows : [];
      const telemetry = Array.isArray(pathAResult.telemetry) ? pathAResult.telemetry : [];
      const terminalSummaries = Array.isArray(pathAResult.terminalSummaries) ? pathAResult.terminalSummaries : [];
      const telemetryValidation =
        pathAResult.telemetryValidation && typeof pathAResult.telemetryValidation === "object"
          ? pathAResult.telemetryValidation
          : { invalidEvents: 0 };
      const reasonBreakdown = formatReasonBreakdown(pathAResult.groupedDiagnostics);
      const pathAHeader = `Active flows: ${activeFlows.length} | Terminal summaries: ${terminalSummaries.length} | Invalid telemetry: ${telemetryValidation.invalidEvents || 0}`;
      if (pathAAuthTrace) {
        const summaryLine = `Terminal reason buckets: ${reasonBreakdown}`;
        pathAAuthTrace.textContent = telemetry.length
          ? `${pathAHeader}\n${summaryLine}\n${telemetry.map(formatTraceLine).join("\n")}`
          : `${pathAHeader}\n${summaryLine}\nNo Path A auth events captured yet.`;
      }
    } catch {
      if (pathAAuthTrace) pathAAuthTrace.textContent = "Failed to load Path A auth diagnostics.";
    }
  };

  const setCopyDiagnosticsStatus = (text, isError = false) => {
    if (!copyDiagnosticsStatus) return;
    copyDiagnosticsStatus.textContent = text;
    copyDiagnosticsStatus.style.color = isError ? "#ffb4b4" : "";
  };

  const copyDiagnosticsJson = async () => {
    setCopyDiagnosticsStatus("Preparing diagnostics export...");
    try {
      const diagnostics = (await api.exportAuthDiagnostics?.(200)) || null;
      if (!diagnostics) {
        setCopyDiagnosticsStatus("Diagnostics export unavailable.", true);
        return;
      }
      const serialized = JSON.stringify(diagnostics, null, 2);
      const copied = await api.copyToClipboard?.(serialized);
      if (!copied) {
        setCopyDiagnosticsStatus("Failed to copy diagnostics JSON.", true);
        return;
      }
      setCopyDiagnosticsStatus(`Copied diagnostics JSON (${serialized.length} bytes).`);
    } catch {
      setCopyDiagnosticsStatus("Failed to copy diagnostics JSON.", true);
    }
  };

  const activateSettingsSection = (sectionId) => {
    activeSettingsSectionId = sectionId;
    settingsNavButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.section === sectionId));
    settingsSections.forEach((section) => section.classList.toggle("active", section.id === sectionId));
    if (sectionId === "section-about") {
      refreshAuthDiagnostics();
    } else if (sectionId === "section-browsing") {
      renderRecentlyClosedTabs(true);
    }
  };

  const openSettingsPage = () => {
    isSettingsPageOpen = true;
    if (isDownloadsOpen) toggleDownloadsPanel(false);
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
    // Only retract if the pill is hover-reachable; otherwise we'd hide it permanently.
    const tabsPosition = vm.settings.tabsPosition || "bottom";
    if (!vm.isHome && vm.settings.autoHidePill && tabsPosition === "bottom") {
      setBottomPillVisible(false);
    }
    syncLayout();
  };

  const buildTargetUrl = (raw) => {
    const input = String(raw || "").trim();
    if (!input) return "";
    if (input.startsWith("http://") || input.startsWith("https://")) return input;
    if (input.includes(".") && !input.includes(" ")) return `https://${input}`;
    return `${SEARCH_ENGINES[vm.settings.searchEngine] || SEARCH_ENGINES.google}${encodeURIComponent(input)}`;
  };

  const sanitizeUrlForDisplay = (value, isHome) => {
    const safe = String(value || "").trim();
    if (!safe) return "";
    if (isHome) return "";
    if (safe === "about:blank") return "";
    return safe;
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

  const formatTabLabel = (tab) => `${tab.incognito ? "Incognito • " : ""}${tab.title || tab.url || "New Tab"}`;

  const tabMatchesSearch = (tab, query) => {
    const needle = String(query || "").trim().toLowerCase();
    if (!needle) return true;
    const haystack = `${tab.title || ""} ${tab.url || ""}`.toLowerCase();
    return haystack.includes(needle);
  };

  const renderTabs = () => {
    tabsList.innerHTML = "";
    const tabs = [...(vm.tabs || [])];
    if (!tabs.length && vm.activeTabId) {
      tabs.push({ id: vm.activeTabId, title: vm.title || "New Tab", url: vm.url || "", isActive: true });
    }
    const filteredTabs = tabs.filter((tab) => tabMatchesSearch(tab, tabSearchQuery));
    if (!filteredTabs.length && tabs.length) {
      const empty = document.createElement("div");
      empty.className = "tab-chip";
      const text = document.createElement("span");
      text.className = "tab-title";
      text.textContent = "No tabs match search";
      empty.appendChild(text);
      tabsList.appendChild(empty);
      return;
    }
    filteredTabs.forEach((tab) => {
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
      title.textContent = formatTabLabel(tab);
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

  const readClosedTabs = async (forceRefresh = false) => {
    if (!forceRefresh && closedTabsSnapshot.length) return closedTabsSnapshot;
    try {
      const items = (await api.getClosedTabs?.()) || [];
      closedTabsSnapshot = Array.isArray(items) ? items : [];
    } catch {
      closedTabsSnapshot = [];
    }
    return closedTabsSnapshot;
  };

  const reopenClosedTabByIndex = async (index) => {
    const reopened = await api.reopenClosedTabAt?.(index);
    if (!reopened) return false;
    await readClosedTabs(true);
    renderRecentlyClosedTabs();
    setBottomPillVisible(true);
    return true;
  };

  const renderRecentlyClosedTabs = async (forceRefresh = false) => {
    if (!recentlyClosedList || !isSettingsPageOpen || activeSettingsSectionId !== "section-browsing") return;
    const items = await readClosedTabs(forceRefresh);
    recentlyClosedList.innerHTML = "";
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "history-item";
      empty.innerHTML = `<div class="history-url">No recently closed tabs.</div>`;
      recentlyClosedList.appendChild(empty);
      return;
    }
    items.forEach((entry) => {
      const row = document.createElement("button");
      row.className = "history-item clickable";
      row.type = "button";
      row.title = "Reopen tab";
      const closedAt = Number(entry.closedAt) ? new Date(entry.closedAt).toLocaleTimeString() : "just now";
      row.innerHTML = `<div class="history-query">${entry.incognito ? "Incognito • " : ""}${toHost(entry.url) || "New Tab"}</div><div class="history-url">${entry.url || "about:blank"}</div><div class="history-meta">Closed ${closedAt}</div>`;
      row.addEventListener("click", async () => reopenClosedTabByIndex(entry.index));
      recentlyClosedList.appendChild(row);
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

  const renderDownloads = () => {
    if (!downloadsList) return;
    downloadsList.innerHTML = "";
    const items = Array.isArray(vm.downloads) ? vm.downloads : [];
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "history-item";
      empty.innerHTML = `<div class="history-url">No downloads yet.</div>`;
      downloadsList.appendChild(empty);
      return;
    }
    items.forEach((entry) => {
      const card = document.createElement("div");
      card.className = "download-item";
      const state = String(entry.state || "progressing");
      const meta = state === "progressing" ? "Downloading..." : state.charAt(0).toUpperCase() + state.slice(1);
      const bytesPart =
        Number(entry.totalBytes) > 0
          ? `${formatBytes(entry.receivedBytes)} / ${formatBytes(entry.totalBytes)}`
          : formatBytes(entry.receivedBytes);
      const row = document.createElement("div");
      row.className = "download-item-main";
      row.innerHTML = `
        <div class="download-name">${entry.fileName || "Download"}</div>
        <div class="download-meta">${meta} • ${bytesPart}</div>
      `;
      const progress = document.createElement("div");
      progress.className = "download-progress";
      const fill = document.createElement("div");
      fill.className = "download-progress-fill";
      fill.style.width = `${Math.max(0, Math.min(100, Number(entry.percent) || 0))}%`;
      progress.appendChild(fill);
      const actions = document.createElement("div");
      actions.className = "download-actions";
      const openBtn = document.createElement("button");
      openBtn.className = "settings-close";
      openBtn.textContent = "Open";
      openBtn.disabled = !entry.canOpen;
      openBtn.addEventListener("click", () => api.openDownload?.(entry.id));
      const openFolderBtn = document.createElement("button");
      openFolderBtn.className = "settings-close";
      openFolderBtn.textContent = "Show in folder";
      openFolderBtn.disabled = !entry.targetPath;
      openFolderBtn.addEventListener("click", () => api.openDownloadFolder?.(entry.id));
      actions.appendChild(openBtn);
      actions.appendChild(openFolderBtn);
      card.appendChild(row);
      card.appendChild(progress);
      card.appendChild(actions);
      downloadsList.appendChild(card);
    });
  };

  const toggleDownloadsPanel = async (forceOpen = null) => {
    const nextOpen = typeof forceOpen === "boolean" ? forceOpen : !isDownloadsOpen;
    isDownloadsOpen = nextOpen;
    downloadsPanel?.classList.toggle("visible", nextOpen);
    controls.downloadsBtn?.classList.toggle("active", nextOpen);
    // Reserving the right inset is what actually pulls the BrowserView in so the panel
    // can be seen. Without this call the panel sat behind the embedded web view.
    syncLayout();
    if (nextOpen) {
      const items = await api.getDownloads?.();
      if (items) vm.setDownloads(items);
      renderDownloads();
    }
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
    isUserEditingUrl = false;
    controls.urlInput.blur();
    await api.go(target);
    const tabsPosition = vm.settings.tabsPosition || "bottom";
    if (!vm.isHome && vm.settings.autoHidePill && tabsPosition === "bottom") {
      setBottomPillVisible(false);
    }
  };

  const openIncognitoTab = async () => {
    // Every incognito entry point spawns a real BrowserWindow now (the eyeglasses pill
    // button, the tabs-dock button, "Open new incognito tab" in Settings, Ctrl+Shift+N).
    // Inside the incognito window itself, this same handler creates an in-window tab
    // because the spawned window is already incognito.
    if (isIncognitoWindow) {
      await api.newTab?.({ url: "about:blank", incognito: true });
    } else {
      await api.newIncognitoWindow?.("about:blank");
    }
    setBottomPillVisible(true);
  };

  const closeActiveTab = async () => {
    if (!vm.activeTabId) return;
    await api.closeTab?.(vm.activeTabId);
    renderRecentlyClosedTabs(true);
  };

  const reopenLastClosedTab = async () => {
    await api.reopenClosedTab?.();
    setBottomPillVisible(true);
    renderRecentlyClosedTabs(true);
  };

  const render = (fromStateUpdate = false) => {
    controls.backBtn.disabled = !vm.canGoBack;
    controls.forwardBtn.disabled = !vm.canGoForward;
    controls.stopBtn.disabled = !vm.isLoading;
    controls.statusText.textContent = vm.isLoading ? "Loading..." : vm.host || "Ready";
    if (!isUserEditingUrl) controls.urlInput.value = sanitizeUrlForDisplay(vm.url, vm.isHome);

    startScreen.classList.toggle("hidden", !vm.isHome);
    bottomPill.classList.toggle("home-mode", vm.isHome);
    // The chrome's hover-to-reveal logic only works when the chrome has a strip the
    // user can actually hover. The tabs dock at the bottom is that strip when
    // tabsPosition === "bottom"; in top/left-tabs mode the page BrowserView fully
    // covers the chrome's reveal zone, so auto-hide leaves the pill unreachable. In
    // that combo we treat auto-hide as effectively off and keep the pill always
    // visible (its own native BrowserView renders above the page, so this is just a
    // "show", not a page resize).
    const tabsPosition = vm.settings.tabsPosition || "bottom";
    const pillIsReachableViaHover = tabsPosition === "bottom";
    if (
      vm.isHome ||
      isSettingsPageOpen ||
      !vm.settings.autoHidePill ||
      isTopPillMode() ||
      !pillIsReachableViaHover
    ) {
      setBottomPillVisible(true);
    }

    if (!isSettingsPageOpen) {
      document.title = vm.title ? `${vm.title} - JusBrowse` : "JusBrowse";
    }
    if (fromStateUpdate) {
      if (vm.isLoading) startProgress();
      else stopProgress();
    }
    renderTabs();
    if (isSettingsPageOpen && activeSettingsSectionId === "section-browsing") {
      renderRecentlyClosedTabs(true);
    }
    syncLayout();
  };

  controls.backBtn.addEventListener("click", () => api.back());
  controls.forwardBtn.addEventListener("click", () => api.forward());
  controls.homeBtn.addEventListener("click", () => api.home());
  controls.reloadBtn.addEventListener("click", () => api.reload());
  controls.stopBtn.addEventListener("click", () => api.stop());
  controls.downloadsBtn?.addEventListener("click", () => toggleDownloadsPanel());
  controls.settingsBtn.addEventListener("click", openSettingsPage);
  controls.closeSettingsBtn.addEventListener("click", closeSettingsPage);
  controls.closeDownloadsBtn?.addEventListener("click", () => toggleDownloadsPanel(false));
  controls.newTabBtn.addEventListener("click", () => api.newTab({ url: "about:blank" }));
  controls.newIncognitoTabBtn.addEventListener("click", openIncognitoTab);
  controls.incognitoBtn.addEventListener("click", openIncognitoTab);
  controls.openIncognitoFromSettingsBtn.addEventListener("click", openIncognitoTab);
  refreshAuthTraceBtn?.addEventListener("click", refreshAuthDiagnostics);
  copyDiagnosticsBtn?.addEventListener("click", copyDiagnosticsJson);
  controls.goBtn.addEventListener("click", () => executeSearchOrGo(controls.urlInput.value));
  controls.urlInput.addEventListener("focus", () => {
    isUserEditingUrl = true;
  });
  controls.urlInput.addEventListener("blur", () => {
    isUserEditingUrl = false;
    controls.urlInput.value = sanitizeUrlForDisplay(vm.url, vm.isHome);
  });
  controls.urlInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") executeSearchOrGo(controls.urlInput.value);
  });
  tabSearchInput?.addEventListener("input", (event) => {
    tabSearchQuery = String(event.target.value || "").trim();
    renderTabs();
  });
  tabSearchInput?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      tabSearchQuery = "";
      tabSearchInput.value = "";
      renderTabs();
    }
  });

  settingsNavButtons.forEach((button) => {
    button.addEventListener("click", () => activateSettingsSection(button.dataset.section));
  });
  themePresetGroup.querySelectorAll("[data-theme-preset]").forEach((chip) => {
    chip.addEventListener("click", () => {
      const nextTheme = chip.dataset.themePreset;
      saveSettings({ themePreset: nextTheme, darkMode: nextTheme !== "light" }, false);
    });
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
  inputs.darkModeToggle.addEventListener("change", (event) => {
    const darkEnabled = event.target.checked;
    const nextTheme = darkEnabled
      ? vm.settings.themePreset === "light"
        ? "dark"
        : vm.settings.themePreset
      : "light";
    saveSettings({ darkMode: darkEnabled, themePreset: nextTheme }, false);
  });
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
  inputs.blockTrackersToggle.addEventListener("change", (event) =>
    saveSettings({ blockTrackers: event.target.checked, adBlocker: event.target.checked })
  );
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
  inputs.shareAnalyticsToggle.addEventListener("change", (event) => saveSettings({ shareAnonymousAnalytics: event.target.checked }, true));
  inputs.virusTotalApiKeyInput.addEventListener("change", (event) => saveSettings({ virusTotalApiKey: event.target.value.trim() }, true));
  inputs.koodousApiKeyInput.addEventListener("change", (event) => saveSettings({ koodousApiKey: event.target.value.trim() }, true));
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

  inputs.showAdblockShieldToggle?.addEventListener("change", (event) =>
    saveSettings({ showAdblockShield: event.target.checked }, false)
  );

  pillPositionGroup?.querySelectorAll("[data-pill-position]").forEach((chip) => {
    chip.addEventListener("click", () => {
      const next = chip.dataset.pillPosition === "top" ? "top" : "bottom";
      saveSettings({ pillPosition: next }, false);
      // Force the pill visible when in top mode (it's permanently visible there).
      if (next === "top") setBottomPillVisible(true);
      syncLayout();
    });
  });

  tabsPositionGroup?.querySelectorAll("[data-tabs-position]").forEach((chip) => {
    chip.addEventListener("click", () => {
      const next = chip.dataset.tabsPosition === "left" ? "left" : chip.dataset.tabsPosition === "top" ? "top" : "bottom";
      saveSettings({ tabsPosition: next }, false);
      syncLayout();
    });
  });

  controls.adblockShieldBtn?.addEventListener("click", () => {
    const next = !vm.settings.blockTrackers;
    saveSettings({ blockTrackers: next, adBlocker: next }, true);
    controls.statusText.textContent = next ? "Ad blocker enabled" : "Ad blocker disabled";
    setTimeout(() => {
      controls.statusText.textContent = vm.host || "Ready";
    }, 1500);
  });

  controls.addStickerBtn?.addEventListener("click", () => triggerStickerPicker());
  controls.clearStickersBtn?.addEventListener("click", () => {
    vm.clearStickers();
    renderStickers();
    renderStickerGallery();
  });

  // Pill discoverability — generous thresholds with hysteresis so the pill is easy to
  // summon without flickering. Reveal triggers within ~140 px of the bottom; hide only
  // after the cursor leaves a wider ~260 px band. Both the dedicated reveal zone and
  // the tabs dock trigger reveal, and the global mousemove handler is a redundant
  // fallback for when the dedicated zone is covered (e.g. by a focused web element
  // capturing pointer events).
  const PILL_REVEAL_DISTANCE = 140;
  const PILL_HIDE_DISTANCE = 260;
  // Auto-track (the hover-to-reveal / mousemove-threshold logic) only makes sense
  // when the chrome has a reachable bottom strip. With tabs at top or left, the page
  // BrowserView fully covers the chrome's bottom area, so the only hide events that
  // can fire are tabsDock-mouseleave (top of the window) and the global mousemove
  // saying "you're far from the bottom" — both of which would race against render()'s
  // forced-visible rule and leave the pill flickering or stuck hidden. Gate auto-track
  // on tabsPosition === "bottom" so the pill stays the way render() decided it.
  const shouldAutoTrackPill = () =>
    !vm.isHome &&
    !isSettingsPageOpen &&
    vm.settings.autoHidePill &&
    !isTopPillMode() &&
    (vm.settings.tabsPosition || "bottom") === "bottom";

  bottomRevealZone.addEventListener("mouseenter", () => {
    if (!vm.isHome && !isTopPillMode()) setBottomPillVisible(true);
  });
  bottomRevealZone.addEventListener("mousemove", () => {
    if (!vm.isHome && !isTopPillMode()) setBottomPillVisible(true);
  });
  tabsDock.addEventListener("mouseenter", () => {
    if (!vm.isHome && !isTopPillMode()) setBottomPillVisible(true);
  });
  tabsDock.addEventListener("mouseleave", () => {
    if (!shouldAutoTrackPill()) return;
    setBottomPillVisible(false);
  });
  bottomPill.addEventListener("mouseleave", () => {
    if (!shouldAutoTrackPill()) return;
    setBottomPillVisible(false);
  });
  window.addEventListener("mousemove", (event) => {
    if (!shouldAutoTrackPill()) return;
    const distanceFromBottom = window.innerHeight - event.clientY;
    if (distanceFromBottom < PILL_REVEAL_DISTANCE) setBottomPillVisible(true);
    else if (distanceFromBottom > PILL_HIDE_DISTANCE) setBottomPillVisible(false);
  });

  window.addEventListener("keydown", (event) => {
    const target = event.target;
    const isTypingInEditableElement =
      target instanceof HTMLElement &&
      (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
    if (event.key === "Escape" && isTypingInEditableElement) return;
    if (event.key === "Escape" && isDownloadsOpen) {
      event.preventDefault();
      return toggleDownloadsPanel(false);
    }
    if (event.key === "Escape" && isSettingsPageOpen) return closeSettingsPage();
    if (event.key === "Escape" && vm.isLoading) {
      event.preventDefault();
      api.stop?.();
      return;
    }

    // Address-bar focus: Ctrl+L, F6, Alt+D
    if ((event.ctrlKey && event.key.toLowerCase() === "l") || event.key === "F6" || (event.altKey && event.key.toLowerCase() === "d")) {
      event.preventDefault();
      setBottomPillVisible(true);
      controls.urlInput.focus();
      controls.urlInput.select();
      return;
    }
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "f") {
      event.preventDefault();
      setBottomPillVisible(true);
      tabSearchInput?.focus();
      tabSearchInput?.select();
      return;
    }
    if (event.ctrlKey && event.key === ",") {
      event.preventDefault();
      openSettingsPage();
      return;
    }
    if (event.ctrlKey && event.key.toLowerCase() === "j") {
      event.preventDefault();
      toggleDownloadsPanel(true);
      return;
    }
    if (isTypingInEditableElement) return;

    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "n") {
      event.preventDefault();
      openIncognitoTab();
      return;
    }
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "t") {
      event.preventDefault();
      reopenLastClosedTab();
      return;
    }
    if (event.ctrlKey && event.key.toLowerCase() === "w") {
      event.preventDefault();
      closeActiveTab();
      return;
    }

    // Reload: F5 / Ctrl+R, Hard reload: Ctrl+F5 / Ctrl+Shift+R
    if (event.key === "F5") {
      event.preventDefault();
      if (event.ctrlKey || event.shiftKey) api.hardReload?.();
      else api.reload();
      return;
    }
    if (event.ctrlKey && event.key.toLowerCase() === "r") {
      event.preventDefault();
      if (event.shiftKey) api.hardReload?.();
      else api.reload();
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
      return;
    }
    if (event.altKey && event.key === "Home") {
      event.preventDefault();
      api.home?.();
      return;
    }

    // Fullscreen toggle
    if (event.key === "F11") {
      event.preventDefault();
      api.toggleFullScreen?.();
      return;
    }

    // Zoom: Ctrl++ / Ctrl+= zoom in, Ctrl+- zoom out, Ctrl+0 reset
    if (event.ctrlKey && (event.key === "+" || event.key === "=")) {
      event.preventDefault();
      api.zoom?.("in");
      return;
    }
    if (event.ctrlKey && event.key === "-") {
      event.preventDefault();
      api.zoom?.("out");
      return;
    }
    if (event.ctrlKey && event.key === "0") {
      event.preventDefault();
      api.zoom?.("reset");
      return;
    }
  });

  api.onState((state) => {
    vm.update(state);
    render(true);
  });
  api.onExternalAuthNotice?.((payload) => {
    const notice = vm.addExternalAuthNotice(payload);
    renderExternalAuthNotice(notice);
  });
  api.onPasswordOffer?.((payload) => {
    const prompt = vm.addPasswordPrompt(payload);
    renderPasswordBanner(prompt);
  });
  api.onAdblockStats?.((stats) => {
    vm.setAdblockStats(stats);
    renderAdblockBadge();
  });
  api.onDownloadsUpdated?.((items) => {
    vm.setDownloads(items);
    if (isDownloadsOpen) renderDownloads();
  });
  // Pill BrowserView routes user actions through main; main re-emits them here so
  // the existing chrome handlers (settings open, downloads toggle, adblock toggle)
  // stay the single source of truth.
  api.onPillToggleDownloads?.(() => toggleDownloadsPanel());
  api.onPillOpenSettings?.(() => openSettingsPage());
  api.onPillToggleAdblock?.(() => {
    const nextValue = !vm.settings.blockTrackers;
    vm.updateSetting("blockTrackers", nextValue);
    inputs.blockTrackersToggle.checked = nextValue;
    updateRuntimeSettings();
  });
  api.onPillGo?.((raw) => executeSearchOrGo(raw));
  // Seed the badge from the current count immediately so it never reads "0 blocked"
  // longer than necessary.
  api.getAdblockStats?.().then((stats) => {
    if (stats) {
      vm.setAdblockStats(stats);
      renderAdblockBadge();
    }
  });
  api.getDownloads?.().then((items) => {
    if (items) vm.setDownloads(items);
  });

  window.addEventListener("resize", syncLayout);
  applySettingsToUi();
  applyAboutSystemInfo();
  refreshAuthDiagnostics();
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

