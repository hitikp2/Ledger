---
name: csv-import
description: Extend LEDGER's local CSV import — parsing (parseCSV), auto-categorization rules (CAT_RULES / categorize), dedupe, and routing uncategorized rows to Review. Use when adding bank formats, new category rules, or improving import accuracy. All parsing is local; never upload files anywhere.
---

# CSV Import

LEDGER imports bank/card CSVs entirely in the browser — files are read with
`FileReader` and **never uploaded**. Keep it that way.

## How it works today

- `parseCSV(text)`: detects delimiter (`,` or tab) and a header row, finds the
  date / amount / description columns by name, and emits rows
  `{d, m, a, c, t, ded}` (amount normalized to a positive number).
- `categorize(desc)`: tests the merchant string against `CAT_RULES` — an ordered
  list of `[regex, {c:category, t:'biz'|'per', ded:0|1}]`. First match wins.
  No match → `null` → the row goes to the Review queue.

## Adding a categorization rule

Append to `CAT_RULES` (order matters — more specific patterns first):

```js
[/your|merchant|keywords/i, {c:'Category', t:'biz', ded:1}],
```

Use existing category names where possible (Food, Equipment, Auto, Software,
Marketing, Insurance, Health, Meals 50%, Travel, Other) so Explore/Review chips
stay consistent.

## When wiring import to the vault

- Append confirmed rows to `VAULT.transactions` in the canonical shape (see the
  `vault-wiring` skill), **deduping on `date+merchant+amount`**.
- Learned rules from Review should live in `VAULT.settings.merchantRules` and be
  consulted before `CAT_RULES`.
- Call `saveVault()` after appending.

## Checklist

- [ ] Parsing stays 100% local — no network/upload of file contents.
- [ ] New regexes are anchored/specific enough to avoid mis-categorizing.
- [ ] Reuses existing category names.
- [ ] Dedupe applied when appending to the vault.
- [ ] Uncategorized rows still route to Review.
