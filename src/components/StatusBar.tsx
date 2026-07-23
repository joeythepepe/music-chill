"use client";

import { useEffect, useState } from "react";
import AboutMenu from "@/components/AboutMenu";
import DevLogMenu from "@/components/DevLogMenu";

type BatteryInfo = {
  level: number; // 0..1
  charging: boolean;
};

/** Pixel-ish bar meter from a 0..1 level (4 blocks). */
function levelBars(level: number): string {
  const n = Math.max(0, Math.min(4, Math.round(level * 4)));
  const blocks = ["▂", "▄", "▆", "█"];
  return blocks.map((b, i) => (i < n ? b : "·")).join("");
}

/**
 * Thin top status strip: callsign, live local clock (device TZ),
 * and real battery when the Battery Status API is available.
 */
export default function StatusBar({
  callsign,
  tags = [],
}: {
  callsign?: string | null;
  tags?: string[];
}) {
  const [now, setNow] = useState<Date | null>(null);
  const [battery, setBattery] = useState<BatteryInfo | null>(null);
  const [batterySupported, setBatterySupported] = useState(true);

  // ── local clock (user's device timezone) ──
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── real battery from the host device ──
  useEffect(() => {
    let cancelled = false;
    let batt: BatteryManager | null = null;
    let onLevel: (() => void) | null = null;
    let onCharge: (() => void) | null = null;

    const nav = navigator as Navigator & {
      getBattery?: () => Promise<BatteryManager>;
    };

    if (typeof nav.getBattery !== "function") {
      setBatterySupported(false);
      return;
    }

    nav
      .getBattery()
      .then((b) => {
        if (cancelled) return;
        batt = b;
        const sync = () => {
          if (cancelled) return;
          setBattery({ level: b.level, charging: b.charging });
        };
        sync();
        onLevel = sync;
        onCharge = sync;
        b.addEventListener("levelchange", onLevel);
        b.addEventListener("chargingchange", onCharge);
      })
      .catch(() => {
        if (!cancelled) setBatterySupported(false);
      });

    return () => {
      cancelled = true;
      if (batt && onLevel && onCharge) {
        batt.removeEventListener("levelchange", onLevel);
        batt.removeEventListener("chargingchange", onCharge);
      }
    };
  }, []);

  // Device-local time & date (browser TZ = user's location/machine)
  const clock = now
    ? now.toLocaleTimeString(undefined, {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "--:--:--";

  const date = now
    ? now
        .toLocaleDateString(undefined, {
          weekday: "short",
          day: "2-digit",
          month: "short",
        })
        .toUpperCase()
    : "--- --";

  const pct =
    battery != null ? Math.round(Math.min(1, Math.max(0, battery.level)) * 100) : null;

  return (
    <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        <span className="hud-label shrink-0 text-ice">▪ MUSICYBER</span>
        {callsign && (
          <span className="hud-label truncate">
            OP:<span className="text-fg">{callsign}</span>
          </span>
        )}
        {tags.map((t) => (
          <span
            key={t}
            className="hud-label hidden shrink-0 border border-line px-1.5 py-0.5 text-ice/80 sm:inline"
          >
            {t}
          </span>
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="hud-label hidden md:inline" title="Local date">
          {date}
        </span>
        <span
          className="font-pixel text-[11px] tracking-widest text-ice"
          title="Local time (your device)"
        >
          {clock}
        </span>
        {batterySupported && pct != null ? (
          <span
            className="flex items-center gap-1.5"
            title={
              battery?.charging
                ? `Battery ${pct}% · charging`
                : `Battery ${pct}%`
            }
          >
            <span
              className="font-pixel text-[9px] tracking-tighter text-fg/90"
              aria-hidden
            >
              {levelBars(battery!.level)}
            </span>
            <span className="hud-label text-ice">
              {pct}%
              {battery?.charging ? (
                <span className="ml-1 text-glow" aria-label="charging">
                  ⚡
                </span>
              ) : (
                <span className="ml-1 text-dim">▮</span>
              )}
            </span>
          </span>
        ) : (
          <span
            className="hud-label text-dim"
            title="Battery status unavailable on this browser"
          >
            --% ▮
          </span>
        )}
        <div className="flex items-center gap-1.5">
          <AboutMenu />
          <DevLogMenu />
        </div>
      </div>
    </header>
  );
}

/** Minimal BatteryManager typing (not always in TS lib.dom). */
interface BatteryManager extends EventTarget {
  readonly charging: boolean;
  readonly chargingTime: number;
  readonly dischargingTime: number;
  readonly level: number;
  onchargingchange: ((this: BatteryManager, ev: Event) => void) | null;
  onchargingtimechange: ((this: BatteryManager, ev: Event) => void) | null;
  ondischargingtimechange: ((this: BatteryManager, ev: Event) => void) | null;
  onlevelchange: ((this: BatteryManager, ev: Event) => void) | null;
}
