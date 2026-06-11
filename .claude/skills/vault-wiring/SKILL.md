---
name: vault-wiring
description: Wire LEDGER UI tabs (Register, Import, Explore, Review, totals, charts) to the live encrypted VAULT.transactions store instead of seeded demo arrays. Use when making the encrypted vault the single source of truth, persisting entries, hydrating UI on unlock, or implementing export/import of the vault.
---

# Vault Wiring

Make the encrypted `VAULT` the single source of truth so every tab reads and
writes real, persisted, encrypted data — not the seeded demo arrays.

## Background you must respect

- Plaintext lives only in memory: `VAULT = {version, createdAt, transactions:[],
  settings:{}}` and `VAULT_KEY` (dropped on lock). See `CLAUDE.md` for the full
  architecture and hard constraints.
- `saveVault()` re-encrypts `VAULT` and writes the `data` ciphertext to
  IndexedDB. **Every mutation must call `saveVault()`** so it persists.
- IndexedDB must only ever contain ciphertext. Never persist plaintext.

## Canonical transaction shape

```js
{ id, date, merchant, amount, direction:'in'|'out', category,
  account, type:'biz'|'per', deductible:0|1 }
```

Generate `id` with `crypto.randomUUID()`.

## Steps

1. **Hydrate on unlock.** In `enterApp()`, after the vault is decrypted, call a
   single `hydrate()` that re-renders the Register tape, Explore results, Review
   queue, and the summary totals/charts from `VAULT.transactions`.
2. **Replace seeded reads.** Point `xpFilter()`/`xpRender()` (Explore),
   `renderReview()` (Review), and the Register tape at `VAULT.transactions`
   instead of `TXNS` / `RV_QUEUE`. Keep the seeded arrays only as optional
   first-run demo seed, or remove them.
3. **Register writes.** `addEntry()` builds a canonical transaction, pushes it
   to `VAULT.transactions`, calls `saveVault()`, then updates today's totals and
   prepends to the tape.
4. **Import writes.** On confirm, append parsed rows to `VAULT.transactions`
   with dedupe on `date+merchant+amount`; uncategorized rows feed Review; call
   `saveVault()`.
5. **Review learning.** Confirming a category sets it on the transaction and
   adds a learned rule to `VAULT.settings.merchantRules` (merchant → category)
   so the same merchant auto-categorizes next time. Persist the weekly streak in
   `VAULT.settings`. Call `saveVault()`.
6. **Export / import.** Settings panel: export reads the IndexedDB `data` blob
   and downloads it as a `.ledger` file (it is already ciphertext); import reads
   such a file back into IndexedDB. This is the backup / multi-device path.

## Verify before finishing

- Add an entry → reload the page → the entry is still there (persistence).
- Inspect IndexedDB (`ledger-vault` → `vault` → `data`): value is an opaque
  envelope, **no plaintext merchant names or amounts**.
- A wrong passphrase still throws and is rejected on unlock.
- App still installs and runs fully offline (no new network calls).
