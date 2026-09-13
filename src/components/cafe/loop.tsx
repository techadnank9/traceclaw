import { useEffect } from "react";
import { useBinder } from "@/lib/tracelaw/store";

/** rAF shift clock. Never setInterval. */
export function ShiftLoop() {
  const mode = useBinder((s) => s.mode);
  const tick = useBinder((s) => s.tick);

  useEffect(() => {
    if (mode !== "shift") return;
    let id = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      tick(dt);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [mode, tick]);

  return null;
}
