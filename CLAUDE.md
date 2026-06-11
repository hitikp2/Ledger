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

- [x] **1. Single source of truth.** Seeded `TXNS`/`RV_QUEUE` replaced by a
  `txns()` accessor over `VAULT.transactions`. A single `hydrate()` (called from
  `enterApp()`) renders the Register tape, totals, Explore, and Review on unlock.
  A fresh vault is seeded once via `seedTransactions()`; every mutation calls
  `saveVault()`.
- [x] **2. Register persistence.** `addEntry()` pushes a canonical transaction
  `{id, date, time, merchant, amount, direction, category, account, type,
  deductible}` into `VAULT`, awaits `saveVault()`, then re-renders today's tape
  and totals (computed live from `VAULT`).
- [x] **3. Import persistence.** An "Add to Ledger" button (`commitImport`)
  appends parsed rows to `VAULT.transactions` with dedupe (`date+merchant+amount`)
  and reports added/skipped; uncategorized rows (category null) feed Review.
- [x] **4. Review learning.** Confirming a category sets it on the transaction
  and writes a learned rule to `settings.merchantRules` (consulted first by
  `categorize()`). `settings.reviewCleared` is persisted. *Weekly-streak logic is
  still basic (`reviewStreak` stored but not yet rolled over per week).*
- [x] **5. Encrypted export / import.** A **Settings** tab exports the stored
  `salt` + `data` ciphertext to a `.ledger` JSON file (`exportVault`) and imports
  one back (`importVaultFile`, with overwrite confirm → `lockVault()` to re-unlock
  against the imported vault). Ciphertext-only; plaintext never leaves memory.
- [ ] **6. WebAuthn unlock.** Optional second-factor unlock via the existing
  `registerSecurityKey` / `assertSecurityKey`, gated behind a settings toggle.
- [ ] **7. Verification.** Console/test checks proving: wrong passphrase
  rejected, data persists across reload, IndexedDB holds only ciphertext.

### Changelog

- 2026-06-11 — Added `CLAUDE.md` and project skill folders under
  `.claude/skills/` to track progress and standardize common tasks.
- 2026-06-11 — Wired the UI to the live encrypted store (roadmap items 1–4):
  `VAULT.transactions` is now the single source of truth via `hydrate()`,
  `txns()`/`settings()` accessors, and `seedTransactions()`. Register, Import
  (with dedupe + confirm), and Review now read/write the vault and persist via
  `saveVault()`; `categorize()` consults learned `merchantRules`.
- 2026-06-11 — Added a **Settings** tab with encrypted export/import (roadmap
  item 5); bumped `sw.js` `CACHE` to `ledger-v2`. Flagged: the app still loads
  Google Fonts from a CDN (lines 13–14), which breaks the no-network/offline
  constraint and should be removed/self-hosted.

## Skills

Project-specific skills live in `.claude/skills/<name>/SKILL.md`:

- **vault-wiring** — wire UI tabs to the live encrypted `VAULT.transactions`
  store (the core production task).
- **crypto-review** — security review of the E2E encryption layer.
- **receipt-ui** — add/modify UI while preserving the receipt design system.
- **pwa-offline** — verify PWA install + offline behavior stays intact.
- **csv-import** — extend CSV parsing and the auto-categorization rules.
