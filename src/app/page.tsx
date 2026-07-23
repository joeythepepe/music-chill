"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import HudPanel from "@/components/HudPanel";
import StatusBar from "@/components/StatusBar";
import SegmentedBar from "@/components/SegmentedBar";
import VisualCanvas from "@/components/VisualCanvas";
import Equalizer from "@/components/Equalizer";
import MoodIcon from "@/components/MoodIcon";
import {
  MOODS,
  MOOD_COVERS,
  TRACKS,
  filterTracks,
  formatTime,
  hasCjk,
  moodTheme,
  moodVisual,
  type Mood,
  type Track,
} from "@/lib/tracks";
import { CALLSIGN, getState, saveState, PLAY_MODES, PLAY_MODE_LABEL, PLAY_MODE_TITLE, type PlayMode } from "@/lib/session";
import { useNoiseEngine } from "@/lib/noiseEngine";
import { useTv } from "@/lib/tv";
import {
  enterFullMode,
  leaveFullMode,
  type FullMode,
} from "@/lib/fullscreen";

const SLEEP_OPTIONS = [15, 30, 60];

/**
 * Visual priority:
 *   mood cover video → track.art / mood cover image →
 *   generated mood animation (always — never blank on music tracks)
 *   optional NO SIGNAL badge when the tape file is missing
 */
/** CRT / phosphor stack shared by mood video + still covers */
function PhosphorOverlays() {
  return (
    <>
      {/* theme-tinted phosphor wash */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "var(--color-glow)", mixBlendMode: "color", opacity: 0.42 }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "var(--color-glow)", mixBlendMode: "overlay", opacity: 0.22 }}
        aria-hidden
      />
      {/* fine scanlines */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.35) 0px, rgba(0,0,0,0.35) 1px, transparent 1px, transparent 3px)",
        }}
        aria-hidden
      />
      {/* RGB fringe (cheap chromatic aberration) */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30 mix-blend-screen"
        style={{
          boxShadow:
            "inset 1px 0 0 rgba(255,80,100,0.35), inset -1px 0 0 rgba(80,200,255,0.25)",
        }}
        aria-hidden
      />
      {/* soft vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 75% 75% at 50% 50%, transparent 45%, rgba(0,0,0,0.55) 100%)",
        }}
        aria-hidden
      />
    </>
  );
}

/**
 * Visual priority:
 *   mood cover video (+ CRT CSS stack) → track.art / mood cover image →
 *   generated mood animation
 *   optional NO SIGNAL badge when the tape file is missing
 */
function VisualFeed({
  track,
  mood,
  playing,
  noSignal,
  themeKey,
  /** full-bleed animation for SCR theater (no square mask) */
  coverLayout = false,
}: {
  track: Track;
  mood: string;
  playing: boolean;
  noSignal: boolean;
  themeKey: string;
  coverLayout?: boolean;
}) {
  const cover = MOOD_COVERS[mood];
  const [imgOk, setImgOk] = useState(true);
  const [videoOk, setVideoOk] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => setImgOk(true), [track.id, mood]);
  useEffect(() => setVideoOk(true), [mood, cover?.video]);

  // Prefer the selected mood's visual; fall back to the playing track's kind
  // so CYBERPUNK always gets "drive" even while another track still plays.
  const kind = moodVisual(mood) || track.visual || "wave";

  // Sync mood-loop video with transport (pause when user pauses)
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [playing, cover?.video, videoOk]);

  if (cover?.video && videoOk) {
    return (
      <div className="mood-video relative h-full w-full overflow-hidden bg-black">
        <video
          ref={videoRef}
          src={cover.video}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onError={() => setVideoOk(false)}
          className="pixelated absolute inset-0 h-full w-full object-cover"
          style={{
            // hard pixel look + slight punch for B&W loops under phosphor wash
            filter: "contrast(1.2) brightness(0.92) saturate(0.15)",
          }}
        />
        <PhosphorOverlays />
        {/* slow drifting CRT noise grain */}
        <div className="mood-video-grain pointer-events-none absolute inset-0 opacity-[0.07]" aria-hidden />
        {noSignal && (
          <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center">
            <span className="border border-linehi bg-void/80 px-2 py-1 font-pixel text-[9px] tracking-widest text-ice/90">
              NO SIGNAL
            </span>
          </div>
        )}
      </div>
    );
  }

  const img = track.art ?? cover?.img;
  if (img && imgOk) {
    return (
      <div className="relative h-full w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img}
          alt={track.title}
          onError={() => setImgOk(false)}
          className="pixelated h-full w-full object-cover"
          style={{ filter: "grayscale(0.45) contrast(1.15) brightness(0.85)" }}
        />
        <PhosphorOverlays />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <VisualCanvas
        kind={kind}
        playing={playing}
        themeKey={themeKey}
        layout={coverLayout ? "cover" : "square"}
      />
      {noSignal && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
          <span className="border border-linehi bg-void/80 px-2 py-1 font-pixel text-[9px] tracking-widest text-ice/90">
            NO SIGNAL
          </span>
        </div>
      )}
    </div>
  );
}

export default function MainScreen() {
  const {
    volume,
    setVolume,
    staticBurst,
    theme,
    setTheme,
  } = useTv();

  const [ready, setReady] = useState(false);
  const [mood, setMood] = useState<Mood>(MOODS[0]);
  const [trackId, setTrackId] = useState<string | null>(null);
  const [playMode, setPlayMode] = useState<PlayMode>("sequence");

  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [simulated, setSimulated] = useState(true);

  const [sleepMin, setSleepMin] = useState<number | null>(null);
  const [sleepLeft, setSleepLeft] = useState(0);
  /** none | window (browser FS, normal UI) | screen (movie theater FS) */
  const [fullMode, setFullMode] = useState<FullMode>("none");
  /** SCR dock: pin keeps HUD visible; unpinned auto-hides after idle */
  const [panelPinned, setPanelPinned] = useState(false);
  const [panelVisible, setPanelVisible] = useState(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sleepEndRef = useRef<number | null>(null);
  const fullModeRef = useRef<FullMode>("none");
  const panelPinnedRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playModeRef = useRef<PlayMode>(playMode);
  fullModeRef.current = fullMode;
  panelPinnedRef.current = panelPinned;
  playModeRef.current = playMode;

  // ── restore persisted state ──
  // Track is restored from the full library (not just the mood filter), so empty
    // channels (DAWN / empty moods) or deleted synth ids never leave the player blank.
  useEffect(() => {
    const s = getState();
    let validMood: Mood = (MOODS as readonly string[]).includes(s.mood)
      ? (s.mood as Mood)
      : MOODS[0];

    const fromSave = s.trackId
      ? TRACKS.find((t) => t.id === s.trackId)
      : undefined;
    const fromMood = filterTracks(validMood)[0];
    // Prefer any real library track if both mood and save are empty/stale
    const fallback =
      fromSave ?? fromMood ?? TRACKS[0] ?? null;

    // If the saved mood has zero tracks and we had no valid saved track,
    // park on the first non-empty mood so the UI isn't a dead channel on load.
    if (!fromSave && !fromMood) {
      const withTracks = MOODS.find((m) => filterTracks(m).length > 0);
      if (withTracks) validMood = withTracks;
    }

    setMood(validMood);
    setTheme(moodTheme(validMood));
    setTrackId(fallback?.id ?? null);
    setPlayMode(s.playMode);
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Playlist is mood-filtered; the playing track is global (survives mood changes).
  const queue = useMemo(() => filterTracks(mood), [mood]);
  const track: Track | undefined = useMemo(() => {
    if (trackId) {
      const found = TRACKS.find((t) => t.id === trackId);
      if (found) return found;
    }
    // Hard fallback so the TV + transport never disappear mid-session
    return TRACKS[0];
  }, [trackId]);

  // Heal stale / null trackId (deleted synths, empty mood on reload)
  useEffect(() => {
    if (!ready || !track) return;
    if (track.id !== trackId) {
      setTrackId(track.id);
      saveState({ trackId: track.id });
    }
  }, [ready, track, trackId]);

  /** index in the current mood playlist; -1 if now-playing is from another mood */
  const trackIndex = queue.findIndex((t) => t.id === track?.id);
  // playback behavior is derived from the ACTIVE TRACK
  const isNoise = track?.category === "noise";

  // ── reset clock on every track jump (covers synth ⇄ tape hops) ──
  useEffect(() => {
    if (!track) return;
    setElapsed(0);
    setDuration(track.duration);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId]);

  // ── noise tracks: Web Audio synth engine ──
  useNoiseEngine(isNoise ? (track?.engine ?? null) : null, playing && isNoise, volume);

  // ── music tracks: real <audio> with NO SIGNAL fallback ──
  useEffect(() => {
    if (!ready || !track || track.category !== "music") return;

    setSimulated(true);

    const a = new Audio(track.src);
    a.preload = "auto";
    a.volume = volume;
    audioRef.current = a;

    const onMeta = () => {
      if (Number.isFinite(a.duration)) setDuration(a.duration);
      setSimulated(false);
      if (playing) a.play().catch(() => setSimulated(true));
    };
    const onError = () => setSimulated(true);
    const onTime = () => {
      if (!Number.isNaN(a.currentTime)) setElapsed(a.currentTime);
    };
    const onEnded = () => {
      advanceTrack(true);
    };

    a.loop = playModeRef.current === "loop";
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("error", onError);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnded);

    if (playing) a.play().catch(() => setSimulated(true));

    return () => {
      a.pause();
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("error", onError);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnded);
      a.src = "";
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, trackId]);

  // play/pause the element — audioRef existing implies a music track is loaded
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.play().catch(() => setSimulated(true));
    } else {
      a.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, trackId]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // ── simulated progress ticker (noise always; music when tape missing) ──
  useEffect(() => {
    const isSim = isNoise || simulated;
    if (!playing || !isSim || !track) return;
    const t = setInterval(() => {
      setElapsed((e) => {
        const next = e + 0.5;
        if (next >= duration) {
          if (isNoise) return 0; // endless ambience loops
          setTimeout(() => advanceTrack(true), 0);
          return 0;
        }
        return next;
      });
    }, 500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, simulated, isNoise, trackId, duration]);

  // ── sleep timer ──
  useEffect(() => {
    if (sleepMin == null) return;
    const t = setInterval(() => {
      const left = Math.max(
        0,
        Math.round(((sleepEndRef.current ?? 0) - Date.now()) / 1000),
      );
      setSleepLeft(left);
      if (left <= 0) {
        setPlaying(false);
        setSleepMin(null);
        sleepEndRef.current = null;
      }
    }, 1000);
    return () => clearInterval(t);
  }, [sleepMin]);

  const selectTrack = useCallback(
    (idx: number, autoplay = false) => {
      const t = queue[idx];
      if (!t) return;
      const same = t.id === trackId;
      setTrackId(t.id);
      setElapsed(0);
      if (autoplay) setPlaying(true);
      saveState({ trackId: t.id });

      // Same trackId does not remount <audio> — restart in place so
      // re-select / one-song auto-advance / double-click all work.
      if (same) {
        const a = audioRef.current;
        if (a) {
          a.currentTime = 0;
          if (autoplay) void a.play().catch(() => setSimulated(true));
        }
      }
    },
    [queue, trackId],
  );

  /** pick next index for auto-advance (respects play mode) */
  const advanceTrack = useCallback(
    (autoplay = true) => {
      if (queue.length === 0) return;
      const mode = playModeRef.current;
      const idx = queue.findIndex((t) => t.id === trackId);

      if (mode === "loop") {
        // restart current; if not in this mood list, land on first
        if (idx < 0) {
          selectTrack(0, autoplay);
          return;
        }
        const a = audioRef.current;
        if (a) {
          a.currentTime = 0;
          if (autoplay) void a.play().catch(() => setSimulated(true));
        }
        setElapsed(0);
        if (autoplay) setPlaying(true);
        return;
      }

      if (mode === "random") {
        if (queue.length === 1) {
          selectTrack(0, autoplay);
          return;
        }
        let next = Math.floor(Math.random() * queue.length);
        while (next === idx) next = Math.floor(Math.random() * queue.length);
        selectTrack(next, autoplay);
        return;
      }

      // sequence
      const next = idx >= 0 ? (idx + 1) % queue.length : 0;
      selectTrack(next, autoplay);
    },
    [queue, trackId, selectTrack],
  );

  const stepTrack = useCallback(
    (d: 1 | -1) => {
      if (queue.length === 0) return;
      staticBurst();
      // Manual prev/next: random mode shuffles forward; otherwise sequential.
      // One-loop still allows skipping via transport.
      if (d === 1 && playModeRef.current === "random" && queue.length > 1) {
        let next = Math.floor(Math.random() * queue.length);
        while (next === trackIndex) next = Math.floor(Math.random() * queue.length);
        selectTrack(next, true);
        return;
      }
      const idx = trackIndex >= 0 ? trackIndex : d === 1 ? -1 : 0;
      selectTrack((idx + d + queue.length) % queue.length, true);
    },
    [queue.length, trackIndex, selectTrack, staticBurst],
  );

  const cyclePlayMode = useCallback(() => {
    setPlayMode((m) => {
      const i = PLAY_MODES.indexOf(m);
      const next = PLAY_MODES[(i + 1) % PLAY_MODES.length];
      saveState({ playMode: next });
      return next;
    });
  }, []);

  // keep <audio>.loop in sync when mode toggles mid-track
  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = playMode === "loop";
  }, [playMode]);

  const togglePlay = useCallback(() => {
    if (track) setPlaying((p) => !p);
  }, [track]);

  // ── SCR control panel: pin = always on; unpinned = hide after 20s idle ──
  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current != null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const bumpTheaterPanel = useCallback(() => {
    setPanelVisible(true);
    clearIdleTimer();
    if (panelPinnedRef.current || fullModeRef.current !== "screen") return;
    idleTimerRef.current = setTimeout(() => {
      if (!panelPinnedRef.current && fullModeRef.current === "screen") {
        setPanelVisible(false);
      }
    }, 20_000);
  }, [clearIdleTimer]);

  useEffect(() => {
    if (fullMode !== "screen") {
      clearIdleTimer();
      setPanelVisible(true);
      return;
    }
    // enter SCR or pin toggle — show panel and (re)arm idle timer
    bumpTheaterPanel();
    return () => clearIdleTimer();
  }, [fullMode, panelPinned, bumpTheaterPanel, clearIdleTimer]);

  // ── full modes: Window (browser FS) · Screen (movie theater) · Esc exits ──
  const exitFull = useCallback(async () => {
    setFullMode("none");
    clearIdleTimer();
    await leaveFullMode();
  }, [clearIdleTimer]);

  const enterFull = useCallback(
    async (mode: "window" | "screen") => {
      if (fullModeRef.current === mode) {
        await exitFull();
        return;
      }
      setFullMode(mode);
      await enterFullMode(mode);
    },
    [exitFull],
  );

  // browser chrome / system Esc may drop native FS without our key handler
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement && fullModeRef.current !== "none") {
        setFullMode("none");
        delete document.documentElement.dataset.full;
        try {
          screen.orientation?.unlock?.();
        } catch {
          /* ignore */
        }
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange as EventListener);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        onFsChange as EventListener,
      );
    };
  }, []);

  // keep data-full in sync (CSS landscape force) + cleanup on unmount
  useEffect(() => {
    if (fullMode === "none") delete document.documentElement.dataset.full;
    else document.documentElement.dataset.full = fullMode;
    return () => {
      delete document.documentElement.dataset.full;
    };
  }, [fullMode]);

  // Space = play/pause · Esc = exit either full mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "Escape" && fullModeRef.current !== "none") {
        e.preventDefault();
        void exitFull();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, exitFull]);

  // ── mood filter: retheme + filter playlist only — do NOT stop/change track ──
  const pickMood = useCallback(
    (m: Mood) => {
      if (m === mood) return;
      staticBurst();
      setMood(m);
      setTheme(moodTheme(m));
      // Keep trackId + playing state; user must pick a track to switch audio.
      saveState({ mood: m });
    },
    [mood, staticBurst, setTheme],
  );

  const seek = (ratio: number) => {
    const sec = ratio * duration;
    setElapsed(sec);
    const a = audioRef.current;
    if (a && !simulated) a.currentTime = sec; // element ⇒ music track
  };

  const pickSleep = (min: number | null) => {
    setSleepMin(min);
    if (min == null) {
      sleepEndRef.current = null;
      setSleepLeft(0);
    } else {
      sleepEndRef.current = Date.now() + min * 60_000;
      setSleepLeft(min * 60);
    }
  };

  if (!ready) {
    return (
      <main className="flex min-h-full flex-col">
        <StatusBar callsign={CALLSIGN} />
        <div className="flex flex-1 items-center justify-center">
          <p className="hud-label">
            TUNING <span className="animate-blink text-glow">▮</span>
          </p>
        </div>
      </main>
    );
  }

  const noSignal = track?.category === "music" && simulated;
  const sourceTag = isNoise ? "SYNTH ENGINE" : noSignal ? "NO SIGNAL" : "LIVE TAPE";

  const moodChips = (highContrast = false) => (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
      {MOODS.map((m) => (
        <button
          key={m}
          onClick={() => pickMood(m)}
          className={`flex items-center justify-center gap-1.5 border px-1 py-2 font-pixel text-[10px] tracking-wider transition-colors duration-150 focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-glow sm:text-[11px] ${
            mood === m
              ? "border-glow bg-glow text-void"
              : highContrast
                ? "border-linehi/80 bg-panel2/90 text-ice hover:border-glow hover:bg-panel hover:text-fg"
                : "border-line text-ice hover:border-linehi hover:bg-panel2"
          }`}
        >
          <MoodIcon mood={m} />
          <span className="truncate">{m}</span>
        </button>
      ))}
    </div>
  );

  return (
    <main className="relative flex min-h-full flex-col pt-5 sm:h-full sm:pt-6">
      <StatusBar
        callsign={CALLSIGN}
        tags={[
          mood,
          ...(fullMode === "window"
            ? ["WIN FULL"]
            : fullMode === "screen"
              ? ["SCR FULL"]
              : []),
        ]}
      />

      {/* below the status bar: stacked on phones, two columns on ≥sm,
          row vertically centered (slack = clean overscan margin) */}
      <div className="term-in flex flex-1 flex-col px-4 py-4 sm:min-h-0 sm:justify-center sm:px-5">
      <div className="flex flex-col gap-4 sm:relative sm:flex-row sm:gap-5">
        {/* ── LEFT: TV area (square ≈54% of interior width, defines row height) ── */}
        {track && (
          <div className="sm:w-[54%] sm:shrink-0">
            <HudPanel active className="w-full overflow-hidden">
              <div className="relative aspect-square w-full bg-panel2">
                <VisualFeed
                  track={track}
                  mood={mood}
                  playing={playing}
                  noSignal={noSignal}
                  themeKey={theme}
                />
                <span className="font-pixel glow-text absolute bottom-2 left-3 text-xs tracking-widest text-ice/90">
                  {formatTime(elapsed)}
                </span>
                <span className="hud-label absolute top-2 left-3 text-[8px]">
                  ▪ {noSignal ? "CH.-- NO SIGNAL" : `VIS.FEED // ${mood}`}
                </span>
                <span className="absolute top-2 right-3">
                  <Equalizer playing={playing} />
                </span>
                <div className="absolute right-2 bottom-2 flex gap-1">
                  <button
                    onClick={() => void enterFull("window")}
                    className={`btn-hud bg-void/60 px-2 py-1 text-[9px] ${
                      fullMode === "window" ? "btn-hud-on" : ""
                    }`}
                    aria-label="window full screen"
                    aria-pressed={fullMode === "window"}
                    title="Window Full — fill the browser window (Esc to exit)"
                  >
                    ⛶ WIN
                  </button>
                  <button
                    onClick={() => void enterFull("screen")}
                    className={`btn-hud bg-void/60 px-2 py-1 text-[9px] ${
                      fullMode === "screen" ? "btn-hud-on" : ""
                    }`}
                    aria-label="screen full — movie mode"
                    aria-pressed={fullMode === "screen"}
                    title="Screen Full — movie theater mode (Esc to exit)"
                  >
                    ⛶ SCR
                  </button>
                </div>
              </div>
            </HudPanel>
          </div>
        )}

        {/* ── RIGHT: control area — taken OUT of the row's height computation
               (absolute, inset-y-0) so its definite height = the square side.
               Playlist flex-1 min-h-0 scrolls internally; top/bottom flush. ── */}
        <div className="thin-scroll flex flex-col gap-4 sm:absolute sm:inset-y-0 sm:right-0 sm:w-[calc(46%-1.25rem)] sm:min-h-0 sm:overflow-y-auto sm:pr-1">
        {/* ── MOOD SELECT ── */}
        <section>
          <p className="hud-label mb-2 text-[9px]">
            ▪ MOOD SELECT <span className="animate-blink text-glow">▮</span>
          </p>
          {moodChips()}
        </section>

        {/* ── PLAYLIST ── */}
        <section className="min-h-0 sm:flex sm:flex-1 sm:flex-col">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="hud-label min-w-0 truncate text-[9px]">
              ▪ PLAYLIST // {queue.length} CH ·{" "}
              <span className="text-ice/70">DBL-CLICK = PLAY · SPACE = PLAY/PAUSE</span>
            </p>
            <button
              type="button"
              onClick={cyclePlayMode}
              className="btn-hud shrink-0 px-2 py-1 text-[9px] tracking-widest"
              aria-label={`Play mode: ${PLAY_MODE_TITLE[playMode]}. Click to cycle.`}
              title={`${PLAY_MODE_TITLE[playMode]} — click to cycle`}
            >
              {PLAY_MODE_LABEL[playMode]}
            </button>
          </div>
          {queue.length === 0 ? (
            <div className="border border-line bg-panel/60 px-3 py-6 text-center">
              <p className="font-pixel text-[10px] tracking-widest text-dim">
                NO BROADCAST ON THIS CHANNEL <span className="animate-blink">▮</span>
              </p>
            </div>
          ) : (
            <ul className="queue-scroll max-h-44 overflow-y-auto border border-line bg-panel/60 sm:max-h-none sm:flex-1">
              {queue.map((t, i) => {
                const activeTrack = t.id === trackId;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      title="Double-click to play"
                      onDoubleClick={() => {
                        staticBurst();
                        selectTrack(i, true);
                      }}
                      className={`flex w-full items-center gap-3 border-b border-line/50 px-3 py-2.5 text-left transition-colors last:border-b-0 ${
                        activeTrack ? "bg-panel2" : "hover:bg-panel2/60"
                      }`}
                    >
                      <span
                        className={`font-pixel w-7 shrink-0 text-[10px] tracking-widest ${
                          activeTrack ? "text-glow" : "text-dim"
                        }`}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block truncate text-[11px] ${
                            hasCjk(t.title) ? "tracking-normal" : "tracking-widest"
                          } ${activeTrack ? "text-ice" : "text-fg/80"}`}
                        >
                          {activeTrack && playing ? "▮ " : ""}
                          {t.title}
                        </span>
                        <span className="hud-label block truncate text-[8px]">
                          {t.artist} · {t.category === "noise" ? "SYNTH" : "TAPE"}
                        </span>
                      </span>
                      {activeTrack && <Equalizer playing={playing} bars={4} />}
                      <span className="font-pixel shrink-0 text-[9px] tracking-widest text-dim">
                        {t.category === "noise" ? "LOOP" : formatTime(t.duration)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ── PLAY CONTROLS ── */}
        {track && (
          <section className="flex flex-col gap-3">
            {/* track info */}
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="hud-label text-[9px]">
                  ▮ NOW PLAYING <span className="text-ice/70">// {sourceTag}</span>
                </p>
                <h1
                  className={`font-pixel glow-text mt-1 truncate text-base font-bold text-ice ${
                    hasCjk(track.title) ? "tracking-normal" : "tracking-wider"
                  }`}
                >
                  {track.title}
                </h1>
                <p className="hud-label mt-0.5 truncate">{track.artist}</p>
              </div>
              <span className="hud-label shrink-0 border border-line px-2 py-1 text-ice/80">
                {track.mood}
              </span>
            </div>

            {/* segmented seek */}
            <div>
              <SegmentedBar
                ratio={duration > 0 ? elapsed / duration : 0}
                segments={56}
                height={14}
                onChange={seek}
                label="seek"
              />
              <div className="mt-1 flex justify-between">
                <span className="font-pixel text-[10px] tracking-widest text-dim">
                  {formatTime(elapsed)}
                </span>
                <span className="font-pixel text-[10px] tracking-widest text-dim">
                  -{isNoise ? "--:--" : formatTime(Math.max(0, duration - elapsed))}
                </span>
              </div>
            </div>

            {/* transport */}
            <div className="grid grid-cols-[1fr_1.6fr_1fr] items-stretch gap-2">
              <button
                onClick={() => stepTrack(-1)}
                className="btn-hud py-2.5 text-xs"
                aria-label="previous track"
              >
                ◂◂ PREV
              </button>
              <button
                onClick={togglePlay}
                className={`btn-hud py-2.5 text-sm ${playing ? "btn-hud-on" : ""}`}
                aria-label={playing ? "pause" : "play"}
              >
                {playing ? "▮▮ PAUSE" : "◂ PLAY ▸"}
              </button>
              <button
                onClick={() => stepTrack(1)}
                className="btn-hud py-2.5 text-xs"
                aria-label="next track"
              >
                NEXT ▸▸
              </button>
            </div>

            {/* volume + sleep */}
            <div className="grid grid-cols-2 gap-4 pb-1">
              <div>
                <p className="hud-label mb-2 text-[9px]">
                  ▪ VOL <span className="text-ice">{Math.round(volume * 100)}%</span>
                </p>
                <SegmentedBar
                  ratio={volume}
                  segments={20}
                  height={12}
                  onChange={(r) => setVolume(r)}
                  label="volume"
                />
              </div>
              <div>
                <p className="hud-label mb-2 text-[9px]">
                  ▪ SLEEP{" "}
                  <span className="text-ice">
                    {sleepMin != null ? formatTime(sleepLeft) : "OFF"}
                  </span>
                </p>
                <div className="flex gap-1.5">
                  {SLEEP_OPTIONS.map((m) => (
                    <button
                      key={m}
                      onClick={() => pickSleep(sleepMin === m ? null : m)}
                      className={`flex-1 border px-1 py-1 font-pixel text-[9px] tracking-widest transition-colors ${
                        sleepMin === m
                          ? "border-glow bg-glow text-void"
                          : "border-line text-dim hover:border-linehi hover:text-ice"
                      }`}
                    >
                      {m}M
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}
        </div>
      </div>
      </div>

      {/* ── WINDOW FULL exit chip (normal UI stays; only FS chrome gone) ── */}
      {fullMode === "window" && (
        <button
          onClick={() => void exitFull()}
          className="btn-hud fixed top-3 right-3 z-40 bg-void/80 px-3 py-2 text-[10px] backdrop-blur-sm"
          aria-label="exit window full"
          title="Exit window full (Esc)"
        >
          ✕ EXIT · ESC
        </button>
      )}

      {/* ── SCREEN FULL — portal to <body> so it escapes the 4:3 CRT box
          and truly spans the full window (incl. ultrawide). ── */}
      {fullMode === "screen" &&
        track &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="theater-stage"
            data-theme={theme}
            role="dialog"
            aria-label="screen full theater"
            onPointerMove={bumpTheaterPanel}
            onPointerDown={bumpTheaterPanel}
            onTouchStart={bumpTheaterPanel}
            onKeyDown={bumpTheaterPanel}
          >
            {/* full-bleed mood visual — 100vw × 100dvh, any aspect */}
            <div className="theater-visual">
              <VisualFeed
                track={track}
                mood={mood}
                playing={playing}
                noSignal={noSignal}
                themeKey={theme}
                coverLayout
              />
            </div>
            {/* SCR CRT flicker stack — brightness pulse, flash, rolling band */}
            <div className="theater-flicker" aria-hidden />
            <div className="theater-flash" aria-hidden />
            <div className="theater-band-wrap" aria-hidden>
              <div className="theater-band" />
            </div>
            <div className="crt-layer ovl-scanlines opacity-30" aria-hidden />
            <div className="crt-layer theater-edge-fade" aria-hidden />

            {/* invisible bottom hit strip — easy reveal when dock is auto-hidden */}
            {!panelVisible && !panelPinned && (
              <button
                type="button"
                className="absolute inset-x-0 bottom-0 z-20 h-16 cursor-default bg-transparent"
                aria-label="show controls"
                onPointerDown={bumpTheaterPanel}
              />
            )}

            <div
              className={`absolute inset-x-0 bottom-[10%] z-10 flex justify-center px-3 transition-all duration-500 sm:bottom-[12%] ${
                panelVisible || panelPinned
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none translate-y-3 opacity-0"
              }`}
            >
              <div
                className="theater-dock flex w-full max-w-3xl flex-col gap-3 border border-linehi p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_12px_40px_rgba(0,0,0,0.75)]"
                style={{ background: "color-mix(in srgb, var(--color-void) 94%, black)" }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-plex text-[9px] tracking-[0.2em] text-ice/80 uppercase">
                      ▮ {sourceTag} · {mood} · SCR FULL
                    </p>
                    <p
                      className={`font-pixel glow-text truncate text-base font-bold text-ice sm:text-lg ${
                        hasCjk(track.title) ? "tracking-normal" : "tracking-wider"
                      }`}
                    >
                      {track.title}
                    </p>
                    <p className="font-plex truncate text-[11px] tracking-widest text-fg/80 uppercase">
                      {track.artist}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setPanelPinned((p) => !p);
                        setPanelVisible(true);
                      }}
                      className={`btn-hud border-linehi px-3 py-2 text-[10px] ${
                        panelPinned ? "btn-hud-on" : "bg-panel2 text-ice"
                      }`}
                      aria-label={panelPinned ? "unpin control panel" : "pin control panel"}
                      aria-pressed={panelPinned}
                      title={
                        panelPinned
                          ? "Pinned — panel stays on screen"
                          : "Unpinned — hides after 20s idle"
                      }
                    >
                      {panelPinned ? "▣ PIN" : "▢ PIN"}
                    </button>
                    <button
                      onClick={() => void exitFull()}
                      className="btn-hud border-linehi bg-panel2 px-3 py-2 text-[10px] text-ice"
                      aria-label="exit screen full"
                    >
                      ✕ EXIT · ESC
                    </button>
                  </div>
                </div>

                <div>
                  <SegmentedBar
                    ratio={duration > 0 ? elapsed / duration : 0}
                    segments={72}
                    height={12}
                    onChange={seek}
                    label="seek"
                    bright
                  />
                  <div className="mt-1 flex justify-between">
                    <span className="font-pixel text-[11px] tracking-widest text-ice/90">
                      {formatTime(elapsed)}
                    </span>
                    <span className="font-pixel text-[11px] tracking-widest text-ice/70">
                      -{isNoise ? "--:--" : formatTime(Math.max(0, duration - elapsed))}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-[auto_auto_auto_1fr_auto] items-center gap-3">
                  <button
                    onClick={() => stepTrack(-1)}
                    className="btn-hud border-linehi bg-panel2 px-3 py-2 text-xs text-ice"
                    aria-label="previous track"
                  >
                    ◂◂
                  </button>
                  <button
                    onClick={togglePlay}
                    className={`btn-hud px-5 py-2 text-xs ${
                      playing ? "btn-hud-on" : "border-linehi bg-panel2 text-ice"
                    }`}
                    aria-label={playing ? "pause" : "play"}
                  >
                    {playing ? "▮▮" : "▶"}
                  </button>
                  <button
                    onClick={() => stepTrack(1)}
                    className="btn-hud border-linehi bg-panel2 px-3 py-2 text-xs text-ice"
                    aria-label="next track"
                  >
                    ▸▸
                  </button>
                  <SegmentedBar
                    ratio={volume}
                    segments={24}
                    height={12}
                    onChange={(r) => setVolume(r)}
                    label="volume"
                    bright
                  />
                  <div className="flex gap-1">
                    {SLEEP_OPTIONS.map((m) => (
                      <button
                        key={m}
                        onClick={() => pickSleep(sleepMin === m ? null : m)}
                        className={`border px-1.5 py-1.5 font-pixel text-[9px] tracking-widest transition-colors ${
                          sleepMin === m
                            ? "border-glow bg-glow text-void"
                            : "border-linehi bg-panel2 text-ice hover:border-glow hover:text-fg"
                        }`}
                      >
                        {m}M
                      </button>
                    ))}
                  </div>
                </div>

                {moodChips(true)}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </main>
  );
}
