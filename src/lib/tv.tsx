"use client";

// ─────────────────────────────────────────────────────────────
// CHILL//OS — CRT context
// Shared with the whole site: volume (persisted), active theme
// (per-mood palette), channel-change static bursts and the
// power on/off boot animations. The physical deck is gone —
// the page itself is the screen.
// ─────────────────────────────────────────────────────────────

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getState, saveState } from "./session";
import { playStaticClick } from "./noiseEngine";

interface TvContextValue {
  volume: number;
  setVolume: (v: number) => void;
  volumeStep: (d: number) => void;
  /** full-screen TV static burst + audio click */
  staticBurst: () => void;
  powerOnThen: (cb?: () => void) => void;
  powerOffThen: (cb?: () => void) => void;
  /** active palette key — applied as [data-theme] on the screen */
  theme: string;
  setTheme: (t: string) => void;
  /** internal: consumed by CrtScreen */
  _staticKey: number;
  _power: "idle" | "on" | "off";
}

const TvContext = createContext<TvContextValue | null>(null);

export function TvProvider({ children }: { children: ReactNode }) {
  const [volume, setVolumeState] = useState(0.7);
  const [theme, setTheme] = useState("calm");
  const [staticKey, setStaticKey] = useState(0);
  const [power, setPower] = useState<"idle" | "on" | "off">("idle");
  const powerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  // restore persisted volume
  useEffect(() => {
    setVolumeState(getState().volume);
  }, []);

  const setVolume = useCallback((v: number) => {
    const nv = Math.min(1, Math.max(0, v));
    setVolumeState(nv);
    saveState({ volume: nv });
  }, []);

  const volumeStep = useCallback(
    (d: number) => setVolume(volume + d),
    [volume, setVolume],
  );

  const staticBurst = useCallback(() => {
    setStaticKey((k) => k + 1);
    playStaticClick(volume);
  }, [volume]);

  const powerOnThen = useCallback((cb?: () => void) => {
    if (powerTimer.current) clearTimeout(powerTimer.current);
    setPower("on");
    if (cb) setTimeout(cb, 380);
    // static shimmer as the picture settles
    setTimeout(() => {
      setStaticKey((k) => k + 1);
      playStaticClick(volumeRef.current);
    }, 520);
    powerTimer.current = setTimeout(() => setPower("idle"), 950);
  }, []);

  const powerOffThen = useCallback((cb?: () => void) => {
    if (powerTimer.current) clearTimeout(powerTimer.current);
    setPower("off");
    playStaticClick(volumeRef.current);
    powerTimer.current = setTimeout(() => {
      setPower("idle");
      cb?.();
    }, 580);
  }, []);

  // boot: the CRT powers on when the site first loads
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    powerOnThen();
  }, [powerOnThen]);

  return (
    <TvContext.Provider
      value={{
        volume,
        setVolume,
        volumeStep,
        staticBurst,
        powerOnThen,
        powerOffThen,
        theme,
        setTheme,
        _staticKey: staticKey,
        _power: power,
      }}
    >
      {children}
    </TvContext.Provider>
  );
}

export function useTv(): TvContextValue {
  const ctx = useContext(TvContext);
  if (!ctx) throw new Error("useTv must be used inside <TvProvider>");
  return ctx;
}
