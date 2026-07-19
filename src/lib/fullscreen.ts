/** Full-screen helpers: native FS + best-effort landscape lock on mobile. */

export type FullMode = "none" | "window" | "screen";

export function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(max-width: 900px)").matches ||
    window.matchMedia("(pointer: coarse)").matches
  );
}

export async function requestNativeFullscreen(
  el: HTMLElement = document.documentElement,
): Promise<boolean> {
  try {
    if (document.fullscreenElement) return true;
    const anyEl = el as HTMLElement & {
      webkitRequestFullscreen?: () => void | Promise<void>;
      webkitRequestFullScreen?: () => void | Promise<void>;
      msRequestFullscreen?: () => void | Promise<void>;
    };
    if (el.requestFullscreen) {
      await el.requestFullscreen();
      return true;
    }
    if (anyEl.webkitRequestFullscreen) {
      await anyEl.webkitRequestFullscreen();
      return true;
    }
    if (anyEl.webkitRequestFullScreen) {
      await anyEl.webkitRequestFullScreen();
      return true;
    }
    if (anyEl.msRequestFullscreen) {
      await anyEl.msRequestFullscreen();
      return true;
    }
  } catch {
    /* denied / unsupported — overlay modes still work */
  }
  return false;
}

export async function exitNativeFullscreen(): Promise<void> {
  try {
    if (!document.fullscreenElement) return;
    const doc = document as Document & {
      webkitExitFullscreen?: () => void | Promise<void>;
      msExitFullscreen?: () => void | Promise<void>;
    };
    if (document.exitFullscreen) await document.exitFullscreen();
    else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
    else if (doc.msExitFullscreen) await doc.msExitFullscreen();
  } catch {
    /* ignore */
  }
}

export async function lockLandscape(): Promise<void> {
  try {
    const o = screen.orientation as ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>;
    };
    if (o?.lock) await o.lock("landscape");
  } catch {
    /* iOS / desktop / permission — CSS fallback may still apply */
  }
}

export function unlockOrientation(): void {
  try {
    screen.orientation?.unlock?.();
  } catch {
    /* ignore */
  }
}

export async function enterFullMode(mode: "window" | "screen"): Promise<void> {
  await requestNativeFullscreen();
  if (isMobileViewport()) await lockLandscape();
  document.documentElement.dataset.full = mode;
}

export async function leaveFullMode(): Promise<void> {
  delete document.documentElement.dataset.full;
  unlockOrientation();
  await exitNativeFullscreen();
}
