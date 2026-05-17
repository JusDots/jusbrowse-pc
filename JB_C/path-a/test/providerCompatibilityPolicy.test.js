const test = require("node:test");
const assert = require("node:assert/strict");

const {
  PROVIDER_KEYS,
  resolveProviderPolicy,
  shouldForceExternalHandoff
} = require("../src/compatibility/providerCompatibilityPolicy");

test("resolveProviderPolicy identifies google-family with embedded sign-in enabled", () => {
  const policy = resolveProviderPolicy("https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(policy.providerKey, PROVIDER_KEYS.GOOGLE_FAMILY);
  assert.equal(policy.embeddedAuthAllowed, true);
  assert.equal(policy.externalHandoffRequired, false);
  assert.equal(policy.popupStrategy, "managed-tab");
  assert.equal(shouldForceExternalHandoff("https://accounts.google.com/signin"), false);
});

test("resolveProviderPolicy identifies microsoft-family defaults", () => {
  const policy = resolveProviderPolicy("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
  assert.equal(policy.providerKey, PROVIDER_KEYS.MICROSOFT_FAMILY);
  assert.equal(policy.embeddedAuthAllowed, true);
  assert.equal(policy.popupStrategy, "managed-tab");
  assert.ok(policy.authHostPatterns.includes("login.microsoftonline.com"));
});

test("resolveProviderPolicy falls back to default for unknown host", () => {
  const policy = resolveProviderPolicy("not-a-url");
  assert.equal(policy.providerKey, PROVIDER_KEYS.UNKNOWN);
  assert.equal(policy.externalHandoffRequired, false);
});
