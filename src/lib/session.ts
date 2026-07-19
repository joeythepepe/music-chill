"use client";

// localStorage persistence — single-screen player state (mood-only)
const STATE_KEY = "chillos:state";

export const CALLSIGN = "GUEST"; // no login — everyone is a guest operator

export interface PersistedState {
  mood: string; // one of MOODS
  trackId: string | null;
  volume: number; // 0..1
}

export const DEFAULT_STATE: PersistedState = {
  mood: "CALM",
  trackId: null,
  volume: 0.7,
};

export function getState(): PersistedState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STATE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    // legacy `mode` key from older versions is simply ignored
    return {
      mood: parsed.mood ?? DEFAULT_STATE.mood,
      trackId: parsed.trackId ?? null,
      volume: parsed.volume ?? DEFAULT_STATE.volume,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveState(patch: Partial<PersistedState>) {
  const next = { ...getState(), ...patch };
  window.localStorage.setItem(STATE_KEY, JSON.stringify(next));
}
