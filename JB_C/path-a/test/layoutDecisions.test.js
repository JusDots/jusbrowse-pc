const test = require("node:test");
const assert = require("node:assert/strict");

const {
  computeBrowserViewLayout,
  computeDownloadsInset,
  computePillInset,
  TABS_DOCK_HEIGHT,
  TABS_DOCK_WIDTH,
  PILL_BOTTOM_RESERVE,
  PILL_TOP_RESERVE,
  DOWNLOAD_PANEL_MAX_WIDTH,
  DOWNLOAD_PANEL_MIN_WIDTH
} = require("../../../ui/viewmodel/layoutDecisions");

// The bottom pill now renders in its own native BrowserView layered above the page
// (see electron/main.js: createPillView). Toggling the pill MUST NOT push the page
// upwards anymore — the bottom-pill reserve is zero on this layer. PILL_TOP_RESERVE
// is still honoured because the top pill is in-chrome and permanently visible.

test("PILL_BOTTOM_RESERVE is zero — the bottom pill no longer shrinks the page", () => {
  assert.equal(PILL_BOTTOM_RESERVE, 0);
});

test("computeBrowserViewLayout hides web view on home and settings", () => {
  const home = computeBrowserViewLayout({ isHome: true, tabsPosition: "bottom" });
  assert.equal(home.hideWebView, true);
  assert.deepEqual(home, { top: 0, bottom: 0, left: 0, right: 0, hideWebView: true });

  const settings = computeBrowserViewLayout({
    isHome: false,
    isSettingsOpen: true,
    tabsPosition: "top"
  });
  assert.equal(settings.hideWebView, true);
});

test("bottom-pill mode never adds a bottom inset, regardless of visibility", () => {
  for (const isPillVisible of [false, true]) {
    const bottomTabs = computeBrowserViewLayout({
      tabsPosition: "bottom",
      pillPosition: "bottom",
      isPillVisible
    });
    assert.deepEqual(bottomTabs, {
      top: 0,
      bottom: TABS_DOCK_HEIGHT,
      left: 0,
      right: 0,
      hideWebView: false
    });

    const topTabs = computeBrowserViewLayout({
      tabsPosition: "top",
      pillPosition: "bottom",
      isPillVisible
    });
    assert.deepEqual(topTabs, {
      top: TABS_DOCK_HEIGHT,
      bottom: 0,
      left: 0,
      right: 0,
      hideWebView: false
    });

    const leftTabs = computeBrowserViewLayout({
      tabsPosition: "left",
      pillPosition: "bottom",
      isPillVisible
    });
    assert.deepEqual(leftTabs, {
      top: 0,
      bottom: 0,
      left: TABS_DOCK_WIDTH,
      right: 0,
      hideWebView: false
    });
  }
});

test("top-pill mode permanently reserves PILL_TOP_RESERVE", () => {
  for (const isPillVisible of [false, true]) {
    const bottomTabs = computeBrowserViewLayout({
      tabsPosition: "bottom",
      pillPosition: "top",
      isPillVisible
    });
    assert.equal(bottomTabs.top, PILL_TOP_RESERVE);
    assert.equal(bottomTabs.bottom, TABS_DOCK_HEIGHT);
  }

  // When tabs are also at the top, the pill stacks BELOW the tabs row — the inset
  // math adds the two contributions (CSS pins the pill at top: 42px in this combo).
  const topTabsTopPill = computeBrowserViewLayout({
    tabsPosition: "top",
    pillPosition: "top",
    isPillVisible: true
  });
  assert.equal(topTabsTopPill.top, TABS_DOCK_HEIGHT + PILL_TOP_RESERVE);
  assert.equal(topTabsTopPill.bottom, 0);

  const leftTabsTopPill = computeBrowserViewLayout({
    tabsPosition: "left",
    pillPosition: "top",
    isPillVisible: false
  });
  assert.equal(leftTabsTopPill.top, PILL_TOP_RESERVE);
  assert.equal(leftTabsTopPill.left, TABS_DOCK_WIDTH);
});

test("home / settings collapse to hideWebView true regardless of pill state", () => {
  for (const pillPosition of ["bottom", "top"]) {
    for (const isPillVisible of [false, true]) {
      const home = computeBrowserViewLayout({
        isHome: true,
        pillPosition,
        isPillVisible,
        tabsPosition: "bottom"
      });
      assert.deepEqual(home, { top: 0, bottom: 0, left: 0, right: 0, hideWebView: true });
      const settings = computeBrowserViewLayout({
        isSettingsOpen: true,
        pillPosition,
        isPillVisible,
        tabsPosition: "top"
      });
      assert.equal(settings.hideWebView, true);
    }
  }
});

test("computeBrowserViewLayout never reserves a right inset for downloads", () => {
  // The downloads panel now floats above the page in its own BrowserView, so
  // toggling downloads must NOT change the page bounds (no right-side shrink).
  for (const isDownloadsOpen of [false, true]) {
    for (const tabsPosition of ["bottom", "top", "left"]) {
      const layout = computeBrowserViewLayout({
        tabsPosition,
        isDownloadsOpen,
        viewportWidth: 1280
      });
      assert.equal(layout.right, 0, `tabsPosition=${tabsPosition} downloads=${isDownloadsOpen}`);
    }
  }
});

test("computeBrowserViewLayout collapses to hideWebView on home/settings, ignoring downloads", () => {
  const home = computeBrowserViewLayout({
    isHome: true,
    isDownloadsOpen: true,
    viewportWidth: 1280
  });
  assert.equal(home.hideWebView, true);
  assert.equal(home.right, 0);

  const settings = computeBrowserViewLayout({
    isSettingsOpen: true,
    isDownloadsOpen: true,
    viewportWidth: 1280
  });
  assert.equal(settings.hideWebView, true);
  assert.equal(settings.right, 0);
});

test("downloads visibility never changes page bounds", () => {
  // Regression pin: with the popover BrowserView design, toggling downloads should
  // produce identical layout numbers as it being closed. The page is never resized.
  const base = {
    tabsPosition: "bottom",
    pillPosition: "bottom",
    viewportWidth: 1280
  };
  const closed = computeBrowserViewLayout({ ...base, isDownloadsOpen: false });
  const open = computeBrowserViewLayout({ ...base, isDownloadsOpen: true });
  assert.deepEqual(open, closed);
});

test("computeDownloadsInset is always zero", () => {
  // The function is preserved for backward compatibility; it must no longer carve
  // out any inset (the popover BrowserView handles the visible panel).
  assert.equal(computeDownloadsInset({ isDownloadsOpen: false, viewportWidth: 1280 }), 0);
  assert.equal(computeDownloadsInset({ isDownloadsOpen: true, viewportWidth: 240 }), 0);
  assert.equal(computeDownloadsInset({ isDownloadsOpen: true, viewportWidth: 4000 }), 0);
  // Constants stay exported for any caller that wants to size the popover card.
  assert.ok(DOWNLOAD_PANEL_MAX_WIDTH > DOWNLOAD_PANEL_MIN_WIDTH);
});

test("computePillInset is zero in bottom-pill mode at all times", () => {
  for (const isHome of [false, true]) {
    for (const isSettingsOpen of [false, true]) {
      assert.deepEqual(
        computePillInset({ pillPosition: "bottom", isHome, isSettingsOpen }),
        { top: 0, bottom: 0 }
      );
    }
  }
});

test("computePillInset returns PILL_TOP_RESERVE for top-pill mode (except home/settings)", () => {
  assert.deepEqual(
    computePillInset({ pillPosition: "top", isHome: false, isSettingsOpen: false }),
    { top: PILL_TOP_RESERVE, bottom: 0 }
  );
  assert.deepEqual(
    computePillInset({ pillPosition: "top", isHome: true }),
    { top: 0, bottom: 0 }
  );
  assert.deepEqual(
    computePillInset({ pillPosition: "top", isSettingsOpen: true }),
    { top: 0, bottom: 0 }
  );
});

test("tabs at bottom remain visible across every supported pill combination", () => {
  // Regression pin: the bottom-pill BrowserView lives at the OS level and never adds
  // to the inset math, so the BrowserView's bottom inset stays equal to the tabs-dock
  // reserve regardless of pillPosition. The tabs strip must always be visible.
  for (const pillPosition of ["bottom", "top"]) {
    for (const isPillVisible of [false, true]) {
      for (const isDownloadsOpen of [false, true]) {
        const layout = computeBrowserViewLayout({
          tabsPosition: "bottom",
          pillPosition,
          isPillVisible,
          isDownloadsOpen,
          viewportWidth: 1280
        });
        assert.equal(layout.bottom, TABS_DOCK_HEIGHT, `pill=${pillPosition} visible=${isPillVisible}`);
      }
    }
  }
});
