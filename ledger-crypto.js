/* =====================================================================
   LEDGER · ledger-crypto.js
   Client-side end-to-end encryption layer.

   The principle: your data is encrypted IN THE BROWSER, before it ever
   leaves the device. The hub only ever stores opaque ciphertext. Without
   your passphrase (and, optionally, your hardware key), the stored data
   is mathematically useless — even to someone holding the disk.

   Primitives (all from the browser's audited Web Crypto API):
     · AES-256-GCM        confidentiality + integrity (authenticated)
     · PBKDF2-SHA-256     passphrase -> key, 600k iterations (OWASP 2023)
     · WebAuthn / FIDO2   hardware-key auth + optional key-binding

   No third-party crypto libraries. No keys ever sent anywhere.
   ===================================================================== */

const ENC = new TextEncoder();
const DEC = new TextDecoder();
const KDF_ITERATIONS = 600000;          // OWASP min for PBKDF2-HMAC-SHA256
const ENVELOPE_VERSION = 1;

/* ---- base64 helpers (binary-safe) ---- */
const b64 = {
  enc: (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))),
  dec: (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0)),
};

/* ---------------------------------------------------------------------
   deriveKey(passphrase, saltBytes)
   Turns a human passphrase into a 256-bit AES key. The salt makes every
   vault unique, so two people with the same passphrase get different keys
   and precomputed ("rainbow") attacks are useless.
   --------------------------------------------------------------------- */
async function deriveKey(passphrase, salt) {
  const baseKey = await crypto.subtle.importKey(
    'raw', ENC.encode(passphrase), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: KDF_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,                 // non-extractable: the key can never be read out
    ['encrypt', 'decrypt']
  );
}

/* ---------------------------------------------------------------------
   newVaultSalt() — call once when a vault is created; store it alongside
   the ciphertext (it is NOT secret). Re-used on every unlock.
   --------------------------------------------------------------------- */
function newVaultSalt() {
  return crypto.getRandomValues(new Uint8Array(16));
}

/* ---------------------------------------------------------------------
   encrypt(plainObject, key) -> envelope object (safe to store/transmit)
   A fresh random IV is generated per write (never reuse an IV with GCM).
   --------------------------------------------------------------------- */
async function encrypt(plainObject, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = ENC.encode(JSON.stringify(plainObject));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return {
    v: ENVELOPE_VERSION,
    alg: 'AES-256-GCM',
    iv: b64.enc(iv),
    ct: b64.enc(ct),
    ts: new Date().toISOString(),
  };
}

/* ---------------------------------------------------------------------
   decrypt(envelope, key) -> original object
   Throws if the ciphertext was tampered with (GCM auth tag fails) or the
   key is wrong. A thrown error here means "wrong passphrase or corrupted".
   --------------------------------------------------------------------- */
async function decrypt(envelope, key) {
  const iv = b64.dec(envelope.iv);
  const ct = b64.dec(envelope.ct);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return JSON.parse(DEC.decode(plain));
}

/* =====================================================================
   HARDWARE-KEY BINDING (YubiKey / any FIDO2 authenticator)

   Two distinct jobs people conflate:

   (A) AUTHENTICATION — "prove it's you" before the app will run.
       Standard WebAuthn. Phishing-proof second factor.

   (B) KEY-BINDING — make the decryption key require the physical key,
       not just the passphrase. Uses the FIDO2 `hmac-secret` extension:
       the authenticator returns a deterministic secret derived from a
       per-credential key it never exposes. We mix that secret INTO the
       passphrase-derived key. Result: data cannot be decrypted without
       BOTH the passphrase (something you know) AND the physical token
       (something you have). Lose either and the math doesn't close.

   Note: hmac-secret support varies by browser/OS. Treat (B) as the
   hardened tier; (A) works everywhere WebAuthn does.
   ===================================================================== */

async function registerSecurityKey(userId, userName) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  return navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'LEDGER' },
      user: { id: ENC.encode(userId), name: userName, displayName: userName },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'cross-platform', userVerification: 'required', residentKey: 'required' },
      extensions: { hmacCreateSecret: true },   // request (B) key-binding
      timeout: 60000,
    },
  });
}

async function assertSecurityKey(credentialId, hmacSalt) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  return navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: credentialId ? [{ type: 'public-key', id: credentialId }] : [],
      userVerification: 'required',
      extensions: hmacSalt ? { hmacGetSecret: { salt1: hmacSalt } } : undefined,
      timeout: 60000,
    },
  });
}

/* deriveHardenedKey: combine passphrase + the authenticator's hmac-secret.
   `tokenSecret` is the ArrayBuffer returned in getClientExtensionResults()
   .hmacGetSecret.output1 on a successful assert. */
async function deriveHardenedKey(passphrase, salt, tokenSecret) {
  const mixed = new Uint8Array(passphrase.length + tokenSecret.byteLength);
  mixed.set(ENC.encode(passphrase), 0);
  mixed.set(new Uint8Array(tokenSecret), passphrase.length);
  const baseKey = await crypto.subtle.importKey('raw', mixed, 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: KDF_ITERATIONS, hash: 'SHA-256' },
    baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}

/* =====================================================================
   RECOVERY KEY
   Because a properly secured vault has NO "forgot password", generate a
   one-time recovery key at setup. It encrypts a SECOND copy of the data
   key. Print it, seal it, store it off-site (safe / bank box). This is
   the single most-skipped, most-regretted step.
   ===================================================================== */
function generateRecoveryKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  // group into readable blocks: XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex.toUpperCase().match(/.{1,4}/g).join('-');
}

/* ---- module export (works as ES module or attaches to window) ---- */
const LedgerCrypto = {
  deriveKey, deriveHardenedKey, newVaultSalt,
  encrypt, decrypt,
  registerSecurityKey, assertSecurityKey,
  generateRecoveryKey, b64,
};
if (typeof window !== 'undefined') window.LedgerCrypto = LedgerCrypto;
if (typeof module !== 'undefined') module.exports = LedgerCrypto;
