// ─────────────────────────────────────────────────────────────
// Musicyber — track library (mood-only)
//
// Moods are the ONLY filter — every track carries a `mood` tag,
// and the mood chips (one of MOODS) filter the library into a
// playlist. The per-track `category` tag ("noise" | "music")
// selects playback behavior: "noise" tracks play through the live
// Web Audio synth engine (no files needed), "music" tracks play
// through the tape deck (<audio> element with simulated NO SIGNAL
// fallback).
//
// TO ADD YOUR MUSIC:
//   1. Drop audio files into  public/audio/focus/   (focus music)
//      or                       public/audio/scene/  (recorded ambiences)
//   2. Update the `src` paths below to match your filenames.
//   3. Adjust `duration` (seconds) so the progress bar is accurate
//      even before the file loads.
//
// TO ADD SCENE ART (pictures shown inside the CRT screen):
//   1. Drop images into  public/art/   (square-ish works best)
//   2. Set `art: "/art/<name>.png"` on the tracks below.
//   Until an image exists/loads, the player falls back to the
//   generated pixel animation.
// ─────────────────────────────────────────────────────────────

/** playback behavior of a track: synth engine vs tape deck */
export type Category = "noise" | "music";

export type NoiseVariant =
  | "rain"
  | "storm"
  | "cafe"
  | "forest"
  | "ocean"
  | "deepspace";

export type VisualKind = "rain" | "stars" | "wave" | "drive";

/** global mood list — chips on the main screen */
export const MOODS = ["CALM", "OUTER SPACE", "CYBERPUNK", "RAIN"] as const;
export type Mood = (typeof MOODS)[number];

/** mood → site-wide theme key (matches [data-theme] in globals.css) */
export function moodTheme(mood: string): string {
  switch (mood) {
    case "CALM":
      return "calm";
    case "OUTER SPACE":
      return "space";
    case "CYBERPUNK":
      return "cyberpunk";
    case "RAIN":
      return "rain";
    default:
      return "calm";
  }
}

/** mood → generated pixel animation for the visual panel */
export function moodVisual(mood: string): VisualKind {
  switch (mood) {
    case "RAIN":
      return "rain";
    case "OUTER SPACE":
      return "stars";
    case "CYBERPUNK":
      return "drive";
    case "CALM":
    default:
      return "wave";
  }
}

// ─────────────────────────────────────────────────────────────
// MOOD COVERS — pixel loop art for the visual panel + theater.
// Drop files into public/covers/ and register them here.
// Priority per mood: video loop → image (gif/png) → generated
// pixel animation. Example:
//   RAIN: { video: "/covers/rain-loop.mp4" },
//   CALM: { img: "/covers/calm-forest.gif" },
// ─────────────────────────────────────────────────────────────
export const MOOD_COVERS: Record<string, { img?: string; video?: string }> = {
  // CALM: { img: "/covers/calm.gif" },
  // "OUTER SPACE": { video: "/covers/space-loop.mp4" },
  CYBERPUNK: { video: "/covers/cyberpunk-loop.mp4" },
  // RAIN: { video: "/covers/rain-loop.mp4" },
};

export interface Track {
  id: string;
  title: string;
  artist: string;
  /** global mood tag (one of MOODS) */
  mood: string;
  category: Category;
  /** path under public/ — placeholder until you upload real files */
  src: string;
  /** seconds — drives the simulated fallback when src is missing */
  duration: number;
  visual: VisualKind;
  /** noise category only: which synth patch to use */
  engine?: NoiseVariant;
  /** optional scene art, e.g. "/art/rain-window.png" (public/art/) */
  art?: string;
}

// ─── builders ────────────────────────────────────────────────
const music = (
  mood: string,
  visual: VisualKind,
  rows: Array<[string, string, string, string, number, string?]>,
): Track[] =>
  rows.map(([id, title, artist, file, duration, art]) => ({
    id,
    title,
    artist,
    mood,
    category: "music",
    src: `/audio/focus/${file}`,
    duration,
    visual,
    art,
  }));

const scene = (
  mood: string,
  variant: NoiseVariant,
  visual: VisualKind,
  rows: Array<[string, string]>,
): Track[] =>
  rows.map(([id, title], i) => ({
    id,
    title,
    artist: "MUSICYBER ENGINE",
    mood,
    category: "noise",
    src: `/audio/scene/${variant}-0${i + 1}.mp3`, // optional recorded override
    duration: 3600, // endless ambience — 60 min virtual loop
    visual,
    engine: variant,
  }));

// ─── the library ─────────────────────────────────────────────
// Placeholder music rows removed. Only real files under public/audio/focus/
// plus live synth "noise" scenes (no files needed).
export const TRACKS: Track[] = [
  // ── CALM ──
  ...music("CALM", "wave", [
    // artist = you — shown in playlist + now-playing
    ["void-logic", "VOID LOGIC", "Joey G. CHOU", "void-logic.mp3", 156],
  ]),

  // ── OUTER SPACE — add focus music under public/audio/focus/ when ready ──

  // ── CYBERPUNK (drive) ──
  ...music("CYBERPUNK", "drive", [
    ["grid-runner", "GRID RUNNER", "Joey G. CHOU", "grid-runner.mp3", 167],
    ["prophet-rain", "PROPHET RAIN", "Joey G. CHOU", "prophet-rain.mp3", 173],
  ]),

  // ── RAIN — add focus music under public/audio/focus/ when ready ──
];

/** playlist for a mood chip */
export function filterTracks(mood: string): Track[] {
  return TRACKS.filter((t) => t.mood === mood);
}

export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "--:--";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
