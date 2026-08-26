import { useEffect, useState } from "react";
import { isTauri } from "./tauri";

/**
 * Rounded window corners.
 *
 * The desktop window has no native decorations, so Windows draws no corners of
 * its own — and Windows 10 predates the DWM corner preference that would round
 * them for us. The window is therefore transparent and the corners are drawn in
 * CSS, keyed off these classes. A maximised window goes square again, the way
 * Slack does it, so no desktop shows through at the edges.
 */
export function useDesktopWindowChrome(): { maximized: boolean } {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    const root = document.documentElement;
    root.classList.add("tauri");

    let disposed = false;
    let unlisten: (() => void) | undefined;

    void import("@tauri-apps/api/window").then(async ({ getCurrentWindow }) => {
      const win = getCurrentWindow();
      const sync = async () => {
        const value = await win.isMaximized();
        if (disposed) return;
        setMaximized(value);
        root.classList.toggle("window-maximized", value);
      };
      await sync();
      const stop = await win.onResized(() => void sync());
      if (disposed) stop();
      else unlisten = stop;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  return { maximized };
}
