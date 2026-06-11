---
name: crypto-review
description: Security review of LEDGER's end-to-end encryption layer (ledger-crypto.js and the embedded copy in ledger.html). Use when changing, auditing, or reasoning about key derivation, AES-GCM encryption, IndexedDB ciphertext storage, recovery keys, or WebAuthn/FIDO2 key-binding.
---

# Crypto Review

Audit and protect LEDGER's client-side encryption. The threat model: an
attacker with the device/disk but not the passphrase (or hardware key) must
learn nothing.

## Invariants that must always hold

- **Key derivation**: PBKDF2-HMAC-SHA-256, **>= 600,000 iterations**, 16-byte
  random salt per vault. Never lower the iteration count.
- **Keys are non-extractable** (`extractable: false`) and never leave Web Crypto.
- **Cipher**: AES-256-GCM with a **fresh random 12-byte IV per encryption**.
  Never reuse an IV with a given key. GCM auth tag failure == wrong key or
  tampering — surface as "wrong passphrase or corrupted", never ignore.
- **Salt is not secret** but must be stored and reused per vault.
- **Only ciphertext persists.** No plaintext, key material, or recovery key in
  IndexedDB, localStorage, logs, or any network request.
- **No password reset / key escrow.** The recovery key is the only secondary
  path and is user-held, generated at setup.
- **No third-party crypto.** Web Crypto only.

## Two synced copies

The crypto exists twice: standalone `ledger-crypto.js` and embedded inside
`ledger.html`. Any change must be applied to **both** and kept identical.

## Review checklist

- [ ] Iterations still `KDF_ITERATIONS >= 600000`.
- [ ] IV freshly random per `encrypt()` call; never cached or reused.
- [ ] Derived keys non-extractable; usages minimal (`encrypt`/`decrypt` only).
- [ ] Decrypt failures handled as auth failures, not swallowed.
- [ ] No plaintext written anywhere durable; `saveVault()` writes only the
      envelope from `LedgerCrypto.encrypt`.
- [ ] Recovery key generated with CSPRNG (`crypto.getRandomValues`), shown once,
      never stored server-side or in IndexedDB in plaintext.
- [ ] WebAuthn: `userVerification: 'required'`; `hmac-secret` key-binding mixes
      the token secret into the KDF input, not appended to ciphertext.
- [ ] Both crypto copies identical.
- [ ] No new network calls introduced.

Report findings with severity and the exact `file:line`. Do not "fix" by
weakening a primitive — prefer correctness over convenience.
