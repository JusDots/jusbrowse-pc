(() => {
  // Renderer for the Downloads popover BrowserView. Mirrors the layout of the in-chrome
  // downloads list so the popover feels native to JusBrowse while floating on top of
  // the page like Chrome's downloads dropdown.

  const api = window.downloadsApi;
  if (!api) return;

  const list = document.getElementById("list");
  const closeBtn = document.getElementById("closeBtn");
  const card = document.getElementById("downloadsCard");

  if (api.isIncognito) {
    document.body.classList.add("incognito-window");
  }

  let items = [];
  let theme = null;

  const formatBytes = (bytes) => {
    const safe = Math.max(0, Number(bytes) || 0);
    if (safe === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.min(Math.floor(Math.log(safe) / Math.log(k)), sizes.length - 1);
    return `${(safe / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
  };

  const applyTheme = (next) => {
    if (!next) return;
    theme = next;
    document.body.classList.remove("theme-dark", "theme-purple", "light-mode", "extra-dark");
    if (theme.themeClass === "dark") document.body.classList.add("theme-dark");
    else if (theme.themeClass === "purple") document.body.classList.add("theme-purple");
    if (theme.lightMode) document.body.classList.add("light-mode");
    if (theme.extraDark) document.body.classList.add("extra-dark");
    const root = document.documentElement;
    const vars = theme.cssVars || {};
    ["--text", "--accent", "--accent-2", "--muted", "--border", "--glass", "--glass-2"].forEach((key) => {
      if (vars[key]) root.style.setProperty(key, vars[key]);
      else root.style.removeProperty(key);
    });
  };

  const render = () => {
    list.innerHTML = "";
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "downloads-empty";
      empty.textContent = "No downloads yet.";
      list.appendChild(empty);
      return;
    }
    items.forEach((entry) => {
      const cardEl = document.createElement("div");
      cardEl.className = "download-item";
      const state = String(entry.state || "progressing");
      const meta = state === "progressing" ? "Downloading..." : state.charAt(0).toUpperCase() + state.slice(1);
      const bytesPart =
        Number(entry.totalBytes) > 0
          ? `${formatBytes(entry.receivedBytes)} / ${formatBytes(entry.totalBytes)}`
          : formatBytes(entry.receivedBytes);
      const row = document.createElement("div");
      row.className = "download-item-main";
      row.innerHTML = `
        <div class="download-name"></div>
        <div class="download-meta"></div>
      `;
      // Set text via textContent to neutralise any chars in the filename that could
      // otherwise be parsed as HTML (filenames are arbitrary user/server-controlled).
      row.querySelector(".download-name").textContent = entry.fileName || "Download";
      row.querySelector(".download-meta").textContent = `${meta} • ${bytesPart}`;
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
      openBtn.addEventListener("click", () => api.openDownload(entry.id));
      const openFolderBtn = document.createElement("button");
      openFolderBtn.className = "settings-close";
      openFolderBtn.textContent = "Show in folder";
      openFolderBtn.disabled = !entry.targetPath;
      openFolderBtn.addEventListener("click", () => api.openDownloadFolder(entry.id));
      actions.appendChild(openBtn);
      actions.appendChild(openFolderBtn);
      cardEl.appendChild(row);
      cardEl.appendChild(progress);
      cardEl.appendChild(actions);
      list.appendChild(cardEl);
    });
  };

  api.onSnapshot?.((payload) => {
    if (payload?.theme) applyTheme(payload.theme);
    if (Array.isArray(payload?.items)) items = payload.items;
    render();
  });

  api.onItems?.((next) => {
    items = Array.isArray(next) ? next : [];
    render();
  });

  closeBtn.addEventListener("click", () => api.requestClose());

  // Initial pull in case the popover opens before the first snapshot arrives.
  api.requestList?.().then((next) => {
    if (Array.isArray(next)) {
      items = next;
      render();
    }
  }).catch(() => render());

  render();
})();
