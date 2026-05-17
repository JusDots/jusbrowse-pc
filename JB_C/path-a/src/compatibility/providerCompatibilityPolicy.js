const PROVIDER_KEYS = Object.freeze({
  GOOGLE_FAMILY: "google-family",
  MICROSOFT_FAMILY: "microsoft-family",
  GENERIC_OAUTH: "generic-oauth",
  UNKNOWN: "unknown"
});

const DEFAULT_COMPATIBILITY_POLICY = Object.freeze({
  providerKey: PROVIDER_KEYS.UNKNOWN,
  embeddedAuthAllowed: true,
  popupStrategy: "managed-tab",
  externalHandoffRequired: false,
  reasonCode: "default-policy",
  authHostPatterns: []
});

const PROVIDER_POLICY_REGISTRY = Object.freeze([
  {
    providerKey: PROVIDER_KEYS.GOOGLE_FAMILY,
    hostPatterns: [
      "accounts.google.com",
      "google.com",
      "youtube.com",
      "oauth2.googleapis.com",
      "myaccount.google.com"
    ],
    embeddedAuthAllowed: true,
    popupStrategy: "managed-tab",
    externalHandoffRequired: false,
    reasonCode: "embedded-with-compat-spoof"
  },
  {
    providerKey: PROVIDER_KEYS.MICROSOFT_FAMILY,
    hostPatterns: ["login.microsoftonline.com", "microsoft.com", "live.com"],
    embeddedAuthAllowed: true,
    popupStrategy: "managed-tab",
    externalHandoffRequired: false,
    reasonCode: "managed-tab-recommended"
  },
  {
    providerKey: PROVIDER_KEYS.GENERIC_OAUTH,
    hostPatterns: ["oauth", "auth", "login"],
    embeddedAuthAllowed: true,
    popupStrategy: "managed-tab",
    externalHandoffRequired: false,
    reasonCode: "generic-oauth-default"
  }
]);

function toHost(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function hostMatchesPattern(host, pattern) {
  if (!host || !pattern) return false;
  if (pattern.includes(".")) {
    return host === pattern || host.endsWith(`.${pattern}`);
  }
  return host.includes(pattern);
}

function resolveProviderPolicy(url) {
  const host = toHost(url);
  if (!host) {
    return { ...DEFAULT_COMPATIBILITY_POLICY };
  }

  const matchedPolicy = PROVIDER_POLICY_REGISTRY.find((policy) =>
    policy.hostPatterns.some((pattern) => hostMatchesPattern(host, pattern))
  );

  if (!matchedPolicy) {
    return { ...DEFAULT_COMPATIBILITY_POLICY };
  }

  return {
    providerKey: matchedPolicy.providerKey,
    embeddedAuthAllowed: matchedPolicy.embeddedAuthAllowed,
    popupStrategy: matchedPolicy.popupStrategy,
    externalHandoffRequired: matchedPolicy.externalHandoffRequired,
    reasonCode: matchedPolicy.reasonCode,
    authHostPatterns: [...matchedPolicy.hostPatterns]
  };
}

function shouldForceExternalHandoff(url) {
  const policy = resolveProviderPolicy(url);
  return Boolean(policy.externalHandoffRequired || !policy.embeddedAuthAllowed);
}

module.exports = {
  PROVIDER_KEYS,
  DEFAULT_COMPATIBILITY_POLICY,
  resolveProviderPolicy,
  shouldForceExternalHandoff
};
