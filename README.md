# CHILL//OS

A cyberpunk focus / ambient music terminal. **The whole website is an old CRT
screen** — strict 4:3 picture on deep black, convex bulge glass, scanlines,
channel-change static, per-mood color themes. Single screen, zero clicks to
music. Silkscreen + IBM Plex Mono.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS v4
- No UI libraries, no animation libraries — CSS keyframes + canvas only
- Package manager: **bun** (npm works identically)

## Run

```bash
bun install
bun dev        # http://localhost:3000
bun run build  # production build
```

## The screen

`/` is the whole app, inside a strict **4:3 CRT box** floating in a black
surround (`width: min(94vw, 94dvh * 4 / 3)`, `aspect-ratio: 4/3` — visible
margins on all sides, ratio never breaks).

Layout inside the screen:

1. **Status bar** — full-width TV chrome at the very top (GUEST callsign,
   pixel clock, signal bars)
2. **Two columns below (≥640px):**
   - **LEFT (~44%)** — TV area: the strict **square (1:1)** mood cover
     display, vertically centered, never scrolls; time/EQ overlays + ⛶ FULL
   - **RIGHT** — control area: MOOD SELECT chips, PLAYLIST, PLAY CONTROLS
     (track info, segmented seek, transport, volume + sleep). Scrolls
     internally (`overflow-y: auto`, themed thin scrollbar) when content
     exceeds the screen height
3. **< 640px:** falls back to the stacked single-column layout (visual on
   top, controls below, whole screen scrolls)

(`/select` and `/player` redirect to `/`.)

The screen has no hard rectangular edge: a pure-CSS alpha mask on
`.crt-box` melts the picture into the surround over the outermost ~24px
(two intersected multi-stop linear gradients on an eased ramp), while
the interior stays fully opaque and readable. The surround is ONE
seamless darkness with the app base color — a room-wide, boundary-less
ambient tint (`.stage-glow`, ~6% theme color at center fading to nothing)
plus faint scanlines and slow-drifting grain (≤0.05 opacity).

## Per-mood themes

No filter hacks — each mood sets `data-theme` on the screen root and every
color comes from CSS vars (`src/app/globals.css`):

| Theme       | Moods        | Palette                    |
| ----------- | ------------ | -------------------------- |
| `calm`      | CALM         | phosphor green             |
| `space`     | OUTER SPACE  | violet / purple            |
| `cyberpunk` | CYBERPUNK    | hot magenta-red            |
| `rain`      | RAIN         | steel cyan                 |

Canvas animations, EQ bars, test-card caption, art duotone washes and the
text bloom all follow the active theme. Switching mood = static burst +
instant re-theme.

## Mood covers (pixel loops — upload yours)

The visual panel + theater play per-mood cover art:

1. Drop files into **`public/covers/`** (video loops `.mp4` or images `.gif/.png`).
2. Register them in **`MOOD_COVERS`** in `src/lib/tracks.ts`:
   `RAIN: { video: "/covers/rain-loop.mp4" }` or `CALM: { img: "/covers/calm.gif" }`.
3. Priority: cover video → track art / cover image → NO SIGNAL test card →
   generated pixel animation. Everything renders `image-rendering: pixelated`.

Per-mood generated animations: RAIN→rain, OUTER SPACE→starfield,
CALM→waveform, CYBERPUNK→speed lines.

## Theater mode

⛶ FULL opens a fullscreen overlay (also tries native `requestFullscreen`,
best-effort): the mood cover/animation goes full-bleed and a wide control
panel docks lower-center — track info, segmented seek, transport, volume,
sleep chips, and mood chips so you can re-theme without leaving. Esc or
✕ EXIT closes. Playback/simulation/auto-advance keep running.

## Add your music

Tracks tagged `category: "noise"` need **no files** — synthesized live
(`src/lib/noiseEngine.ts`). For your own audio:

1. Drop files into `public/audio/focus/` (music) or `public/audio/scene/`.
2. Update `src` + `duration` in **`src/lib/tracks.ts`** (flat track list;
   `mood` filters it, `category: "music"` routes it to the tape deck).
3. Missing files fall back to the NO SIGNAL test card + simulated progress.

Track art also still works: `art: "/art/<name>.png"` per track
(`public/art/`), shown with a theme-colored duotone wash.

## Deploy

Push to GitHub and import in Vercel — zero config; or `bunx vercel`.
