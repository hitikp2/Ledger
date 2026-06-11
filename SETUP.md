# LEDGER — Browser-Only Encrypted PWA · Setup

You now have a working, installable, offline, end-to-end encrypted finance app.
No database to install. No server. Data lives encrypted on your device.

## Files

- `ledger.html` — the app (manifest `start_url` and the service worker target this name)
- `manifest.json` — makes it installable
- `sw.js` — service worker; caches the app for offline use
- `icon-192.png`, `icon-512.png` — app icons
- `ledger-crypto.js` — standalone copy of the crypto (already embedded in the app)
- `jetbrains-mono-latin.woff2` — self-hosted font so the app stays fully offline (no CDN)

> Note: the app file references `manifest.json` and `sw.js`, and the manifest’s
> `start_url` is `ledger.html` — which matches the file name. Just keep all
> files in the same folder; no renaming needed.

## Run it (3 options, all free)

### Option A — Netlify Drop (fastest, ~60 seconds)

1. Put all files in one folder.
1. Go to app.netlify.com/drop and drag the folder in.
1. You get an HTTPS URL. Open it on your phone.

### Option B — Cloudflare Pages

1. Same folder of files.
1. Create a project at pages.cloudflare.com, upload the folder.
1. HTTPS URL issued.

### Option C — GitHub Pages

1. New repo, add the files, enable Pages on the `main` branch.
1. Visit `https://<you>.github.io/<repo>/ledger.html`.

> HTTPS is required for service workers (offline) and Web Crypto. All three give it free.
> `localhost` also counts as secure if testing on your computer.

## Install on your phone

1. Open the HTTPS URL in Safari (iOS) or Chrome (Android).
1. iOS: Share -> Add to Home Screen. Android: menu -> Install app.
1. It now opens full-screen, offline, like a native app.

## First launch

- Choose a strong passphrase -> creates your encrypted vault.
- You get a one-time RECOVERY KEY. Write it down, store it offline.
  There is no password reset — this is the only backup way in.
- Lock anytime with the “⊘ Lock” button. Locking wipes the key from memory.

## Backup / sync (optional)

- The encrypted vault lives in the browser’s IndexedDB on that device.
- For multi-device: export the encrypted blob and drop it in iCloud/Dropbox.
  Because it’s already ciphertext, the cloud only ever sees noise.
  (Export/import UI is the next build step — see the Claude Code prompt.)

## What’s real vs. stubbed today

- REAL: AES-256-GCM encryption, PBKDF2 key derivation, IndexedDB ciphertext
  storage, unlock/lock, vault create, recovery-key generation, PWA install,
  offline caching, CSV import parsing + auto-categorization, Explore queries.
- STUBBED (wired next, see prompt): Register/Import/Explore reading & writing
  the live VAULT.transactions instead of seeded arrays; persisting confirmed
  categories; encrypted export/import; biometric/WebAuthn unlock.

-----

# Claude Code Prompt — take it to production

Paste this into Claude Code from the project folder:

-----

I have a single-file HTML personal-finance PWA called LEDGER (ledger.html) plus
manifest.json, sw.js, icons, and an embedded crypto layer. It already has:
a passphrase lock screen, AES-256-GCM encryption via Web Crypto, IndexedDB
ciphertext storage (DB “ledger-vault”, store “vault”, keys “salt” and “data”),
a session object `VAULT` ({version, createdAt, transactions:[], settings:{}})
held in memory with `VAULT_KEY`, and a `saveVault()` that re-encrypts and writes.
Tabs include Register, Import (CSV parse + auto-categorize via CAT_RULES),
Explore (filter/group engine over a seeded TXNS array), and Review (uncategorized
queue). The aesthetic is a black/white “receipt”, monospace, no color, dark/light
via data-theme, hand-drawn SVG charts using currentColor. Keep all of that intact.

Do the following without breaking the offline/PWA behavior or adding any runtime
network calls or third-party libraries:

1. Make the data store the single source of truth. Replace the seeded TXNS array
   and the Register’s in-memory tape and the Review queue with reads/writes against
   VAULT.transactions. Every mutation calls saveVault() so it persists encrypted.
   On unlock, hydrate the UI (Register tape, Explore results, Review queue, the
   summary numbers and charts) from VAULT.transactions.
1. Register: adding an entry pushes a transaction {id, date, merchant, amount,
   direction:‘in’|‘out’, category, account, type:‘biz’|‘per’, deductible} into
   VAULT, saves, and updates today’s totals.
1. Import: confirmed/parsed CSV rows are appended to VAULT.transactions with
   dedupe (date+merchant+amount). Uncategorized rows (category null) feed Review.
1. Review: confirming a category sets it on the transaction AND adds a learned
   rule to settings.merchantRules so the same merchant auto-categorizes next time.
   Persist the weekly review streak in VAULT.settings.
1. Add an encrypted Export / Import in a small Settings panel: export writes the
   current ciphertext blob (the IndexedDB “data” value) to a downloadable .ledger
   file; import reads such a file back. This is the multi-device/backup path.
1. Add an optional WebAuthn unlock using the existing registerSecurityKey /
   assertSecurityKey helpers as a second factor, gated behind a settings toggle.
1. Keep everything in vanilla JS, no build step, no external runtime fetches, and
   verify the app still installs and runs fully offline. Add a small test page or
   console checks proving: wrong passphrase rejected, data persists across reload,
   and IndexedDB contains only ciphertext.

Preserve the receipt design system and dark/light theming throughout.

-----