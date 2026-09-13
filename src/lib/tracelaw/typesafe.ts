import { createServerFn } from "@tanstack/react-start";
import type { JudgeInput, JudgeVerdict } from "./typesafe.server.ts";

export type { JudgeInput, JudgeVerdict };

export const judge = createServerFn({ method: "POST" })
  .inputValidator((input: JudgeInput) => input)
  .handler(async ({ data }): Promise<JudgeVerdict> => {
    const { judgeLaw } = await import("./typesafe.server.ts");
    return judgeLaw(data);
  });

/** Ask Jev for a second opinion on a filed law. Resolves offline on any failure. */
export async function askJudge(input: JudgeInput): Promise<JudgeVerdict> {
  if (typeof window === "undefined") return { camera: "offline" };
  try {
    return await judge({ data: input });
  } catch {
    return { camera: "offline" };
  }
}
