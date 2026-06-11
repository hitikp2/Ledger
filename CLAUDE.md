# CLAUDE.md — LEDGER

Guidance for Claude Code when working in this repository. Read this first.

## What this is

**LEDGER** is a private, browser-only, end-to-end **encrypted personal-finance
PWA**. There is no server and no database to install. All data is encrypted in
the browser (Web Crypto) before it ever touches disk, and lives as ciphertext in
IndexedDB on the user's own device. Without the passphrase (and optionally a
hardware key), the stored data is mathematically useless.

The product aesthetic is a black-and-white paper **receipt**: monospace, no
color, hand-drawn SVG charts, dark/light via `data-theme`.

## Files

| File | Role |
|------|------|
| `ledger-receipt.html` | The entire app — HTML + inline CSS + inline JS. Rename to `ledger.html` on deploy. **This is where almost all work happens.** |
| `ledger-crypto.js` | Standalone copy of the crypto layer. The same code is embedded inside the HTML; keep the two in sync. |
| `manifest.json` | PWA manifest. `start_url` is `ledger.html`. |
| `sw.js` | Service worker. Caches the app shell for offline use. Bump `CACHE` to invalidate. |
| `icon-192.png`, `icon-512.png` | App icons. |
| `SETUP.md` | Deploy instructions + the original production roadmap prompt. |
| `.claude/skills/` | Project-specific skills (see below). |

## Architecture

- **Crypto layer** (`LedgerCrypto`): `deriveKey` (PBKDF2-SHA-256, 600k iters →
  AES-256 key, non-extractable), `encrypt`/`decrypt` (AES-256-GCM, fresh 12-byte
  IV per write, authenticated), `newVaultSalt`, `generateRecoveryKey`, and
  WebAuthn helpers `registerSecurityKey` / `assertSecurityKey` /
  `deriveHardenedKey` (FIDO2 `hmac-secret` key-binding).
- **Storage**: IndexedDB DB `ledger-vault`, store `vault`. Keys: `salt`
  (non-secret, base64) and `data` (the ciphertext envelope). Helpers `idb`,
  `idbGet`, `idbSet`. **Only ciphertext is ever persisted.**
- **Session state** (memory only): `VAULT_KEY` (CryptoKey, dropped on lock) and
  `VAULT` (`{version, createdAt, transactions:[], settings:{}}`). `saveVault()`
  re-encrypts `VAULT` and writes the `data` blob.
- **Unlock flow** (`unlock`): first run generates a salt + recovery key and
  creates an empty vault; returning runs decrypt the stored blob to verify the
  passphrase (a thrown GCM error == wrong passphrase). `lockVault()` wipes keys
  from memory.
- **UI**: a tab system (`#tabs` → `.view`) with Overview, Register, Explore,
  Import, Review, plus statement-style display tabs. Theme toggle flips
  `data-theme`.
- **Import**: `parseCSV` (delimiter + header detection) → `categorize` against
  `CAT_RULES` (merchant-keyword regex → `{category, type, deductible}`).
  Uncategorized rows route to Review.
- **Explore**: `xpFilter`/`xpRender` — a filter + group-by engine (range,
  type, category, merchant, amount; group by category/merchant/week).

## Hard constraints — do not break these

1. **No build step.** Vanilla JS only. The HTML file runs as-is.
2. **No runtime network calls.** No `fetch` to third parties, no CDNs, no
   external fonts/libraries. The app must work fully offline.
3. **No third-party runtime libraries.** Crypto is Web Crypto only.
4. **Ciphertext-only persistence.** Plaintext lives in memory (`VAULT`) and
   never in IndexedDB, localStorage, or any log.
5. **Never weaken the crypto.** Don't lower PBKDF2 iterations, reuse IVs, make
   keys extractable, or add a password-reset/escrow path.
6. **Preserve the receipt design system** and dark/light theming in every UI
   change (monospace, no color, `currentColor` SVGs, `var(--…)` tokens).
7. **Keep `ledger-crypto.js` and the embedded crypto in `ledger-receipt.html`
   in sync** when either changes.

## Working conventions

- Edit `ledger-receipt.html` directly; there is no transpile/bundle.
- To test: serve the folder over HTTPS or `localhost` (service workers + Web
  Crypto require a secure context) and open in a browser. E.g.
  `python3 -m http.server` then visit `http://localhost:8000/ledger-receipt.html`.
- Match the existing terse, compact JS style in the file.
- When changing cached assets, bump `CACHE` in `sw.js`.

## Progress tracker

Status of the production roadmap (from `SETUP.md`). Update this list as work
lands.

- [ ] **1. Single source of truth.** Replace seeded `TXNS`, the Register's
  in-memory tape, and `RV_QUEUE` with reads/writes against `VAULT.transactions`.
  Hydrate all UI from `VAULT` on unlock; every mutation calls `saveVault()`.
- [ ] **2. Register persistence.** Adding an entry pushes a transaction
  `{id, date, merchant, amount, direction, category, account, type, deductible}`
  into `VAULT`, saves, and updates today's totals.
- [ ] **3. Import persistence.** Append parsed/confirmed CSV rows to
  `VAULT.transactions` with dedupe (`date+merchant+amount`); uncategorized rows
  feed Review.
- [ ] **4. Review learning.** Confirming a category sets it on the transaction
  and adds a learned rule to `settings.merchantRules`; persist the weekly review
  streak in `VAULT.settings`.
- [ ] **5. Encrypted export / import.** Settings panel: export the current
  ciphertext blob to a `.ledger` file; import reads it back. (Backup / multi-device.)
- [ ] **6. WebAuthn unlock.** Optional second-factor unlock via the existing
  `registerSecurityKey` / `assertSecurityKey`, gated behind a settings toggle.
- [ ] **7. Verification.** Console/test checks proving: wrong passphrase
  rejected, data persists across reload, IndexedDB holds only ciphertext.

### Changelog

- 2026-06-11 — Added `CLAUDE.md` and project skill folders under
  `.claude/skills/` to track progress and standardize common tasks.

## Skills

Project-specific skills live in `.claude/skills/<name>/SKILL.md`:

- **vault-wiring** — wire UI tabs to the live encrypted `VAULT.transactions`
  store (the core production task).
- **crypto-review** — security review of the E2E encryption layer.
- **receipt-ui** — add/modify UI while preserving the receipt design system.
- **pwa-offline** — verify PWA install + offline behavior stays intact.
- **csv-import** — extend CSV parsing and the auto-categorization rules.
