"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DEVLOG,
  formatDevlogDate,
  groupDevlogByDate,
} from "@/lib/devlog";
import { useTv } from "@/lib/tv";

/**
 * Top-right “◈” badge → floating git work-log tree (portaled like AboutMenu).
 * Data is a build-time snapshot of `git log` (see scripts/generate-devlog.mjs).
 */
export default function DevLogMenu() {
  const { theme } = useTv();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const days = groupDevlogByDate(DEVLOG.commits);
  const commitCount = DEVLOG.commits.length;

  const placePanel = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const gap = 8;
    const width = Math.min(22 * 16, window.innerWidth - 16); // ~22rem
    let left = r.right - width;
    if (left < 8) left = 8;
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - 8 - width);
    }
    setPos({ top: r.bottom + gap, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    placePanel();
  }, [open, placePanel]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onReposition = () => placePanel();
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, placePanel]);

  const panel =
    open &&
    pos &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-label="Musicyber development log from git history"
        data-theme={theme}
        className="about-pop border border-linehi bg-void/95 p-3 shadow-[0_0_0_1px_rgba(0,0,0,0.5),0_12px_32px_rgba(0,0,0,0.65)] backdrop-blur-sm"
        style={{
          position: "fixed",
          top: pos.top,
          left: pos.left,
          zIndex: 300,
          width: "min(22rem, calc(100vw - 1rem))",
          color: "var(--color-fg)",
        }}
      >
        <span className="about-tick about-tick-tl" aria-hidden />
        <span className="about-tick about-tick-tr" aria-hidden />
        <span className="about-tick about-tick-bl" aria-hidden />
        <span className="about-tick about-tick-br" aria-hidden />

        <p className="hud-label mb-1 text-[8px] text-glow">▮ DEVLOG // GIT</p>
        <p className="font-pixel text-sm font-bold tracking-wider text-ice">
          WORK LOG
        </p>
        <p className="mt-0.5 font-plex text-[10px] tracking-widest text-dim uppercase">
          {commitCount} commit{commitCount === 1 ? "" : "s"} · project tree
        </p>

        <div className="my-3 h-px bg-line" aria-hidden />

        {days.length === 0 ? (
          <p className="font-plex text-[11px] tracking-wide text-dim">
            No commits in snapshot.
          </p>
        ) : (
          <ul className="devlog-tree" aria-label="Git work log by date">
            {days.map((day, dayIdx) => {
              const isLastDay = dayIdx === days.length - 1;
              return (
                <li key={day.date} className="devlog-day">
                  <div className="devlog-day-head">
                    <span className="devlog-rail" aria-hidden>
                      {isLastDay ? "└" : "├"}
                    </span>
                    <span className="devlog-day-mark" aria-hidden>
                      ●
                    </span>
                    <span className="devlog-day-label">
                      {formatDevlogDate(day.date)}
                    </span>
                    <span className="devlog-day-count">
                      {day.commits.length}
                    </span>
                  </div>
                  <ul className="devlog-commits">
                    {day.commits.map((c, i) => {
                      const isLastCommit = i === day.commits.length - 1;
                      return (
                        <li key={c.fullHash} className="devlog-commit">
                          <span className="devlog-rail" aria-hidden>
                            {isLastDay ? " " : "│"}
                          </span>
                          <span className="devlog-rail" aria-hidden>
                            {isLastCommit ? "└" : "├"}
                          </span>
                          <span className="devlog-hash" title={c.fullHash}>
                            {c.hash}
                          </span>
                          <span className="devlog-subject">{c.subject}</span>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}

        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn-hud mt-3 w-full border-linehi bg-panel2 py-1.5 text-[9px] text-ice"
        >
          ✕ CLOSE
        </button>
      </div>,
      document.body,
    );

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`about-badge font-pixel shrink-0 ${open ? "about-badge-on" : ""}`}
        aria-label="Open development log from git history"
        aria-expanded={open}
        aria-controls={panelId}
        title="Musicyber · Dev Log"
      >
        ◈
      </button>
      {panel}
    </>
  );
}
