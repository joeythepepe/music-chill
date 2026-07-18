<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# CHILL//OS — agent guide

A retro CRT-styled mood music player. Single-screen Next.js app: pick a mood,
it retunes the whole site's color theme and filters a mixed playlist of
synth-engine noise scenes and tape-deck music tracks.

## Commands

Package manager is **bun** (lockfile: `bun.lock`). Run all commands from this
directory (`app/`).

- `bun install` — install deps
- `bun dev` — dev server
- `bun run build` — production build (run this to verify changes)
- `bun run lint` — eslint

## Layout

- `src/app/page.tsx` — the whole main screen (mood chips, playlist, transport,
  sleep timer, theater mode). Most UI work happens here.
- `src/app/select/`, `src/app/player/` — legacy routes that redirect to `/`.
- `src/components/` — HUD primitives (`HudPanel`, `StatusBar`, `SegmentedBar`,
  `Equalizer`, `TestCard`, `VisualCanvas`, `MoodIcon`, `CrtScreen`).
- `src/lib/tracks.ts` — track registry, `MOODS` list, mood → theme/visual
  mapping. Add audio files to `public/audio/` and register them here.
- `src/lib/noiseEngine.ts` — Web Audio synth engine for "noise" category tracks.
- `src/lib/tv.tsx`, `src/lib/session.ts` — TV state (volume, theme) and
  persisted session (localStorage).

## Conventions

- **Themes are per-mood CSS variable sets** in `src/app/globals.css`
  (`[data-theme="..."]`, e.g. `rain`, `calm`, `deep`, `dream`, `drive`).
  Components consume `--color-glow`, `--color-ice`, `--color-dim`, etc. —
  add styles by theme token, not hard-coded colors.
- **Mood chips and icons**: moods are defined in `src/lib/tracks.ts`
  (`MOODS`). Pixel-art leading icons live in
  `src/components/MoodIcon.tsx` as inlined SVG paths from
  [Pixelarticons](https://pixelarticons.com/) (MIT, `pixelarticons` npm
  package) — inherit `currentColor`, 24×24 viewBox. Adding a mood means
  updating `MOODS`, a theme block, and an icon entry.
- **Aesthetic**: pixel fonts (`.font-pixel`), phosphor glow (`.glow-text`),
  scanline/vignette CRT overlays, `image-rendering: pixelated` on art.
  Keep new UI consistent with the HUD style (`hud-label`, `btn-hud`).
- Track playback behavior is split by `category`: `"noise"` = synth engine
  (no file needed), `"music"` = `<audio>` element with a NO SIGNAL fallback
  when the file is missing.

## Deploy

- GitHub repo: `main` branch, `git push origin main`.
- Vercel project `music-chill`: `vercel --prod --yes` deploys to production.
- Commit and push before deploying so the repo and Vercel stay in sync.
