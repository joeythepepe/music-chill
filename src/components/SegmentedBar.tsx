"use client";

import { useCallback, useRef } from "react";

/**
 * Blocky segmented bar (progress / volume) — a row of small blocks
 * like the reference's temperature scale. Click / drag to set value.
 *
 * Segments fill the full track width so click X maps 1:1 to the visual bar.
 */
export default function SegmentedBar({
  ratio,
  segments = 48,
  height = 16,
  onChange,
  label,
  /** stronger empty segments for dark overlays (theater dock) */
  bright = false,
}: {
  /** 0..1 */
  ratio: number;
  segments?: number;
  height?: number;
  onChange?: (ratio: number) => void;
  label?: string;
  bright?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragPointerId = useRef<number | null>(null);

  const setFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || !onChange) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return;
      const r = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      onChange(r);
    },
    [onChange],
  );

  const filled = Math.round(ratio * segments);
  const interactive = Boolean(onChange);

  return (
    // Outer shell expands the vertical hit target without changing the visual height.
    <div
      role={interactive ? "slider" : undefined}
      aria-label={label}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? Math.round(ratio * 100) : undefined}
      tabIndex={interactive ? 0 : undefined}
      className={`w-full select-none ${interactive ? "cursor-pointer touch-none py-2 -my-2" : ""}`}
      onPointerDown={(e) => {
        if (!onChange) return;
        e.preventDefault();
        dragPointerId.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        setFromClientX(e.clientX);
      }}
      onPointerMove={(e) => {
        if (dragPointerId.current !== e.pointerId) return;
        setFromClientX(e.clientX);
      }}
      onPointerUp={(e) => {
        if (dragPointerId.current !== e.pointerId) return;
        dragPointerId.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      }}
      onPointerCancel={(e) => {
        if (dragPointerId.current !== e.pointerId) return;
        dragPointerId.current = null;
      }}
      onKeyDown={(e) => {
        if (!onChange) return;
        const step = e.shiftKey ? 0.1 : 0.05;
        if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          e.preventDefault();
          onChange(Math.min(1, ratio + step));
        } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          e.preventDefault();
          onChange(Math.max(0, ratio - step));
        } else if (e.key === "Home") {
          e.preventDefault();
          onChange(0);
        } else if (e.key === "End") {
          e.preventDefault();
          onChange(1);
        }
      }}
    >
      <div
        ref={trackRef}
        className="flex w-full items-stretch gap-[2px]"
        style={{ height }}
        aria-hidden
      >
        {Array.from({ length: segments }, (_, i) => {
          const isFilled = i < filled;
          const isHead = i === filled - 1;
          return (
            <span
              key={i}
              className={
                isFilled
                  ? isHead
                    ? "min-w-0 flex-1 bg-glow shadow-[0_0_6px_rgba(103,232,249,0.7)]"
                    : "min-w-0 flex-1 bg-ice/80"
                  : bright
                    ? "min-w-0 flex-1 bg-linehi/70"
                    : "min-w-0 flex-1 bg-line/50"
              }
            />
          );
        })}
      </div>
    </div>
  );
}
