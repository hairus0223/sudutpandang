# AI Theme Preview Samples

Curated before/after images shown on registration theme cards.

## Layout

```
{theme-id}/
  after.jpg|png   — sample AI result (required for cards)
  before.jpg|png  — optional original for before/after modal
```

## Override in production (no deploy)

Copy the same structure to:

```
{BASE_DIR}/themes/{theme-id}/after.jpg
{BASE_DIR}/themes/{theme-id}/before.jpg
```

Studio overrides take priority over bundled files in this folder.

## Replace Wild West samples

Replace `wild-west/after.png` and `wild-west/before.png` with your official
before/after marketing shots when ready.
