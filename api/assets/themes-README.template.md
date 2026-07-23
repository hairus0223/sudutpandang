# Theme Preview Samples (Production Override)

Place sample **before/after** images here so registration cards and kiosk intro
use your studio's marketing shots — **no redeploy required**.

## Structure

```
themes/
  {theme-id}/
    after.jpg|png    ← sample AI result (required for cards)
    before.jpg|png   ← optional, for before/after modal (e.g. wild-west)
    bg.jpg|png       ← composite background override (AI Self Photo, PR-B)
```

Example:

```
themes/
  wild-west/
    before.jpg
    after.jpg
    bg.jpg
  golden-hour/
    after.jpg
```

## Priority

1. **This folder** (`{BASE_DIR}/themes/`) — studio override (served at `/themes/...`)
2. Bundled fallback — `api/assets/ai-theme-previews/` (served at `/theme-previews/...`)

Restart API not required after adding files; refresh registration/gallery.

## Tips

- Use portrait ~3:4 ratio, consistent with capture framing
- `wild-west` is **transform** type — strong before/after helps sell the package
- Scene themes only need `after.jpg` (background composite sample)
- Keep files under ~2MB for fast LAN loading on kiosk

See also: `api/assets/ai-theme-previews/README.md` (bundled dev samples).
