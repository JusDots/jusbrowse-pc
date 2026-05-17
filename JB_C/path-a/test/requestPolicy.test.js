const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isCompatibilityHost,
  isSignInCriticalHost,
  isTrackerUrl,
  shouldBypassAdblockForRequest
} = require("../../../electron/requestPolicy");

test("isCompatibilityHost recognizes Google / WhatsApp sign-in hosts", () => {
  assert.equal(isCompatibilityHost("https://accounts.google.com/signin"), true);
  assert.equal(isCompatibilityHost("https://mail.google.com/inbox"), true);
  assert.equal(isCompatibilityHost("https://web.whatsapp.com/"), true);
  assert.equal(isCompatibilityHost("https://example.com/"), false);
});

test("isSignInCriticalHost covers gstatic / apis.google / oauth2.googleapis", () => {
  assert.equal(isSignInCriticalHost("https://ssl.gstatic.com/foo.js"), true);
  assert.equal(isSignInCriticalHost("https://fonts.gstatic.com/face.woff2"), true);
  assert.equal(isSignInCriticalHost("https://apis.google.com/js/api.js"), true);
  assert.equal(isSignInCriticalHost("https://oauth2.googleapis.com/token"), true);
  assert.equal(isSignInCriticalHost("https://example.com/"), false);
});

test("isTrackerUrl flags well-known ad/tracker hosts", () => {
  assert.equal(isTrackerUrl("https://ad.doubleclick.net/ddm/trackclk"), true);
  assert.equal(
    isTrackerUrl("https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"),
    true
  );
  assert.equal(isTrackerUrl("https://www.googletagmanager.com/gtm.js?id=GTM-XXX"), true);
  assert.equal(isTrackerUrl("https://www.google-analytics.com/collect?v=2"), true);
  assert.equal(isTrackerUrl("https://connect.facebook.net/en_US/fbevents.js"), true);
});

test("isTrackerUrl flags URL keywords like /ads/ and tracking", () => {
  assert.equal(isTrackerUrl("https://news.example.com/api/tracking/click"), true);
  assert.equal(isTrackerUrl("https://shop.example.com/ads/banner.js"), true);
  assert.equal(isTrackerUrl("https://example.com/pixel.gif?id=42"), true);
});

test("isTrackerUrl never flags Google sign-in / static asset hosts", () => {
  // Google's CDN URLs frequently contain generic keywords like "/analytics" or
  // "/tracking" but they are legit product assets — bypassing them here keeps the
  // sign-in flow alive.
  assert.equal(isTrackerUrl("https://ssl.gstatic.com/_/analytics/foo.js"), false);
  assert.equal(isTrackerUrl("https://accounts.google.com/_/signin/v2/tracking/ping"), false);
  assert.equal(isTrackerUrl("https://apis.google.com/js/api.js"), false);
});

test("shouldBypassAdblockForRequest bypasses sign-in URLs only", () => {
  // Sign-in URLs and critical CDN hosts bypass adblock entirely so the embedded
  // Google sign-in flow keeps working.
  assert.equal(shouldBypassAdblockForRequest("https://accounts.google.com/signin"), true);
  assert.equal(shouldBypassAdblockForRequest("https://apis.google.com/js/api.js"), true);
  assert.equal(shouldBypassAdblockForRequest("https://ssl.gstatic.com/foo.js"), true);
  assert.equal(shouldBypassAdblockForRequest("https://www.google.com/search?q=hi"), true);
});

test("shouldBypassAdblockForRequest does NOT bypass third-party tracker hosts", () => {
  // Previously a tab on google.com short-circuited blocking for ALL requests, including
  // ones to doubleclick.net / google-analytics.com. That over-broad bypass is gone.
  assert.equal(shouldBypassAdblockForRequest("https://doubleclick.net/ad/foo"), false);
  assert.equal(
    shouldBypassAdblockForRequest("https://www.google-analytics.com/collect"),
    false
  );
  assert.equal(
    shouldBypassAdblockForRequest("https://www.googletagmanager.com/gtm.js?id=GTM-XYZ"),
    false
  );
  assert.equal(shouldBypassAdblockForRequest("https://example.com/ads/banner"), false);
});

test("shouldBypassAdblockForRequest handles malformed URLs gracefully", () => {
  assert.equal(shouldBypassAdblockForRequest(""), false);
  assert.equal(shouldBypassAdblockForRequest("not-a-url"), false);
  assert.equal(shouldBypassAdblockForRequest(undefined), false);
});
