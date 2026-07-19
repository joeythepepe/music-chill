"use client";

import { useEffect, useId, useRef, useState } from "react";

const AUTHOR = "Joey G. CHOU";
const HOMEPAGE = "https://www.joeyzhou.me/";
const EMAIL = "zhouyicuhk@link.cuhk.edu.hk";

/**
 * Top-left pixel “!” badge → HUD about popover (author / site / email).
 */
export default function AboutMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  // click outside + Esc close
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`about-badge font-pixel ${open ? "about-badge-on" : ""}`}
        aria-label="About the author"
        aria-expanded={open}
        aria-controls={panelId}
        title="About"
      >
        !
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="About CHILL//OS"
          className="about-pop absolute top-[calc(100%+8px)] left-0 z-50 w-[min(18rem,calc(100vw-2rem))] border border-linehi bg-void/95 p-3 shadow-[0_0_0_1px_rgba(0,0,0,0.5),0_12px_32px_rgba(0,0,0,0.65)] backdrop-blur-sm"
        >
          {/* corner ticks — HUD frame */}
          <span className="about-tick about-tick-tl" aria-hidden />
          <span className="about-tick about-tick-tr" aria-hidden />
          <span className="about-tick about-tick-bl" aria-hidden />
          <span className="about-tick about-tick-br" aria-hidden />

          <p className="hud-label mb-2 text-[8px] text-glow">
            ▮ OPERATOR FILE
          </p>
          <p className="font-pixel text-sm font-bold tracking-wider text-ice">
            {AUTHOR}
          </p>
          <p className="mt-0.5 font-plex text-[10px] tracking-widest text-dim uppercase">
            CHILL//OS · author
          </p>

          <div className="my-3 h-px bg-line" aria-hidden />

          <ul className="flex flex-col gap-2">
            <li>
              <p className="hud-label mb-1 text-[8px]">▪ HOME</p>
              <a
                href={HOMEPAGE}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-hud block w-full truncate border-linehi bg-panel2 px-2 py-1.5 text-left text-[10px] text-ice normal-case tracking-wide"
              >
                www.joeyzhou.me ↗
              </a>
            </li>
            <li>
              <p className="hud-label mb-1 text-[8px]">▪ LINK</p>
              <a
                href={`mailto:${EMAIL}`}
                className="btn-hud block w-full truncate border-linehi bg-panel2 px-2 py-1.5 text-left text-[10px] text-ice normal-case tracking-wide"
              >
                {EMAIL}
              </a>
            </li>
          </ul>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="btn-hud mt-3 w-full border-linehi bg-panel2 py-1.5 text-[9px] text-ice"
          >
            ✕ CLOSE
          </button>
        </div>
      )}
    </div>
  );
}
