"use strict";

const os = require("os");

const CHROME_FULL = String(process.versions.chrome || "146.0.7680.216");
const CHROME_MAJOR = CHROME_FULL.split(".")[0] || "146";
const HW_CONCURRENCY = Math.max(4, (() => {
  try {
    return os.cpus().length;
  } catch {
    return 4;
  }
})());

// Script intentionally written as a single string so it can be shipped to a
// renderer's MAIN world via webFrame.executeJavaScript / WebFrameMain.executeJavaScript.
// Object.defineProperty calls inside a contextIsolation preload only mutate the
// isolated world, which is why Google's embedded-webview heuristics still flagged us.
const MAIN_WORLD_SPOOF_SCRIPT = `
(() => {
  if (window.__jbSpoofApplied) return;
  Object.defineProperty(window, "__jbSpoofApplied", { value: true, configurable: true });
  const define = (target, key, getter) => {
    try { Object.defineProperty(target, key, { get: getter, configurable: true }); } catch (_) {}
  };
  define(navigator, "webdriver", () => undefined);
  define(navigator, "languages", () => ["en-US", "en"]);
  define(navigator, "platform", () => "Linux x86_64");
  define(navigator, "vendor", () => "Google Inc.");
  define(navigator, "hardwareConcurrency", () => ${HW_CONCURRENCY});

  try {
    if (!window.chrome) Object.defineProperty(window, "chrome", { value: {}, configurable: true });
    const c = window.chrome;
    if (!c.runtime) {
      c.runtime = {
        id: undefined,
        OnInstalledReason: { CHROME_UPDATE: "chrome_update", INSTALL: "install", SHARED_MODULE_UPDATE: "shared_module_update", UPDATE: "update" },
        OnRestartRequiredReason: { APP_UPDATE: "app_update", OS_UPDATE: "os_update", PERIODIC: "periodic" },
        PlatformArch: { ARM: "arm", ARM64: "arm64", MIPS: "mips", MIPS64: "mips64", X86_32: "x86-32", X86_64: "x86-64" },
        PlatformOs: { ANDROID: "android", CROS: "cros", LINUX: "linux", MAC: "mac", OPENBSD: "openbsd", WIN: "win" },
        connect: () => ({
          name: "",
          onMessage: { addListener: () => {}, removeListener: () => {}, hasListener: () => false },
          onDisconnect: { addListener: () => {}, removeListener: () => {}, hasListener: () => false },
          postMessage: () => {},
          disconnect: () => {}
        }),
        sendMessage: () => {},
        getManifest: () => ({})
      };
    }
    if (!c.app) {
      c.app = {
        isInstalled: false,
        InstallState: { DISABLED: "disabled", INSTALLED: "installed", NOT_INSTALLED: "not_installed" },
        RunningState: { CANNOT_RUN: "cannot_run", READY_TO_RUN: "ready_to_run", RUNNING: "running" },
        getDetails: () => null,
        getIsInstalled: () => false
      };
    }
    if (typeof c.csi !== "function") {
      c.csi = () => ({ onloadT: Date.now(), pageT: Date.now() - performance.timeOrigin, startE: Math.floor(performance.timeOrigin), tran: 15 });
    }
    if (typeof c.loadTimes !== "function") {
      c.loadTimes = () => ({
        requestTime: performance.timeOrigin / 1000,
        startLoadTime: performance.timeOrigin / 1000,
        commitLoadTime: performance.timeOrigin / 1000,
        finishDocumentLoadTime: 0,
        finishLoadTime: 0,
        firstPaintTime: 0,
        firstPaintAfterLoadTime: 0,
        navigationType: "Other",
        wasFetchedViaSpdy: true,
        wasNpnNegotiated: true,
        npnNegotiatedProtocol: "h2",
        wasAlternateProtocolAvailable: false,
        connectionInfo: "h2"
      });
    }
  } catch (_) {}

  try {
    const PluginProto = window.Plugin ? window.Plugin.prototype : Object.prototype;
    const make = (name) => {
      const plugin = Object.create(PluginProto);
      Object.defineProperties(plugin, {
        name: { value: name, enumerable: true },
        filename: { value: "internal-pdf-viewer", enumerable: true },
        description: { value: "Portable Document Format", enumerable: true },
        length: { value: 1, enumerable: true }
      });
      return plugin;
    };
    const pluginList = [
      make("PDF Viewer"),
      make("Chrome PDF Viewer"),
      make("Chromium PDF Viewer"),
      make("Microsoft Edge PDF Viewer"),
      make("WebKit built-in PDF")
    ];
    define(navigator, "plugins", () => pluginList);
    const mimeTypes = [
      { type: "application/pdf", suffixes: "pdf", description: "" },
      { type: "text/pdf", suffixes: "pdf", description: "" }
    ];
    define(navigator, "mimeTypes", () => mimeTypes);
  } catch (_) {}

  try {
    const major = "${CHROME_MAJOR}";
    const full = "${CHROME_FULL}";
    const brands = [
      { brand: "Chromium", version: major },
      { brand: "Google Chrome", version: major },
      { brand: "Not_A Brand", version: "99" }
    ];
    const fullVersionList = [
      { brand: "Chromium", version: full },
      { brand: "Google Chrome", version: full },
      { brand: "Not_A Brand", version: "99.0.0.0" }
    ];
    const uaData = {
      brands,
      mobile: false,
      platform: "Linux",
      getHighEntropyValues: (hints) => Promise.resolve({
        architecture: "x86",
        bitness: "64",
        brands,
        fullVersionList,
        mobile: false,
        model: "",
        platform: "Linux",
        platformVersion: "6.0.0",
        uaFullVersion: full,
        wow64: false
      }),
      toJSON: () => ({ brands, mobile: false, platform: "Linux" })
    };
    Object.defineProperty(navigator, "userAgentData", { get: () => uaData, configurable: true });
  } catch (_) {}

  try {
    if (navigator.permissions && navigator.permissions.query) {
      const orig = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = (params) => {
        if (params && params.name === "notifications") {
          return Promise.resolve({ state: typeof Notification !== "undefined" ? Notification.permission : "default" });
        }
        return orig(params);
      };
    }
  } catch (_) {}

  // Drop the only globally-detectable Electron tell that Chromium leaks via window object names.
  try { delete window.__electronApi; } catch (_) {}
})();
`;

module.exports = {
  MAIN_WORLD_SPOOF_SCRIPT,
  CHROME_FULL,
  CHROME_MAJOR
};
