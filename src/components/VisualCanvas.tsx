"use client";

import { useEffect, useRef } from "react";
import type { VisualKind } from "@/lib/tracks";

/**
 * Low-res animated canvas upscaled with image-rendering: pixelated.
 * Kinds: pixel rain | starfield drift | slow waveform | drive speed-lines.
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

    let drops: Drop[] = [];
    let stars: Star[] = [];
    let lines: Line[] = [];

    const seedParticles = () => {
      const area = W * H;
      const base = 112 * 112;
      const dropN = Math.round(90 * (area / base));
      const starN = Math.round(140 * (area / base));
      // denser drive streaks so CYBERPUNK reads clearly even on small square TV
      const lineN = Math.round(48 * (area / base));

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
      ctx.fillStyle = "#060a11";
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = rgba(C.glow, 0.05);
      for (let gx = 4; gx < W; gx += 8) {
        for (let gy = 4; gy < H; gy += 8) {
          ctx.fillRect(gx, gy, 1, 1);
        }
      }

      const k = kindRef.current;

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
