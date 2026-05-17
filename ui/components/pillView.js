(() => {
  // Renderer for the bottom-pill BrowserView. The pill lives in its OWN native child
  // BrowserView layered above the page BrowserView, which is what keeps the pill
  // visually on top of live web content without forcing the page to resize.

  const api = window.pillApi;
  if (!api) return;

  const $ = (id) => document.getElementById(id);
  const backBtn = $("backBtn");
  const forwardBtn = $("forwardBtn");
  const homeBtn = $("homeBtn");
  const reloadBtn = $("reloadBtn");
  const stopBtn = $("stopBtn");
  const downloadsBtn = $("downloadsBtn");
  const settingsBtn = $("settingsBtn");
  const incognitoBtn = $("incognitoBtn");
  const adblockShieldBtn = $("adblockShieldBtn");
  const goBtn = $("goBtn");
  const urlInput = $("urlInput");
  const pillShell = $("pillShell");

  if (api.isIncognito) {
    document.body.classList.add("incognito-window");
  }

  let snapshot = {
    url: "",
    isHome: true,
    isLoading: false,
    canGoBack: false,
    canGoForward: false,
    blockTrackers: true,
    isDownloadsOpen: false,
    pillPosition: "bottom",
    theme: { themeClass: "", lightMode: false, extraDark: false, cssVars: {} }
  };
  let isUserEditingUrl = false;

  const sanitizeUrl = (raw, isHome) => {
    const safe = String(raw || "").trim();
    if (!safe) return "";
    if (isHome) return "";
    if (safe === "about:blank") return "";
    return safe;
  };

  const applyTheme = (theme) => {
    if (!theme) return;
    document.body.classList.remove("theme-dark", "theme-purple", "light-mode", "extra-dark");
    if (theme.themeClass === "dark") document.body.classList.add("theme-dark");
    else if (theme.themeClass === "purple") document.body.classList.add("theme-purple");
    if (theme.lightMode) document.body.classList.add("light-mode");
    if (theme.extraDark) document.body.classList.add("extra-dark");
    const root = document.documentElement;
    const vars = theme.cssVars || {};
    ["--text", "--accent", "--accent-2", "--muted", "--border", "--glass-2"].forEach((key) => {
      if (vars[key]) root.style.setProperty(key, vars[key]);
      else root.style.removeProperty(key);
    });
  };

  const render = () => {
    backBtn.disabled = !snapshot.canGoBack;
    forwardBtn.disabled = !snapshot.canGoForward;
    stopBtn.disabled = !snapshot.isLoading;
    downloadsBtn.classList.toggle("active", Boolean(snapshot.isDownloadsOpen));
    const adblockOn = Boolean(snapshot.blockTrackers);
    adblockShieldBtn.classList.toggle("adblock-on", adblockOn);
    adblockShieldBtn.classList.toggle("adblock-off", !adblockOn);
    adblockShieldBtn.setAttribute("aria-pressed", String(adblockOn));
    if (!isUserEditingUrl) urlInput.value = sanitizeUrl(snapshot.url, snapshot.isHome);
  };

  api.onSnapshot?.((payload) => {
    snapshot = { ...snapshot, ...(payload || {}) };
    if (payload?.theme) applyTheme(payload.theme);
    render();
  });

  api.onFocusUrl?.(() => {
    urlInput.focus();
    urlInput.select();
  });

  backBtn.addEventListener("click", () => api.back());
  forwardBtn.addEventListener("click", () => api.forward());
  homeBtn.addEventListener("click", () => api.home());
  reloadBtn.addEventListener("click", () => api.reload());
  stopBtn.addEventListener("click", () => api.stop());
  downloadsBtn.addEventListener("click", () => api.toggleDownloads());
  settingsBtn.addEventListener("click", () => api.openSettings());
  incognitoBtn.addEventListener("click", () => api.openIncognito());
  adblockShieldBtn.addEventListener("click", () => api.toggleAdblock());
  const submitUrl = () => {
    const value = String(urlInput.value || "").trim();
    if (!value) return;
    // The chrome's executeSearchOrGo applies the search-engine fallback, the
    // chrome://settings shortcut, history tracking, and the auto-hide nudge.
    api.requestGo(value);
    urlInput.blur();
  };
  goBtn.addEventListener("click", submitUrl);
  urlInput.addEventListener("focus", () => {
    isUserEditingUrl = true;
  });
  urlInput.addEventListener("blur", () => {
    isUserEditingUrl = false;
    urlInput.value = sanitizeUrl(snapshot.url, snapshot.isHome);
  });
  urlInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      submitUrl();
    } else if (event.key === "Escape") {
      urlInput.blur();
    }
  });

  // Hover bookkeeping: the main process uses these hints to keep the pill visible
  // while the user is interacting and to dismiss it after they leave the pill area.
  // The pill BrowserView is sized exactly to its own bounds, so mouseenter/leave
  // here is a precise signal — no global mouse-position tracking required.
  pillShell.addEventListener("mouseenter", () => api.setHovered(true));
  pillShell.addEventListener("mouseleave", () => api.setHovered(false));
  // Treat any pointerdown inside the pill as a hover signal so a click never
  // accidentally raises the hide timer in the main process.
  pillShell.addEventListener("pointerdown", () => api.setHovered(true));

  render();
})();
