import { createServerFn } from "@tanstack/react-start";
import type { CameraEvent } from "./camera-types.ts";

export const recordCamera = createServerFn({ method: "POST" })
  .inputValidator((event: CameraEvent) => event)
  .handler(async ({ data }) => {
    const { record } = await import("./camera.server.ts");
    return record(data);
  });

/** Fire-and-forget from the game loop. Never throws, never blocks a frame. */
export function camera(kind: CameraEvent["kind"], payload: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  void recordCamera({ data: { kind, payload } }).catch(() => undefined);
}
