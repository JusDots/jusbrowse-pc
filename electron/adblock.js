"use strict";

// JusBrowse adblocker. Two layers:
//   1. Network: match by host suffix and a small set of path tokens against a parsed host
//      list (Steven Black's hosts file or EasyList) cached in userData. Falls back to a
//      bundled tracker host list when no remote list is reachable.
//   2. Cosmetic: a CSS sheet injected into every page on did-finish-load when Advanced
//      AdBlock is on. Hides common ad/iframe selectors.
// Everything is computed once at startup and held in memory; runtime calls are O(1) host
// suffix lookups against a Set plus a short token scan.

const fs = require("fs");
const https = require("https");

const REMOTE_HOST_LISTS = [
  "https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts",
  "https://easylist.to/easylist/easylist.txt",
  "https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/pro.txt",
  "https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt"
];
const REMOTE_FETCH_TIMEOUT_MS = 8000;

const FALLBACK_TRACKER_HOSTS = [
  "doubleclick.net",
  "googlesyndication.com",
  "adservice.google.com",
  "adnxs.com",
  "facebook.net",
  "google-analytics.com",
  "googletagmanager.com",
  "taboola.com",
  "outbrain.com",
  "criteo.com",
  "scorecardresearch.com",
  "quantserve.com",
  "amazon-adsystem.com",
  "moatads.com",
  "rubiconproject.com",
  "openx.net",
  "pubmatic.com",
  "yieldmo.com",
  "casalemedia.com",
  "indexww.com",
  "smartadserver.com",
  "33across.com",
  "media.net",
  "adform.net",
  "bidswitch.net",
  "spotxchange.com",
  "demdex.net",
  "everesttech.net",
  "hotjar.com",
  "mixpanel.com",
  "segment.io",
  "amplitude.com",
  "fullstory.com",
  "ads-twitter.com",
  "branch.io",
  "unityads.unity3d.com",
  "app-measurement.com",
  "adjust.com",
  "snapads.com"
];

const PATH_TOKEN_BLOCKLIST = [
  "/ads/",
  "/ad/",
  "/adserver",
  "/adservice",
  "/adsystem",
  "/banner",
  "/banners/",
  "/popup/",
  "/sponsor",
  "/analytics",
  "/tracking",
  "/tracker",
  "/pixel",
  "/beacon",
  "/telemetry",
  "doubleclick.net",
  "googlesyndication"
];

const CRITICAL_ALLOW_HOST_PATTERNS = [
  "youtube.com",
  "youtube-nocookie.com",
  "googlevideo.com",
  "ytimg.com",
  "ggpht.com",
  "googleapis.com",
  "gstatic.com",
  "googleusercontent.com",
  "accounts.google.com"
];

// Cosmetic ad-block sheet. Each ad selector is qualified with `:not(:has(video)):not(:has(audio))`
// so we never hide a container that actually carries a media element — this fixes the long-standing
// regression where YouTube / news sites would lose their video frame (audio kept playing) once
// the ad-block CSS was injected on did-finish-load. The trailing rule is a belt-and-suspenders
// guard that force-restores any `<video>`/`<audio>` element we may have accidentally caught.
const COSMETIC_CSS = `
[id*="ad"]:not([id*="add"]):not([id*="address"]):not([id*="header"]):not([id*="adapt"]):not([id*="admin"]):not([id*="adopt"]):not([id*="player"]):not([id*="video"]):not([id*="audio"]):not(:has(video)):not(:has(audio)),
[id^="ad-"]:not(:has(video)):not(:has(audio)), [id$="-ad"]:not(:has(video)):not(:has(audio)),
[id^="ads-"]:not(:has(video)):not(:has(audio)), [id$="-ads"]:not(:has(video)):not(:has(audio)),
[class^="ad-"]:not([class*="ad-showing"]):not([class*="ad-interrupting"]):not(:has(video)):not(:has(audio)),
[class*=" ad-"]:not([class*="ad-showing"]):not([class*="ad-interrupting"]):not(:has(video)):not(:has(audio)),
[class^="ads-"]:not(:has(video)):not(:has(audio)), [class*=" ads-"]:not(:has(video)):not(:has(audio)),
[class*="advert"]:not(:has(video)):not(:has(audio)), [id*="advert"]:not(:has(video)):not(:has(audio)),
[class*="banner-ad"]:not(:has(video)):not(:has(audio)), [id*="banner-ad"]:not(:has(video)):not(:has(audio)),
[data-ad-slot]:not(:has(video)):not(:has(audio)),
[data-google-query-id]:not(:has(video)):not(:has(audio)),
[aria-label*="advertisement" i]:not(:has(video)):not(:has(audio)),
iframe[src*="doubleclick"], iframe[src*="googlesyndication"],
iframe[src*="googletagservices"], iframe[src*="adservice"],
ins.adsbygoogle, .adsbygoogle, .ad-container, .ad-wrap, .ad-slot, .google-ad, .gpt-ad {
  display: none !important;
  visibility: hidden !important;
  height: 0 !important;
  min-height: 0 !important;
}

/* Defensive override: if any rule above still happens to catch a media element on a site we
   haven't tested, force the element and its closest player wrapper back to visible. */
video, audio,
[id*="movie_player"], [id="player"], [id="movie_player"],
[class*="player-container"], [class*="video-player"], [class*="html5-video"] {
  display: revert !important;
  visibility: visible !important;
  height: revert !important;
  min-height: revert !important;
  opacity: 1 !important;
}
`;

function fetchTextOnce(targetUrl) {
  return new Promise((resolve) => {
    const request = https.get(
      targetUrl,
      { timeout: REMOTE_FETCH_TIMEOUT_MS, headers: { "User-Agent": "JusBrowseAdblockUpdater/1.0" } },
      (response) => {
        const status = Number(response.statusCode || 0);
        if (status < 200 || status >= 400) {
          response.resume();
          resolve("");
          return;
        }
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
          if (body.length > 6 * 1024 * 1024) request.destroy(new Error("blocklist-too-large"));
        });
        response.on("end", () => resolve(body));
      }
    );
    request.on("error", () => resolve(""));
    request.on("timeout", () => {
      request.destroy(new Error("timeout"));
      resolve("");
    });
  });
}

function parseHostsList(text) {
  const hosts = new Set();
  if (!text) return hosts;
  const lines = String(text).split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("!")) continue;
    if (line.startsWith("@@")) continue;
    if (line.startsWith("||")) {
      const hostFromRule = line
        .slice(2)
        .split(/[\^/$|]/)[0]
        .trim()
        .toLowerCase();
      if (hostFromRule && hostFromRule.includes(".") && !hostFromRule.includes("*")) {
        hosts.add(hostFromRule);
      }
      continue;
    }
    if (line.startsWith("|https://") || line.startsWith("|http://")) {
      try {
        const hostFromAbsoluteRule = new URL(line.slice(1).split("$")[0]).hostname.toLowerCase();
        if (hostFromAbsoluteRule.includes(".")) hosts.add(hostFromAbsoluteRule);
      } catch {
        // Ignore malformed absolute rules.
      }
      continue;
    }
    if (line.startsWith("[")) continue;
    if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(line)) {
      hosts.add(line.toLowerCase());
      continue;
    }
    const tokens = line.split(/\s+/);
    const candidate = tokens.length > 1 ? tokens[1] : tokens[0];
    const host = String(candidate || "").toLowerCase();
    if (!host || host === "localhost" || host === "0.0.0.0" || host === "127.0.0.1") continue;
    if (host.startsWith("#") || host.startsWith("!")) continue;
    if (!host.includes(".")) continue;
    if (host.includes("*") || host.includes("/")) continue;
    hosts.add(host);
  }
  return hosts;
}

function matchesHostPattern(host, pattern) {
  return host === pattern || host.endsWith(`.${pattern}`);
}

function isCriticalAllowHost(host) {
  const lowerHost = String(host || "").toLowerCase();
  if (!lowerHost) return false;
  return CRITICAL_ALLOW_HOST_PATTERNS.some((pattern) => matchesHostPattern(lowerHost, pattern));
}

class AdblockManager {
  constructor({ cachePath } = {}) {
    this.cachePath = cachePath || "";
    this.hosts = new Set(FALLBACK_TRACKER_HOSTS);
    this.pathTokens = PATH_TOKEN_BLOCKLIST.slice();
    this.cosmeticCss = COSMETIC_CSS;
    this.blockedCount = 0;
    this.ready = false;
    this.lastSource = "fallback";
  }

  async loadFromDisk() {
    if (!this.cachePath) return false;
    try {
      if (!fs.existsSync(this.cachePath)) return false;
      const stat = fs.statSync(this.cachePath);
      if (!stat.size) return false;
      const text = fs.readFileSync(this.cachePath, "utf8");
      const parsed = parseHostsList(text);
      if (!parsed.size) return false;
      this.hosts = new Set([...parsed, ...FALLBACK_TRACKER_HOSTS]);
      this.lastSource = "disk-cache";
      this.ready = true;
      return true;
    } catch {
      return false;
    }
  }

  async refreshFromRemote() {
    let combinedText = "";
    for (const url of REMOTE_HOST_LISTS) {
      const text = await fetchTextOnce(url);
      if (text) combinedText = combinedText ? `${combinedText}\n${text}` : text;
    }
    if (!combinedText) return false;
    const parsed = parseHostsList(combinedText);
    if (!parsed.size) return false;
    this.hosts = new Set([...parsed, ...FALLBACK_TRACKER_HOSTS]);
    this.lastSource = "remote";
    this.ready = true;
    if (this.cachePath) {
      try {
        fs.writeFileSync(this.cachePath, combinedText.slice(0, 6 * 1024 * 1024), "utf8");
      } catch {
        // Cache best-effort.
      }
    }
    return true;
  }

  async warmUp() {
    const haveDisk = await this.loadFromDisk();
    setTimeout(() => {
      void this.refreshFromRemote().catch(() => {});
    }, haveDisk ? 5000 : 250);
    this.ready = true;
  }

  matchHost(host) {
    if (!host) return false;
    const lower = String(host).toLowerCase();
    if (isCriticalAllowHost(lower)) return false;
    if (this.hosts.has(lower)) return true;
    let idx = lower.indexOf(".");
    while (idx >= 0) {
      const suffix = lower.slice(idx + 1);
      if (this.hosts.has(suffix)) return true;
      idx = lower.indexOf(".", idx + 1);
    }
    return false;
  }

  matchUrl(rawUrl) {
    const url = String(rawUrl || "");
    if (!url) return false;
    let host = "";
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      host = "";
    }
    if (isCriticalAllowHost(host)) return false;
    if (this.matchHost(host)) return true;
    const lowerUrl = url.toLowerCase();
    return this.pathTokens.some((token) => lowerUrl.includes(token));
  }

  getCosmeticCss() {
    return this.cosmeticCss;
  }

  incrementBlocked() {
    this.blockedCount += 1;
    return this.blockedCount;
  }

  getBlockedCount() {
    return this.blockedCount;
  }

  getStats() {
    return {
      ready: this.ready,
      source: this.lastSource,
      hostCount: this.hosts.size,
      blockedCount: this.blockedCount
    };
  }
}

// YouTube-specific cosmetic blocking. YouTube serves a lot of its "ads" as part of
// its own player surface (featured product cards, suggested-action overlays, paid
// promotion shelves, masthead ads, in-feed ad slots, channel companion cards). They
// look like normal player DOM so the generic id*="ad" / class*="ad" selectors above
// cannot safely hit them without risking the player itself. These selectors target
// the well-known YouTube ad components by their stable element names.
const YOUTUBE_AD_CSS = `
ytd-ad-slot-renderer,
ytd-display-ad-renderer,
ytd-action-companion-ad-renderer,
ytd-companion-slot-renderer,
ytd-promoted-sparkles-web-renderer,
ytd-promoted-sparkles-text-search-renderer,
ytd-promoted-video-renderer,
ytd-in-feed-ad-layout-renderer,
ytd-banner-promo-renderer,
ytd-statement-banner-renderer,
ytd-merch-shelf-renderer,
ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"],
#player-ads,
#masthead-ad,
ytd-rich-section-renderer:has(ytd-statement-banner-renderer),
ytd-rich-item-renderer:has(ytd-ad-slot-renderer),
.ytp-ad-overlay-container,
.ytp-ad-text-overlay,
.ytp-suggested-action,
.ytp-featured-product-bar,
.ytp-paid-content-overlay,
.ytp-ce-element,
.ytp-cards-button-shelf,
.iv-branding,
.ytd-merch-shelf-renderer {
  display: none !important;
  height: 0 !important;
  min-height: 0 !important;
  pointer-events: none !important;
}

/* The pre-roll/mid-roll ad container is given visibility:hidden so the player keeps
   advancing its clock and naturally moves past the ad break, while the auto-skip JS
   handles the skip button when YouTube renders one. */
.video-ads.ytp-ad-module {
  visibility: hidden !important;
  pointer-events: none !important;
}
`;

// Auto-skip helper for YouTube pre-roll/mid-roll ads. Runs every 400 ms; clicks the
// skip-ad button as soon as YouTube renders it and seeks past any non-skippable ad
// to the end of its duration so the user's playback resumes immediately.
const YOUTUBE_AD_SKIP_JS = `
(() => {
  if (window.__jbYtAdSkipper) return;
  window.__jbYtAdSkipper = true;
  const skip = () => {
    try {
      const player = document.querySelector(".html5-video-player");
      if (!player) return;
      const isShowingAd = player.classList.contains("ad-showing") || player.classList.contains("ad-interrupting");
      const skipBtn = document.querySelector(
        ".ytp-ad-skip-button, .ytp-skip-ad-button, .ytp-ad-skip-button-modern"
      );
      if (skipBtn) {
        skipBtn.click();
        return;
      }
      if (isShowingAd) {
        const video = player.querySelector("video");
        if (video && Number.isFinite(video.duration) && video.duration > 0) {
          try { video.currentTime = Math.max(0, video.duration - 0.05); } catch {}
          try { video.muted = true; } catch {}
        }
      }
    } catch {
      // best-effort — keep ticking
    }
  };
  setInterval(skip, 400);
  document.addEventListener("visibilitychange", skip);
})();
`;

module.exports = {
  AdblockManager,
  FALLBACK_TRACKER_HOSTS,
  PATH_TOKEN_BLOCKLIST,
  COSMETIC_CSS,
  YOUTUBE_AD_CSS,
  YOUTUBE_AD_SKIP_JS,
  parseHostsList
};
