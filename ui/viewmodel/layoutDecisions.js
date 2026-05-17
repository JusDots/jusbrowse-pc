"use strict";

// Pure layout-decision helpers used by the renderer's topbar.js. Extracted as a
// UMD-style module so the same source serves both the node:test unit suite and the
// renderer (loaded via a <script> tag in browser.html, then read off the global).
//
// Contract:
//   - In Electron a BrowserView is a native child view that always paints above the
//     parent BrowserWindow's renderer DOM within its own bounds. There is NO renderer
//     z-index that can make in-renderer chrome float over the page content.
//   - The BOTTOM pill is therefore rendered in its own dedicated native BrowserView,
//     layered ABOVE the page BrowserView (see electron/main.js: createPillView). That
//     pill view does NOT change the page bounds — the page stays at its full size and
//     the pill paints over it. layoutDecisions.js consequently NEVER reserves a
//     bottom-pill inset; toggling the pill must not push the page upwards.
//   - The TOP pill is still rendered in the chrome HTML (it sits at the top of the
//     window permanently in pill-top mode), so it reserves PILL_TOP_RESERVE on the
//     top inset whenever pillPosition === "top".
//   - The tabs dock reserves space:
//       tabsPosition === "top"    -> top inset 42
//       tabsPosition === "bottom" -> bottom inset 42
//       tabsPosition === "left"   -> left inset 272
//   - When the user is on the home/start page or settings is open, the BrowserView
//     collapses to 1x1 (hideWebView=true).
//   - The downloads panel renders in its own native BrowserView (see
//     electron/main.js: createDownloadsView) layered above the page, so it never
//     reserves a right inset — toggling downloads must not resize the page either.
//     computeDownloadsInset is kept for callers but always returns 0.

(function (global, factory) {
  if (typeof module === "object" && module && typeof module.exports === "object") {
    module.exports = factory();
  } else {
    global.JusBrowseLayoutDecisions = factory();
  }
})(typeof self !== "undefined" ? self : typeof globalThis !== "undefined" ? globalThis : this, function () {
  const TABS_DOCK_HEIGHT = 42;
  const TABS_DOCK_WIDTH = 272;
  // Pill geometry: the top pill is a single 46-px-tall strip pinned to the window top
  // (rendered in the chrome HTML). The bottom pill has its own native BrowserView
  // layered above the page view, so its inset on this layer is intentionally zero —
  // making the pill visible never resizes the page.
  const PILL_BOTTOM_RESERVE = 0;
  const PILL_TOP_RESERVE = 46;
  const DOWNLOAD_PANEL_MIN_WIDTH = 260;
  const DOWNLOAD_PANEL_MAX_WIDTH = 452;
  const DOWNLOAD_PANEL_VIEWPORT_GUTTER = 24;

  function clampNumber(value, min, max) {
    const safe = Number(value);
    if (!Number.isFinite(safe)) return min;
    return Math.min(max, Math.max(min, safe));
  }

  function computeDownloadsInset(_state = {}) {
    // The downloads panel is no longer a docked inset — it floats above the page in a
    // dedicated BrowserView. Always return 0 so the page never resizes when the panel
    // opens. The MIN/MAX constants stay exported for any caller that still computes
    // the popover card width.
    void _state;
    return 0;
  }

  // Returns the {top, bottom} contribution from the pill, independent of tabs/downloads.
  // Home / settings collapse the entire BrowserView so the pill contributes 0 there.
  // Bottom-pill mode contributes 0 because the bottom pill renders in its own native
  // BrowserView layered above the page; the page should not move when it toggles.
  function computePillInset({ pillPosition, isHome, isSettingsOpen }) {
    if (isHome || isSettingsOpen) return { top: 0, bottom: 0 };
    if (String(pillPosition) === "top") {
      return { top: PILL_TOP_RESERVE, bottom: 0 };
    }
    return { top: 0, bottom: 0 };
  }

  function computeBrowserViewLayout(state = {}) {
    const isHome = Boolean(state.isHome);
    const isSettingsOpen = Boolean(state.isSettingsOpen);
    const tabsPosition = String(state.tabsPosition || "bottom");
    const pillPosition = String(state.pillPosition || "bottom");
    const viewportWidth = Number(state.viewportWidth) || 0;
    const isDownloadsOpen = Boolean(state.isDownloadsOpen);

    if (isHome || isSettingsOpen) {
      return { top: 0, bottom: 0, left: 0, right: 0, hideWebView: true };
    }

    const right = computeDownloadsInset({
      isDownloadsOpen,
      isHome,
      isSettingsOpen,
      viewportWidth
    });

    const pillInset = computePillInset({ pillPosition, isHome, isSettingsOpen });

    let top = 0;
    let bottom = 0;
    let left = 0;
    if (tabsPosition === "left") {
      left = TABS_DOCK_WIDTH;
    } else if (tabsPosition === "top") {
      top = TABS_DOCK_HEIGHT;
    } else if (tabsPosition === "bottom") {
      bottom = TABS_DOCK_HEIGHT;
    }

    // Top pill stacks below the top tabs row (CSS puts the pill at top:42px when both
    // are at the top), so we ADD the top contributions.
    top = top + pillInset.top;
    bottom = bottom + pillInset.bottom;

    return { top, bottom, left, right, hideWebView: false };
  }

  return {
    TABS_DOCK_HEIGHT,
    TABS_DOCK_WIDTH,
    PILL_BOTTOM_RESERVE,
    PILL_TOP_RESERVE,
    DOWNLOAD_PANEL_MIN_WIDTH,
    DOWNLOAD_PANEL_MAX_WIDTH,
    DOWNLOAD_PANEL_VIEWPORT_GUTTER,
    computeBrowserViewLayout,
    computeDownloadsInset,
    computePillInset
  };
});
