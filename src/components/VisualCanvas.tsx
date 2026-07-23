"use client";

import { useEffect, useRef } from "react";
import type { VisualKind } from "@/lib/tracks";

/**
 * Low-res animated canvas upscaled with image-rendering: pixelated.
 * Kinds: pixel rain | starfield | waveform | drive lines | dawn sunrise sea.
 *
 * `layout="square"` — 1:1 buffer for the TV panel.
 * `layout="cover"`  — full-bleed; buffer tracks real viewport aspect
 *                     (ultrawide / 16:9 / portrait all fill left–right).
 */
export default function VisualCanvas({
  kind,
  playing,
  themeKey = "ice",
  layout = "square",
}: {
  kind: VisualKind;
  playing: boolean;
  themeKey?: string;
  layout?: "square" | "cover";
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const kindRef = useRef(kind);
  const playingRef = useRef(playing);
  const colorsRef = useRef({ glow: "#67e8f9", ice: "#a5e8ff", line: "#16233a" });
  kindRef.current = kind;
  playingRef.current = playing;

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    const get = (name: string, fb: string) =>
      cs.getPropertyValue(name).trim() || fb;
    colorsRef.current = {
      glow: get("--color-glow", colorsRef.current.glow),
      ice: get("--color-ice", colorsRef.current.ice),
      line: get("--color-linehi", colorsRef.current.line),
    };
  }, [themeKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rgba = (hex: string, a: number) => {
      const h = hex.replace("#", "");
      const v =
        h.length === 3
          ? h
              .split("")
              .map((c) => c + c)
              .join("")
          : h;
      const n = parseInt(v, 16);
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    };

    const SPEED = 0.4;

    let W = 112;
    let H = 112;

    type Drop = { x: number; y: number; v: number; len: number };
    type Star = { x: number; y: number; p: number; s: number };
    type Line = { y: number; x: number; len: number; v: number };
    type DawnStar = { x: number; y: number; tw: number };

    let drops: Drop[] = [];
    let stars: Star[] = [];
    let lines: Line[] = [];
    let dawnStars: DawnStar[] = [];
    let wavePhase = 0;
    let riseFrame = 0;
    let stepAccum = 0;
    // ~4 fps — slow bit-pixel TV feel
    const DAWN_FRAME_MS = 250;

    const seedParticles = () => {
      const area = W * H;
      const base = 112 * 112;
      const dropN = Math.round(90 * (area / base));
      const starN = Math.round(140 * (area / base));
      // denser drive streaks so CYBERPUNK reads clearly even on small square TV
      const lineN = Math.round(48 * (area / base));
      const dawnN = Math.round(28 * (area / base));

      drops = Array.from({ length: Math.max(48, dropN) }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        v: (0.35 + Math.random() * 0.9) * SPEED,
        len: 2 + Math.random() * 4,
      }));
      stars = Array.from({ length: Math.max(80, starN) }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        p: Math.random() * Math.PI * 2,
        s: 0.2 + Math.random() * 0.8,
      }));
      lines = Array.from({ length: Math.max(36, lineN) }, () => ({
        y: Math.random() * H,
        x: Math.random() * W,
        len: 10 + Math.random() * 28,
        v: (1.4 + Math.random() * 2.2) * SPEED,
      }));
      dawnStars = Array.from({ length: Math.max(18, dawnN) }, () => ({
        x: Math.random() * W,
        y: Math.random() * H * 0.38,
        tw: Math.random() * Math.PI * 2,
      }));
      wavePhase = 0;
      riseFrame = 0;
      stepAccum = 0;
    };

    /** Fixed dawn palette (reference: bit-pixel sun raise over sea). */
    const DAWN = {
      skyTop: "#1e2858",
      skyMid: "#6b3d78",
      skyMag: "#a8486e",
      skyOrange: "#e87840",
      skyPeach: "#f0a868",
      cloudDark: "#3a2a5a",
      cloudLite: "#c07068",
      sunLow: "#e84838",
      sunMid: "#f0a030",
      sunHigh: "#ffe45a",
      waterDeep: "#1a3a5c",
      waterMid: "#2a5880",
      waterLite: "#3a7898",
      foam: "#78c0c0",
      foamHi: "#c8e8e0",
      reflect: "#f0b050",
    };

    const lerpHex = (a: string, b: string, t: number) => {
      const parse = (h: string) => {
        const v = h.replace("#", "");
        const n = parseInt(v, 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
      };
      const [ar, ag, ab] = parse(a);
      const [br, bg, bb] = parse(b);
      const u = Math.max(0, Math.min(1, t));
      const r = Math.round(ar + (br - ar) * u);
      const g = Math.round(ag + (bg - ag) * u);
      const bl = Math.round(ab + (bb - ab) * u);
      return `rgb(${r},${g},${bl})`;
    };

    const drawSunrise = (frame: number, playing: boolean) => {
      const horizon = Math.floor(H * 0.52);
      // sun climbs once (~3 min at 4fps), then holds; only waves keep moving
      const RISE_FRAMES = 720;
      const skyFrame = Math.min(frame, RISE_FRAMES);
      const progress = skyFrame / RISE_FRAMES;
      // ease: linger low, then climb
      const rise = progress < 0.15
        ? progress / 0.15 * 0.12
        : 0.12 + ((progress - 0.15) / 0.85) * 0.88;

      const sunR = Math.max(8, Math.floor(Math.min(W, H) * 0.14));
      const sunCx = Math.floor(W * 0.5);
      // rise 0 → peeking; 1 → held at top, fully clear of the horizon
      const sunCy = Math.floor(horizon - sunR * (rise * 1.85 - 0.45));

      // ── sky bands ──
      const theme = colorsRef.current;
      const bands = [
        { y0: 0, y1: 0.18, c: DAWN.skyTop },
        { y0: 0.18, y1: 0.32, c: lerpHex(DAWN.skyTop, DAWN.skyMid, 0.55 + rise * 0.3) },
        { y0: 0.32, y1: 0.42, c: lerpHex(DAWN.skyMid, DAWN.skyMag, 0.4 + rise * 0.4) },
        { y0: 0.42, y1: 0.48, c: lerpHex(DAWN.skyMag, DAWN.skyOrange, 0.5 + rise * 0.35) },
        // horizon band — DAWN theme amber (glow → ice)
        { y0: 0.48, y1: 0.52, c: lerpHex(theme.glow, theme.ice, 0.25 + rise * 0.55) },
      ];
      for (const b of bands) {
        ctx.fillStyle = b.c;
        const y0 = Math.floor(H * b.y0);
        const y1 = Math.floor(H * b.y1);
        ctx.fillRect(0, y0, W, Math.max(1, y1 - y0));
      }

      // thin cloud streaks — keep drifting slowly right after sun parks
      ctx.fillStyle = DAWN.cloudDark;
      for (let i = 0; i < 5; i++) {
        const cy = Math.floor(H * (0.08 + i * 0.07));
        const drift = frame * 0.04;
        const cx = Math.floor(((i * 37 + drift) % (W + 40)) - 20);
        ctx.fillRect(cx, cy, 18 + (i % 3) * 6, 1);
        ctx.fillRect(cx + 4, cy + 1, 10 + (i % 2) * 4, 1);
      }
      ctx.fillStyle = DAWN.cloudLite;
      ctx.globalAlpha = 0.35 + rise * 0.25;
      for (let i = 0; i < 3; i++) {
        const cy = Math.floor(H * (0.36 + i * 0.04));
        const cx = Math.floor((W * 0.1 + i * 40 + frame * 0.05) % W);
        ctx.fillRect(cx, cy, 22, 1);
      }
      ctx.globalAlpha = 1;

      // stars fade as sun rises (gone once parked)
      const starA = Math.max(0, 1 - rise * 1.4);
      if (starA > 0.05) {
        for (const s of dawnStars) {
          const tw = 0.4 + 0.6 * Math.abs(Math.sin(skyFrame * 0.02 + s.tw));
          ctx.fillStyle = rgba("#e8f0ff", starA * tw);
          ctx.fillRect(Math.floor(s.x), Math.floor(s.y), 1, 1);
        }
      }

      // ── sun (disk clipped by horizon; frozen after rise) ──
      const sunCol = rise < 0.35
        ? lerpHex(DAWN.sunLow, DAWN.sunMid, rise / 0.35)
        : lerpHex(DAWN.sunMid, DAWN.sunHigh, (rise - 0.35) / 0.65);
      ctx.fillStyle = sunCol;
      const r2 = sunR * sunR;
      for (let py = -sunR; py <= sunR; py++) {
        const yy = sunCy + py;
        if (yy >= horizon) continue;
        if (yy < 0) continue;
        for (let px = -sunR; px <= sunR; px++) {
          if (px * px + py * py <= r2) {
            const xx = sunCx + px;
            if (xx >= 0 && xx < W) ctx.fillRect(xx, yy, 1, 1);
          }
        }
      }
      // atmospheric bands across lower sun
      if (rise < 0.55) {
        ctx.fillStyle = rgba(DAWN.skyOrange, 0.55);
        for (let i = 0; i < 3; i++) {
          const by = horizon - 2 - i * 2;
          if (by > sunCy - sunR && by < horizon) {
            ctx.fillRect(sunCx - sunR + 2, by, sunR * 2 - 4, 1);
          }
        }
      }

      // ── sea (keeps moving forever) ──
      ctx.fillStyle = DAWN.waterDeep;
      ctx.fillRect(0, horizon, W, H - horizon);

      // scroll advances ~1px every few frames
      const scrollBase = Math.floor(frame / 6);
      const scroll = playing ? scrollBase : Math.floor(scrollBase * 0.4);
      const seaH = H - horizon;
      for (let row = 0; row < seaH; row++) {
        const y = horizon + row;
        const depth = row / Math.max(1, seaH);
        const speed = 0.08 + depth * 0.25;
        const ox = Math.floor(scroll * speed + wavePhase * 0.15 * (0.5 + depth));

        // base tint bands
        if (row % 5 === 0) {
          ctx.fillStyle =
            depth < 0.3 ? DAWN.waterLite : depth < 0.6 ? DAWN.waterMid : DAWN.waterDeep;
          ctx.fillRect(0, y, W, 1);
        }

        // rolling ^ wave crests — denser near horizon, sparse in foreground
        const rowGap = 3 + Math.floor(depth * 5);
        if (row % rowGap === Math.floor(scroll / 4) % rowGap) {
          ctx.fillStyle = depth < 0.35 ? DAWN.foamHi : DAWN.foam;
          const step = 5 + Math.floor(depth * 6);
          const phase = (ox + row * 3) % step;
          for (let x = -phase; x < W; x += step) {
            const px = x;
            if (px < 0 || px >= W) continue;
            ctx.fillRect(px, y, 1, 1);
            if (px + 1 < W) ctx.fillRect(px + 1, y - 1, 1, 1);
            if (px + 2 < W) ctx.fillRect(px + 2, y, 1, 1);
          }
        }

        // occasional longer swell lines
        if (row % 7 === 2 && depth > 0.15 && depth < 0.85) {
          ctx.fillStyle = rgba(DAWN.foam, 0.45);
          const wx = ((ox + row * 11) % (W + 30)) - 10;
          ctx.fillRect(wx, y, 8 + (row % 5), 1);
        }
      }

      // sun reflection — gentle shimmer with the waves only
      const reflW = Math.max(4, Math.floor(sunR * 0.7));
      for (let row = 0; row < H - horizon; row++) {
        if ((row + Math.floor(scroll / 2)) % 3 === 0) continue;
        const y = horizon + row;
        const taper = 1 - row / Math.max(1, H - horizon);
        const hw = Math.max(1, Math.floor(reflW * taper * taper * 1.2));
        const jitter = ((row * 7 + Math.floor(scroll / 3)) % 5) - 2;
        ctx.fillStyle = rgba(
          rise < 0.4 ? DAWN.sunLow : DAWN.reflect,
          0.25 + taper * 0.55,
        );
        ctx.fillRect(sunCx - hw + jitter, y, hw * 2, 1);
      }
    };

    const applySize = (bw: number, bh: number) => {
      const nextW = Math.max(64, Math.round(bw));
      const nextH = Math.max(48, Math.round(bh));
      if (nextW === canvas.width && nextH === canvas.height) {
        W = nextW;
        H = nextH;
        return;
      }
      W = nextW;
      H = nextH;
      canvas.width = W;
      canvas.height = H;
      seedParticles();
    };

    /** Cover mode: size buffer from the real viewport (or host box), keeping aspect. */
    const measureCover = () => {
      const parent = canvas.parentElement;
      const pr = parent?.getBoundingClientRect();
      // Prefer host box; fall back to window so we never stick to a square
      const cssW = Math.max(
        pr?.width ?? 0,
        typeof window !== "undefined" ? window.innerWidth : 0,
        1,
      );
      const cssH = Math.max(
        pr?.height ?? 0,
        typeof window !== "undefined" ? window.innerHeight : 0,
        1,
      );
      // Long edge ~280px of buffer → chunky pixels on any aspect (21:9, 16:9, …)
      const long = Math.max(cssW, cssH);
      const scale = 280 / long;
      applySize(cssW * scale, cssH * scale);
    };

    if (layout === "square") {
      applySize(112, 112);
    } else {
      measureCover();
    }

    let raf = 0;
    let t = 0;
    let last = performance.now();
    let ro: ResizeObserver | null = null;
    let lastKind: VisualKind | null = null;

    const onWinResize = () => {
      if (layout === "cover") measureCover();
    };

    if (layout === "cover") {
      window.addEventListener("resize", onWinResize);
      if (typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(() => measureCover());
        if (canvas.parentElement) ro.observe(canvas.parentElement);
        else ro.observe(canvas);
      }
      // re-measure after layout (portal / fullscreen settle)
      requestAnimationFrame(measureCover);
      setTimeout(measureCover, 50);
    }

    const draw = (nowMs: number) => {
      const dt = Math.min(50, nowMs - last);
      last = nowMs;
      t += dt * SPEED * (playingRef.current ? 1 : 0.3);

      const C = colorsRef.current;
      const k = kindRef.current;

      if (k === "sunrise") {
        stepAccum += dt * (playingRef.current ? 1 : 0.35);
        let stepped = false;
        while (stepAccum >= DAWN_FRAME_MS) {
          stepAccum -= DAWN_FRAME_MS;
          riseFrame++;
          if (riseFrame % 3 === 0) wavePhase = (wavePhase + 1) % 64;
          stepped = true;
        }
        const kindChanged = lastKind !== k;
        lastKind = k;
        if (stepped || kindChanged || riseFrame === 0) {
          drawSunrise(riseFrame, playingRef.current);
        }
        raf = requestAnimationFrame(draw);
        return;
      }
      lastKind = k;

      ctx.fillStyle = "#060a11";
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = rgba(C.glow, 0.05);
      for (let gx = 4; gx < W; gx += 8) {
        for (let gy = 4; gy < H; gy += 8) {
          ctx.fillRect(gx, gy, 1, 1);
        }
      }

      if (k === "rain") {
        ctx.strokeStyle = rgba(C.glow, 0.55);
        ctx.lineWidth = 1;
        for (const d of drops) {
          d.y += d.v * (dt / 16.7);
          d.x += d.v * 0.12 * (dt / 16.7);
          if (d.y > H + d.len) {
            d.y = -d.len;
            d.x = Math.random() * W;
          }
          if (d.x < -4) d.x = W + 4;
          if (d.x > W + 4) d.x = -4;
          ctx.globalAlpha = 0.25 + 0.35 * (d.v / (2.2 * SPEED));
          ctx.beginPath();
          ctx.moveTo(Math.floor(d.x), Math.floor(d.y));
          ctx.lineTo(Math.floor(d.x - d.len * 0.15), Math.floor(d.y - d.len));
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = rgba(C.line, 0.28);
        ctx.fillRect(0, H - 3, W, 1);
      } else if (k === "stars") {
        for (const s of stars) {
          const tw = 0.35 + 0.65 * Math.abs(Math.sin(t / 2200 + s.p));
          const x = (s.x - t / 14000) % W;
          ctx.fillStyle = rgba(C.ice, tw * s.s);
          ctx.fillRect(Math.floor(x < 0 ? x + W : x), Math.floor(s.y), 1, 1);
        }
      } else if (k === "drive") {
        for (const l of lines) {
          l.x -= l.v * (dt / 16.7);
          if (l.x + l.len < 0) {
            l.x = W + Math.random() * 20;
            l.y = Math.random() * H;
            l.len = 8 + Math.random() * 22;
          }
          const depth = 0.25 + 0.75 * (l.y / H);
          ctx.fillStyle = rgba(C.glow, 0.55 * depth);
          ctx.fillRect(Math.floor(l.x), Math.floor(l.y), Math.floor(l.len * depth), 1);
        }
        ctx.fillStyle = rgba(C.ice, 0.5);
        ctx.fillRect(0, Math.floor(H * 0.42), W, 1);
      } else {
        // wave: wavelength scales with width so ultrawide still feels full
        const lenBase = (2 * Math.PI) / Math.max(W * 0.35, 1);
        const ampScale = H / 112;
        const layers = [
          { amp: 10 * ampScale, len: lenBase * 1.1, speed: 0.00055, y: H * 0.2, a: 0.3 },
          { amp: 14 * ampScale, len: lenBase * 0.95, speed: 0.00045, y: H * 0.38, a: 0.75 },
          { amp: 17 * ampScale, len: lenBase * 0.7, speed: 0.00035, y: H * 0.55, a: 0.45 },
          { amp: 13 * ampScale, len: lenBase * 0.55, speed: 0.00025, y: H * 0.72, a: 0.3 },
          { amp: 9 * ampScale, len: lenBase * 0.85, speed: 0.0002, y: H * 0.86, a: 0.2 },
        ];
        for (const L of layers) {
          ctx.fillStyle = rgba(C.glow, L.a);
          for (let x = 0; x < W; x += 1) {
            const y =
              L.y +
              Math.sin(x * L.len + t * L.speed * 16) * L.amp +
              Math.sin(x * L.len * 0.4 + t * L.speed * 7) * L.amp * 0.5;
            ctx.fillRect(x, Math.floor(y), 1, 1);
          }
        }
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("resize", onWinResize);
    };
  }, [layout]);

  if (layout === "cover") {
    return (
      <canvas
        ref={canvasRef}
        className="pixelated absolute inset-0 block h-full w-full"
        style={{ objectFit: "fill", width: "100%", height: "100%" }}
        aria-hidden
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="pixelated block h-full w-full"
      aria-hidden
    />
  );
}
