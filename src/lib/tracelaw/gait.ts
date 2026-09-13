import { createServerFn } from "@tanstack/react-start";
import type { GaitPose } from "./gait.server.ts";

export type { GaitPose };

export const gaitPose = createServerFn({ method: "POST" })
  .inputValidator((input: { phase: number; moving: boolean }) => input)
  .handler(async ({ data }): Promise<GaitPose> => {
    const { gaitStep } = await import("./gait.server.ts");
    return gaitStep(data.phase, data.moving);
  });
