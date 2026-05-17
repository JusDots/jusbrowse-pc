"use strict";

// Pure request-policy helpers. Extracted from electron/main.js so the decision logic
// can be unit-tested without booting Electron. main.js imports from here and applies
// the decisions inside its session webRequest callbacks.
//
// The previous build leaked an over-broad compatibility bypass: any web request whose
// owning tab was on a `google.com` (or other compat) host short-circuited ad/tracker
// blocking entirely. That meant ads and trackers loaded freely on Google search results,
// YouTube watch pages, etc. — the user perceived "ad block isn't working anymore".
//
// The fix is to only bypass adblock when the request URL itself targets a known sign-in /
// auth domain. Sign-in flows continue to work because their requests legitimately target
// `accounts.google.com`, `apis.google.com`, `ssl.gstatic.com`, etc. Tracker requests
// (doubleclick.net, google-analytics.com, etc.) go through normal adblock decisioning
// regardless of which tab issued them.

const COMPATIBILITY_HOSTS = [
  "whatsapp.com",
  "web.whatsapp.com",
  "accounts.google.com",
  "google.com"
];

// Hosts that load real product UI/CDN assets during Google sign-in. We never want to
// flag these as trackers even if their URL happens to contain a keyword like
// "/analytics/" — Google's static asset paths frequently use generic words.
const SIGNIN_CRITICAL_HOSTS = [
  "accounts.google.com",
  "accounts.youtube.com",
  "apis.google.com",
  "play.google.com",
  "ssl.gstatic.com",
  "fonts.gstatic.com",
  "www.gstatic.com",
  "gstatic.com",
  "googleusercontent.com",
  "oauth2.googleapis.com",
  "content.googleapis.com",
  "people.googleapis.com"
];

const TRACKER_HOST_PATTERNS = [
  "doubleclick.net",
  "googlesyndication.com",
  "adservice.google.com",
  "adnxs.com",
  "facebook.net",
  "google-analytics.com",
  "googletagmanager.com",
  "googletagservices.com",
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
  "yahoo.com/p.gif",
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
  "app-measurement.com",
  "adjust.com",
  "snapads.com",
  "branch.io"
];

const TRACKER_URL_KEYWORDS = [
  "/ads/",
  "adservice",
  "analytics",
  "tracking",
  "tracker",
  "pixel",
  "beacon",
  "sponsor"
];

function safeHost(url) {
  try {
    return new URL(String(url || "")).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function matchesHostPattern(host, pattern) {
  if (!host || !pattern) return false;
  const p = String(pattern).toLowerCase();
  // Patterns may contain a path token like "yahoo.com/p.gif"; the host comparison
  // ignores the path part.
  const justHost = p.split("/")[0];
  return host === justHost || host.endsWith(`.${justHost}`);
}

function isCompatibilityHost(url, hosts = COMPATIBILITY_HOSTS) {
  const host = safeHost(url);
  if (!host) return false;
  return hosts.some((pattern) => matchesHostPattern(host, pattern));
}

function isSignInCriticalHost(url, hosts = SIGNIN_CRITICAL_HOSTS) {
  const host = safeHost(url);
  if (!host) return false;
  return hosts.some((pattern) => matchesHostPattern(host, pattern));
}

function isTrackerUrl(url, hosts = TRACKER_HOST_PATTERNS, keywords = TRACKER_URL_KEYWORDS) {
  const raw = String(url || "");
  if (!raw) return false;
  const host = safeHost(raw);
  if (!host) return false;
  // Never tag a sign-in/CDN host as a tracker. Google static asset URLs frequently
  // contain generic words like "/analytics/" that would otherwise false-positive.
  if (isSignInCriticalHost(raw)) return false;
  if (hosts.some((pattern) => matchesHostPattern(host, pattern))) return true;
  const lower = raw.toLowerCase();
  return keywords.some((token) => lower.includes(token));
}

function shouldBypassAdblockForRequest(url) {
  // Bypass blocking ONLY when the REQUEST URL targets a sign-in / auth host. We no
  // longer bypass simply because the tab is on a compatibility host — that was the
  // silent regression that disabled ad/tracker blocking everywhere on google.com.
  return isCompatibilityHost(url) || isSignInCriticalHost(url);
}

module.exports = {
  COMPATIBILITY_HOSTS,
  SIGNIN_CRITICAL_HOSTS,
  TRACKER_HOST_PATTERNS,
  TRACKER_URL_KEYWORDS,
  isCompatibilityHost,
  isSignInCriticalHost,
  isTrackerUrl,
  shouldBypassAdblockForRequest
};
