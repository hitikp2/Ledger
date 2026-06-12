# LEDGER — Real-Data Plan

Goal: turn LEDGER from a polished **demo** into a fully usable app. Remove all
hardcoded mockup content, keep every tab, and give each one real **data entry**
backed by the encrypted vault. Every number on screen should be the user's own.

This plan is phased so each step ships independently (one PR → auto-deploys to
GitHub Pages). It respects every hard constraint in `CLAUDE.md`: no build step,
no network calls, no third-party libs, ciphertext-only persistence, receipt
design system, crypto untouched.

---

## Where we are today

**Real / wired to `VAULT.transactions`:** Register, Explore, Import, Review,
today's totals, Settings.

**Static demo mockups (hardcoded HTML, no input):** Overview, Cash Flow, Invest,
Recurring, Goals, Receipts, Debt, Business, Taxes, Docs, Family, Travel,
Statement.

The only data the app can currently capture is **transactions**. Everything else
(accounts, balances, holdings, debts, goals, …) has nowhere to be entered.

---

## Data model (vault v2)

Extend the in-memory `VAULT` with new collections. All persist as ciphertext via
`saveVault()` exactly like `transactions`. A `migrateVault()` runs on unlock and
backfills missing collections so existing vaults upgrade safely.

```js
VAULT = {
  version: 2,
  createdAt,
  transactions: [ {id,date,merchant,amount,direction,category,account,type,deductible} ],
  accounts:     [ {id,name,institution,kind:'asset'|'liability',type,balance,apr?,rate?,family?,updatedAt} ],
  holdings:     [ {id,symbol,shares,costBasis,value,assetClass} ],
  recurring:    [ {id,name,amount,cadence,nextDate,kind:'subscription'|'fixed',category,account} ],
  goals:        [ {id,name,target,current,monthly,due,family?} ],
  mileage:      [ {id,date,miles,purpose,rate} ],
  docs:         [ {id,name,kind,addedAt,note} ],          // file blobs later
  snapshots:    [ {date,netWorth,assets,liabilities} ],   // powers trend charts
  settings: { profile, tax, merchantRules, webauthn, reviewStreak, reviewCleared }
}
```

Derived (never stored, always computed): net worth, asset/liability/liquid
splits, monthly in/out, category rollups, deductible totals, business net,
projected tax, debt interest, goal ETAs, alerts.

---

## Phase 0 — Foundation (do first)

The linchpin: a **reusable editable-list component** so we don't hand-write CRUD
13 times. Everything else builds on it.

- [ ] Bump vault to v2 + `migrateVault()` (backfill new arrays; idempotent).
- [ ] Generic CRUD helpers: `addItem(coll,obj)`, `updateItem`, `removeItem`, each
      `await saveVault()` + re-render.
- [ ] Reusable `editList({coll, fields, render})` — renders rows in the receipt
      `.li` style with add / edit / delete, an inline form built from a `fields`
      spec (text / number / date / select), confirm-on-delete. One component,
      reused by every tab.
- [ ] `derive` module: `netWorth()`, `liquid()`, `monthlyFlow()`,
      `byCategory()`, `deductibleYTD()`, `businessNet()`, etc.
- [ ] Strip demo HTML from all 13 mockup tabs → replace with a render container +
      empty-state ("No accounts yet — add one").
- [ ] Update Self-Test + bump `sw.js` CACHE.

## Phase 1 — Accounts + Overview (net-worth core)

- [ ] Accounts CRUD (name, institution, asset/liability, type, balance).
- [ ] Overview renders **derived** net worth, assets/liabilities/liquid, the
      accounts list, and YoY (once snapshots exist).
- [ ] Snapshot capture (monthly / on demand) → net-worth trend chart.

## Phase 2 — Cash Flow (derived, minimal input)

- [ ] In-vs-out by month, money-in / money-out by category, totals, savings rate
      — all from `transactions`.
- [ ] Runway/forecast from current liquid + `recurring` (after Phase 4).

## Phase 3 — Debt

- [ ] Debt entries = liability accounts with `apr`, `term`, `minPayment`.
- [ ] Derived: monthly interest, payoff strategies (avalanche/snowball),
      "+$X/mo" payoff scenarios.

## Phase 4 — Recurring

- [ ] Recurring CRUD (subscriptions + fixed: amount, cadence, next date).
- [ ] Derived monthly/annual totals; "renews this week" alerts.
- [ ] Optional: auto-detect recurring from repeating transactions.

## Phase 5 — Invest

- [ ] Holdings CRUD (symbol, shares, cost basis, value, asset class).
- [ ] Derived allocation donut, holdings list, unrealized gain.
- [ ] Values entered manually (no live quotes — offline constraint).

## Phase 6 — Goals

- [ ] Goals CRUD (name, target, current, monthly, due).
- [ ] Derived rings, progress bars, ETA, on-track/off-track flag.

## Phase 7 — Receipts / Business / Taxes (mostly derived)

- [ ] Receipts = transactions filtered (deductible / business) with optional note.
- [ ] Business = transactions where `type==='biz'`: income, expenses, net.
- [ ] Taxes = business net + deductible + `settings.tax` rates → projected tax,
      set-aside vs target, quarterly due dates.

## Phase 8 — Travel / Family / Docs / Statement

- [ ] Travel = `category==='Travel'` transactions + a mileage log CRUD.
- [ ] Family = accounts/goals tagged `family`.
- [ ] Docs = a document checklist first; encrypted file blobs (base64 in vault)
      as a later optional step.
- [ ] Statement = composite read-only summary of all derived numbers + print.

## Phase 9 — Alerts & cleanup

- [ ] Overview "Needs Attention" derived from real state (review count, upcoming
      recurring/tax due, goals off-track).
- [ ] Replace remaining demo strings (header account/period, footers).

---

## Cross-cutting rules

- Each phase: edit `ledger.html` only; CRUD calls `saveVault()`; re-`hydrate()`.
- Keep the receipt design system + dark/light (see `receipt-ui` skill).
- Ciphertext-only at rest; no network; no libraries.
- Bump `sw.js` CACHE every deploy; extend Self-Test to cover new collections.
- One PR per phase so each is reviewable and independently deployable.

## Suggested order of delivery

0 → 1 (accounts/overview) → 4 (recurring) → 3 (debt) → 2 (cash flow) →
5 (invest) → 6 (goals) → 7 (receipts/business/taxes) → 8 → 9.

Rationale: Phase 0 unlocks everything; accounts give the headline net-worth
number; recurring + debt feed Cash Flow's forecast; the rest layer on.
