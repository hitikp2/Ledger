---
name: pwa-offline
description: Verify and maintain LEDGER's PWA install and fully-offline behavior (manifest.json, sw.js service worker, app-shell caching, secure-context requirements). Use after any change to assets, the service worker, or anything that could introduce a network call.
---

# PWA / Offline

LEDGER must install as a PWA and run fully offline with zero runtime network
calls. Protect that after every change.

## Key facts

- `sw.js` caches the app shell (`ledger.html`, `manifest.json`, icons) under
  `CACHE = 'ledger-vN'`. The fetch handler serves cache-first for same-origin,
  lets cross-origin pass through, and falls back to `ledger.html` offline.
- `manifest.json` `start_url` is `ledger.html`. The deployed app file must be
  named `ledger.html` (the manifest `start_url` and SW SHELL target it) and all files
  kept in one folder.
- Service workers + Web Crypto require a **secure context**: HTTPS or
  `localhost`. They will not work from `file://`.

## When you change cached assets

- Bump the `CACHE` version in `sw.js` (e.g. `ledger-v1` → `ledger-v2`) so old
  caches are purged on next load.
- Keep the `SHELL` list accurate if you add/remove cached files.

## Verify offline

1. Serve over a secure context: `python3 -m http.server` →
   `http://localhost:8000/ledger.html`.
2. Load once so the service worker installs and caches the shell.
3. Go offline (DevTools → Network → Offline) and reload — the app should still
   load and function.
4. Confirm **no runtime requests to third parties** in the Network panel.

## Checklist

- [ ] No new `fetch`/CDN/font/library requests added anywhere.
- [ ] `CACHE` bumped if cached assets changed.
- [ ] `SHELL` list matches the real asset set.
- [ ] App loads and works with the network disabled after first load.
