"use client";

// localStorage persistence — single-screen player state (mood-only)
const STATE_KEY = "musicyber:state";
/** Pre-rename key — migrated once on first read */
const LEGACY_STATE_KEY = "chillos:state";

export const CALLSIGN = "GUEST"; // no login — everyone is a guest operator

export type PlayMode = "sequence" | "loop" | "random";

export interface PersistedState {
  mood: string; // one of MOODS
  trackId: string | null;
  volume: number; // 0..1
  /** sequence | loop | random — how the playlist advances */
  playMode: PlayMode;
}

export const PLAY_MODES = ["sequence", "loop", "random"] as const;

export const PLAY_MODE_LABEL: Record<PlayMode, string> = {
  sequence: "SEQ",
  loop: "LOOP",
  random: "RND",
};

export const PLAY_MODE_TITLE: Record<PlayMode, string> = {
  sequence: "Sequence Play",
  loop: "One Loop",
  random: "Random Play",
};

export const DEFAULT_STATE: PersistedState = {
  mood: "CALM",
  trackId: null,
  volume: 0.7,
  playMode: "sequence",
};

function readRaw(): string | null {
  const current = window.localStorage.getItem(STATE_KEY);
  if (current) return current;
  // one-shot migrate from CHILL//OS storage key
  const legacy = window.localStorage.getItem(LEGACY_STATE_KEY);
  if (legacy) {
    window.localStorage.setItem(STATE_KEY, legacy);
    window.localStorage.removeItem(LEGACY_STATE_KEY);
    return legacy;
  }
  return null;
}

export function getState(): PersistedState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = readRaw();
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    // legacy `mode` key from older versions is simply ignored
    return {
      mood: parsed.mood ?? DEFAULT_STATE.mood,
      trackId: parsed.trackId ?? null,
      volume: parsed.volume ?? DEFAULT_STATE.volume,
      playMode: (PLAY_MODES as readonly string[]).includes(parsed.playMode ?? "")
        ? (parsed.playMode as PlayMode)
        : DEFAULT_STATE.playMode,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveState(patch: Partial<PersistedState>) {
  const next = { ...getState(), ...patch };
  window.localStorage.setItem(STATE_KEY, JSON.stringify(next));
}
