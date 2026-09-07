# gwr_video (vendored watermark-removal engine)

This is a copy of `flow2api/vendor/gwr_video/` bundled into the RDP tool so
watermark-removal jobs can run locally on this machine instead of always on
the VPS. It is used by `gemini-rdp-tool/app/remote_watermark_worker.py`.

`node_modules/` is deliberately **not** included (platform-specific native
deps) — you must install it once on each RDP machine:

```
cd gemini-rdp-tool/vendor/gwr_video
npm install
```

## Requirements on this machine
- **Node.js** (any recent LTS) — set the path in Settings if it's not on
  your system PATH.
- **ffmpeg** — same as above.
- **A Chrome/Chromium browser** — the engine still launches a headless
  browser for watermark-region detection even on the fast path. This
  machine's regular Chrome install (already configured for Gemini
  automation, "Chrome executable path" in Settings) is reused automatically;
  you don't need a second install unless that field is empty and there's no
  `chromium`/`google-chrome` on PATH.

## Enabling
In the app's Settings tab, under "Watermark-removal offload":
1. Tick "Accept watermark-removal jobs from the website on this machine".
2. Optionally set explicit Node.js / ffmpeg paths (leave blank to
   auto-detect from PATH).
3. Save. The connection status under "Website connection" above shows
   whether this machine is idle/busy/erroring on watermark jobs.

This uses the same server URL + worker API key as the video-generation
worker above it — no separate registration needed.
