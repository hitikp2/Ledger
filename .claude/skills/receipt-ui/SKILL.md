---
name: receipt-ui
description: Add or modify LEDGER UI while preserving the black-and-white paper-receipt design system, monospace type, hand-drawn SVG charts, and dark/light theming. Use when adding tabs/views, building panels (e.g. Settings), or restyling any part of ledger-receipt.html.
---

# Receipt UI

Keep every UI change faithful to LEDGER's "paper receipt" aesthetic.

## Design rules

- **Monospace, no color.** Black/white/grey only. No accent colors, no
  gradients, no rounded glossy buttons.
- **Theme tokens.** Use existing CSS custom properties (`var(--paper)`,
  `var(--ink)`, `var(--ink-2)`, `var(--ink-3)`, `var(--line)`, `var(--line-soft)`,
  …). Never hardcode hex colors in new markup.
- **Dark/light.** Everything must work under both `data-theme="light"` and
  `data-theme="dark"`. Rely on tokens; don't fight the theme toggle.
- **Charts** are hand-drawn inline SVG using `currentColor` (no chart libs).
- **No external fonts or assets.** Offline-first; nothing fetched at runtime.
- Reuse existing component classes: `.section-title`, `.li` (with `.k`/`.dots`/
  `.v`), `.split`, `.chart`, `.tag`, `.xp-*`, `.tabs`, `.view`. Match them rather
  than inventing new patterns.

## Adding a new tab/view

1. Add a `<button data-v="name">Name</button>` to `#tabs`.
2. Add a matching `<div class="view" id="v-name"> … </div>` (only the active
   view has class `on`). The existing tab handler wires it automatically.
3. Style with existing tokens/classes; add scoped CSS in the `<style>` block
   only if a pattern doesn't already exist.

## Checklist

- [ ] Renders correctly in both light and dark themes.
- [ ] Uses `var(--…)` tokens, not hardcoded colors.
- [ ] Monospace, no color creep.
- [ ] `.no-print` on controls that shouldn't appear in the printed receipt.
- [ ] No new runtime network requests or external assets.
