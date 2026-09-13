/**
 * Weave camera for the browser game. Server-only: holds the W&B key.
 * Every loop moment the café produces becomes a weave.op call in the same
 * project the court CLI and the molab robot log to.
 */
import type { CameraEvent } from "./camera-types.ts";

type Weave = typeof import("weave");

let client: Promise<{ weave: Weave; ops: Record<CameraEvent["kind"], (p: Record<string, unknown>) => Promise<unknown>> } | null> | null = null;

async function boot() {
  const key = process.env.WANDB_API_KEY?.trim();
  if (!key) return null;
  const entity = process.env.WANDB_ENTITY?.trim() || "iamadnan";
  const project = process.env.WANDB_PROJECT?.trim() || "tracelaw";
  const weave = await import("weave");
  await weave.init(`${entity}/${project}`);
  const mk = (name: string) =>
    weave.op(async (payload: Record<string, unknown>) => ({ ...payload, at: new Date().toISOString() }), { name });
  return {
    weave,
    ops: {
      oven: mk("cafe.oven_bake"),
      court: mk("cafe.court_verdict"),
      night_over: mk("cafe.night_over"),
      robot: mk("cafe.gpu_robot"),
      judge: mk("cafe.typesafe_judge"),
    },
  };
}

/** Record one café event. Fails closed: no key or any error → `{ camera: "offline" }`. */
export async function record(event: CameraEvent): Promise<{ camera: "weave" | "offline" }> {
  try {
    client ??= boot().catch(() => null);
    const c = await client;
    if (!c) return { camera: "offline" };
    await c.ops[event.kind](event.payload);
    return { camera: "weave" };
  } catch {
    return { camera: "offline" };
  }
}
