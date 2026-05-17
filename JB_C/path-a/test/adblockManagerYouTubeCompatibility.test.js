const test = require("node:test");
const assert = require("node:assert/strict");

const { AdblockManager } = require("../../../electron/adblock");

test("AdblockManager never blocks critical YouTube/Google media hosts", () => {
  const manager = new AdblockManager();
  manager.hosts = new Set(["youtube.com", "googlevideo.com", "ytimg.com"]);

  assert.equal(manager.matchUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), false);
  assert.equal(
    manager.matchUrl("https://rr1---sn-ab5szn7z.googlevideo.com/videoplayback?expire=9999999999"),
    false
  );
  assert.equal(manager.matchUrl("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"), false);
});

test("AdblockManager still blocks explicit ad/tracker endpoints", () => {
  const manager = new AdblockManager();
  manager.hosts = new Set(["doubleclick.net", "googlesyndication.com"]);

  assert.equal(manager.matchUrl("https://ad.doubleclick.net/ddm/trackclk/N123.456"), true);
  assert.equal(manager.matchUrl("https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"), true);
});

