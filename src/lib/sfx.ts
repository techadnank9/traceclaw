let ctx: AudioContext | null = null;

export function unlockSfx() {
  if (typeof window === "undefined") return;
  try {
    ctx = ctx ?? new AudioContext();
    void ctx.resume();
  } catch {
    ctx = null;
  }
}

export function blip(freq: number, dur = 0.09) {
  if (!ctx) return;
  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.05, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  } catch {
    /* autoplay / test env */
  }
}
