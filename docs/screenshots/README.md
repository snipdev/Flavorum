# Screenshots

Images embedded by the root `README.md`. All six are portrait phone shots (~967 × 1130),
captured from the narrow layout at ~390 px wide, English UI, dark theme — the app's bottom-tab
layout rather than the desktop sidebar layout.

| File | Screen | Shows |
| --- | --- | --- |
| `build.png` | Build → step 1 | "What shall we make today?" — Flavor Mix / Ready Mix and Load Batch |
| `batches.png` | Batches | A saved batch: steeping progress, target, flavor chips, result |
| `recipes.png` | Recipes | New-recipe form, 200 saved recipes, search and "Can Make" filters |
| `flavors.png` | Flavors | 35,664 ELR flavor names with brand badges and per-flavor usage |
| `prices.png` | Prices | Totals, add-flavor-price form and base prices |
| `stats.png` | Analytics | Totals, top flavors used and CSV export |

## Re-capturing

```bash
npm run web          # http://localhost:8088
```

- Resize the browser to ~390 px so the narrow layout and bottom tabs are used — the
  desktop sidebar layout appears at window width ≥ 820 px.
- The EN / TR toggle (top right) switches the UI language, the palette icon the theme.
- Keep the whole screen in frame so the bottom tab bar is visible.
- Screenshots taken inside the Freebuff preview carry its badge in the top-left corner —
  crop it out.

Keep new files lowercase, dash-separated and under ~1 MB; GitHub renders them at README
width, so anything around 1000 px wide is already more than enough.

## Referencing

```markdown
<img src="docs/screenshots/build.png" width="230" alt="Build wizard" />
```
