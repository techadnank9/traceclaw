import { createServerFn } from "@tanstack/react-start";
import type { GpuOrder, GpuPlan } from "./gpu.server.ts";

export type { GpuOrder, GpuPlan };

export const gpuPlan = createServerFn({ method: "POST" })
  .inputValidator((input: { order: GpuOrder; laws: string[] }) => input)
  .handler(async ({ data }): Promise<GpuPlan> => {
    const { planOnGpu } = await import("./gpu.server.ts");
    return planOnGpu(data.order, data.laws);
  });

/** Ask the molab GPU what to do with this ticket. Resolves offline on any failure. */
export async function askGpu(order: GpuOrder, laws: string[]): Promise<GpuPlan> {
  if (typeof window === "undefined") return { camera: "offline", action: "noop", struck: false };
  try {
    return await gpuPlan({ data: { order, laws } });
  } catch {
    return { camera: "offline", action: "noop", struck: false };
  }
}
