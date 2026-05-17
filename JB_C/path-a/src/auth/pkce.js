const crypto = require("crypto");

function toBase64Url(buffer) {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function randomBase64Url(size = 48) {
  return toBase64Url(crypto.randomBytes(Math.max(16, Number(size) || 48)));
}

function createPkcePair() {
  const verifier = randomBase64Url(64);
  const challenge = toBase64Url(crypto.createHash("sha256").update(verifier).digest());
  return {
    verifier,
    challenge,
    method: "S256"
  };
}

function createStateToken() {
  return randomBase64Url(32);
}

module.exports = {
  createPkcePair,
  createStateToken,
  toBase64Url
};
