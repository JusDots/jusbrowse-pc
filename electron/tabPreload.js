const { ipcRenderer, webFrame } = require("electron");
const { MAIN_WORLD_SPOOF_SCRIPT } = require("./mainWorldSpoof");

const USERNAME_KEYS = ["username", "email", "login", "user", "identifier"];
const PASSWORD_KEYS = ["password", "passwd", "pass", "pwd"];
const TRACKED_KEYS = new Set([...USERNAME_KEYS, ...PASSWORD_KEYS]);
let lastCapturedSignature = "";
let lastCapturedAt = 0;

// With contextIsolation enabled, Object.defineProperty on `navigator` from preload
// only mutates the preload's isolated world. Provider JS (Google, etc.) runs in the
// page's main world and would still see vanilla Electron internals. webFrame.executeJavaScript
// queues the script in the page's main world, which is what actually defeats the
// embedded-webview heuristics.
function injectMainWorldSpoof() {
  try {
    webFrame.executeJavaScript(MAIN_WORLD_SPOOF_SCRIPT, false).catch(() => {});
  } catch {
    // Some early-startup contexts don't allow injection yet; the main process also injects on
    // each frame navigation, so it's safe to swallow here.
  }
}

function normalizeFieldKey(name) {
  return String(name || "").trim().toLowerCase();
}

function extractTrackedFields(form) {
  const fields = {};
  const formData = new FormData(form);
  for (const [key, rawValue] of formData.entries()) {
    const normalized = normalizeFieldKey(key);
    const value = typeof rawValue === "string" ? rawValue.trim() : "";
    if (!value) continue;
    if (TRACKED_KEYS.has(normalized)) {
      fields[normalized] = value;
      continue;
    }
    if (normalized.includes("pass") || normalized.includes("pwd")) {
      fields.password = value;
      continue;
    }
    if (normalized.includes("user") || normalized.includes("mail") || normalized.includes("login")) {
      fields.username = value;
    }
  }

  const controls = form.querySelectorAll("input, textarea");
  controls.forEach((control) => {
    const value = typeof control.value === "string" ? control.value.trim() : "";
    if (!value) return;
    const key = normalizeFieldKey(control.name || control.id || control.autocomplete || "");
    const type = normalizeFieldKey(control.type || "");
    if (type === "password" || key.includes("pass") || key.includes("pwd")) {
      fields.password = fields.password || value;
      return;
    }
    if (!fields.username && (type === "email" || key.includes("user") || key.includes("mail") || key.includes("login"))) {
      fields.username = value;
    }
  });
  return fields;
}

function captureFromForm(form, url) {
  const fields = extractTrackedFields(form);
  if (!hasPasswordField(fields)) return;
  const signature = `${url || ""}|${fields.username || ""}|${fields.password || ""}`;
  const now = Date.now();
  if (signature === lastCapturedSignature && now - lastCapturedAt < 5000) return;
  lastCapturedSignature = signature;
  lastCapturedAt = now;
  ipcRenderer.send("passwords:capture-form", {
    url: url || window.location.href,
    fields
  });
}

function captureFromEventTarget(target) {
  if (!target || typeof target.closest !== "function") return;
  const form = target.closest("form");
  if (!(form instanceof HTMLFormElement)) return;
  captureFromForm(form, form.action || window.location.href);
}

window.addEventListener(
  "submit",
  (event) => {
    try {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      captureFromForm(form, form.action || window.location.href);
    } catch {
      // Ignore runtime/form-data parsing failures.
    }
  },
  true
);

window.addEventListener(
  "click",
  (event) => {
    try {
      captureFromEventTarget(event.target);
    } catch {
      // Ignore click capture failures.
    }
  },
  true
);

window.addEventListener(
  "keydown",
  (event) => {
    if (event.key !== "Enter") return;
    try {
      captureFromEventTarget(event.target);
    } catch {
      // Ignore keyboard capture failures.
    }
  }
);

// Many modern login pages (Google, Microsoft, etc.) submit via fetch/XHR with no real
// <form> submission. Snapshot the most-recent password input on any user input so the
// fetch/XHR hook can ship those credentials when the request fires.
//
// Google specifically does a two-page flow: identifier (email) on one document, then
// challenge/password on a *separate* document. lastObservedCredential resets between
// navigations, so we also persist the most recently observed username under sessionStorage
// keyed by origin + a process-side hint IPC. This is what makes "Save password?" actually
// fire on real Google logins.
let lastObservedCredential = { username: "", password: "" };
let lastShippedUsernameHint = "";

function shipUsernameHint(username) {
  const trimmed = String(username || "").trim();
  if (!trimmed || trimmed === lastShippedUsernameHint) return;
  lastShippedUsernameHint = trimmed;
  try {
    ipcRenderer.send("passwords:capture-form", {
      url: window.location.href,
      fields: { username: trimmed }
    });
  } catch {
    // Ignore IPC failures.
  }
  try {
    sessionStorage.setItem("__jbUsernameHint", trimmed);
  } catch {
    // sessionStorage may be unavailable on some pages.
  }
}

function loadUsernameHintFromSession() {
  try {
    const cached = sessionStorage.getItem("__jbUsernameHint");
    if (cached) lastObservedCredential.username = cached;
  } catch {
    // Ignore.
  }
}

function snapshotCredentialInputs(root = document) {
  try {
    const fields = { username: "", password: "" };
    const inputs = root.querySelectorAll("input");
    inputs.forEach((input) => {
      const value = typeof input.value === "string" ? input.value.trim() : "";
      if (!value) return;
      const key = normalizeFieldKey(input.name || input.id || input.autocomplete || "");
      const type = normalizeFieldKey(input.type || "");
      if (type === "password" || key.includes("pass") || key.includes("pwd")) {
        fields.password = fields.password || value;
        return;
      }
      if (
        !fields.username &&
        (type === "email" ||
          type === "text" ||
          key.includes("user") ||
          key.includes("mail") ||
          key.includes("login") ||
          key.includes("identifier"))
      ) {
        fields.username = value;
      }
    });
    if (fields.password) lastObservedCredential = fields;
    else if (fields.username) lastObservedCredential.username = fields.username;
  } catch {
    // Ignore traversal errors on detached/cross-origin nodes.
  }
}

window.addEventListener(
  "input",
  (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const type = normalizeFieldKey(target.type || "");
    const key = normalizeFieldKey(target.name || target.id || target.autocomplete || "");
    if (type === "password" || key.includes("pass") || key.includes("pwd")) {
      snapshotCredentialInputs();
    } else if (
      type === "email" ||
      type === "text" ||
      key.includes("user") ||
      key.includes("mail") ||
      key.includes("login") ||
      key.includes("identifier")
    ) {
      const value = (target.value || "").trim();
      if (value) {
        lastObservedCredential.username = value;
        shipUsernameHint(value);
      }
    }
  },
  true
);

window.addEventListener(
  "blur",
  (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (normalizeFieldKey(target.type || "") === "password") snapshotCredentialInputs();
  },
  true
);

function shipObservedCredential(reasonUrl) {
  const fields = lastObservedCredential;
  if (!fields || !fields.password) return;
  const signature = `${reasonUrl || ""}|${fields.username || ""}|${fields.password}`;
  const now = Date.now();
  if (signature === lastCapturedSignature && now - lastCapturedAt < 5000) return;
  lastCapturedSignature = signature;
  lastCapturedAt = now;
  try {
    ipcRenderer.send("passwords:capture-form", {
      url: reasonUrl || window.location.href,
      fields: { username: fields.username || "", password: fields.password }
    });
  } catch {
    // Ignore IPC failures (e.g. context destroyed).
  }
}

function looksLikeAuthRequest(url, method) {
  const upper = String(method || "").toUpperCase();
  if (upper !== "POST" && upper !== "PUT" && upper !== "PATCH") return false;
  const lowered = String(url || "").toLowerCase();
  return (
    lowered.includes("login") ||
    lowered.includes("signin") ||
    lowered.includes("auth") ||
    lowered.includes("session") ||
    lowered.includes("oauth") ||
    lowered.includes("token") ||
    lowered.includes("password") ||
    lowered.includes("credential") ||
    lowered.includes("identifier")
  );
}

const originalFetch = typeof window.fetch === "function" ? window.fetch.bind(window) : null;
if (originalFetch) {
  window.fetch = function patchedFetch(input, init = {}) {
    try {
      const url = typeof input === "string" ? input : input?.url || "";
      const method = init?.method || (typeof input === "object" ? input?.method : "GET");
      if (looksLikeAuthRequest(url, method)) shipObservedCredential(url);
    } catch {
      // Ignore introspection errors.
    }
    return originalFetch(input, init);
  };
}

if (typeof window.XMLHttpRequest === "function") {
  const xhrProto = window.XMLHttpRequest.prototype;
  const originalOpen = xhrProto.open;
  const originalSend = xhrProto.send;
  xhrProto.open = function patchedOpen(method, url, ...rest) {
    this.__jbAuthMethod = String(method || "GET");
    this.__jbAuthUrl = String(url || "");
    return originalOpen.call(this, method, url, ...rest);
  };
  xhrProto.send = function patchedSend(body) {
    try {
      if (looksLikeAuthRequest(this.__jbAuthUrl || "", this.__jbAuthMethod || "")) {
        shipObservedCredential(this.__jbAuthUrl || "");
      }
    } catch {
      // Ignore introspection errors.
    }
    return originalSend.call(this, body);
  };
}

function hasPasswordField(fields) {
  return PASSWORD_KEYS.some((key) => typeof fields[key] === "string" && fields[key].trim());
}

// Run at preload time so the navigator/chrome/userAgentData spoof is in place before any
// page script reads them. We inject again on DOMContentLoaded as a safety net for races.
injectMainWorldSpoof();
loadUsernameHintFromSession();
window.addEventListener("DOMContentLoaded", () => {
  injectMainWorldSpoof();
  loadUsernameHintFromSession();
}, { once: true });

