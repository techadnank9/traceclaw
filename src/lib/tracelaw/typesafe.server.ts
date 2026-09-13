/**
 * TypeSafe AI (Jev, System One) as the café's second judge.
 * The deterministic binder rules stay the law of record; Jev answers three
 * typed questions about the same evidence and we show its calibrated view
 * next to the ruling. Server-only: holds TYPESAFE_API_KEY. Fails closed.
 */

export type JudgeInput = {
  law: { kind: string; predicate: string; reason: string; status: string };
  failed_night: Record<string, unknown>;
  gold_night: Record<string, unknown>;
};

export type JudgeVerdict = {
  camera: "typesafe" | "offline";
  verdict?: "admit" | "reject";
  confidence?: number;
  catches_failure?: number;
  punishes_gold?: number;
  probabilities?: Record<string, number>;
  model?: string;
  ms?: number;
};

const QUESTIONS = {
  catches_failure: {
    type: "noul",
    instructions: "The proposed law's predicate is true for the failed night's attributes, so the law would have caught this failure.",
    criteria: { true: "The predicate matches the failed night", false: "The predicate does not match the failed night" },
  },
  punishes_gold: {
    type: "noul",
    instructions: "The proposed law's predicate is also true for the gold night, a night that already worked, so filing it would punish a success.",
    criteria: { true: "The predicate matches the gold night too", false: "The gold night is untouched by this predicate" },
  },
  verdict: {
    type: "choice",
    instructions: "Should the night-binder court admit this law? Admit only if it matches the failed night AND would not have fired on the gold night.",
    criteria: {
      admit: "Explains the failure and leaves the gold night alone",
      reject: "Either misses the failure or would have punished the gold night",
    },
  },
} as const;

export async function judgeLaw(input: JudgeInput): Promise<JudgeVerdict> {
  const key = process.env.TYPESAFE_API_KEY?.trim();
  if (!key) return { camera: "offline" };
  const t0 = Date.now();
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 15000);
    const r = await fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ state: input, model: "jev-latest", questions: QUESTIONS }),
      signal: ctl.signal,
    });
    clearTimeout(timer);
    if (!r.ok) return { camera: "offline" };
    const body = (await r.json()) as {
      model: string;
      answers: {
        catches_failure: { noul: number };
        punishes_gold: { noul: number };
        verdict: { choice: "admit" | "reject"; probabilities: Record<string, number>; confidence: number };
      };
    };
    const a = body.answers;
    return {
      camera: "typesafe",
      verdict: a.verdict.choice,
      confidence: a.verdict.confidence,
      probabilities: a.verdict.probabilities,
      catches_failure: a.catches_failure.noul,
      punishes_gold: a.punishes_gold.noul,
      model: body.model,
      ms: Date.now() - t0,
    };
  } catch {
    return { camera: "offline" };
  }
}
