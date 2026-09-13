/**
 * Live GPU brain: run the robot planner inside the molab kernel (RTX PRO 6000)
 * through marimo's kernel-execute API. Server-only: holds the molab token.
 * Fails closed to `{ camera: "offline" }` so the café never blocks on the GPU.
 */

export type GpuOrder = { job_id: string; batch: number; param_copies: number };
export type GpuPlan = {
  camera: "gpu" | "offline";
  action: "noop" | "cut_batch" | "free_ckpt";
  /** What the model asked for before the court ruled. */
  wanted?: string;
  struck: boolean;
  why?: string;
  ms?: number;
  device?: string;
  raw?: string;
};

const OFFLINE: GpuPlan = { camera: "offline", action: "noop", struck: false };

async function sessionId(base: string, token: string): Promise<string | null> {
  const r = await fetch(`${base}/api/sessions`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const sessions = (await r.json()) as Record<string, unknown>;
  return Object.keys(sessions)[0] ?? null;
}

/** Parse marimo's SSE stream: stdout chunks + a final `done` event. */
function stdoutOf(sse: string): string {
  let event = "";
  let out = "";
  for (const raw of sse.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:") && event === "stdout") {
      try {
        out += (JSON.parse(line.slice(5)) as { data: string }).data;
      } catch {
        /* ignore partial */
      }
    }
  }
  return out;
}

export async function planOnGpu(order: GpuOrder, laws: string[]): Promise<GpuPlan> {
  const base = process.env.MOLAB_URL?.trim().replace(/\/$/, "");
  const token = process.env.MARIMO_TOKEN?.trim();
  if (!base || !token) return OFFLINE;
  try {
    const sid = await sessionId(base, token);
    if (!sid) return OFFLINE;
    const binder = laws.map((k) => ({ kind: k, status: "admitted" }));
    const code = [
      "import json as _j",
      `_o = ${JSON.stringify(order)}`,
      `_b = ${JSON.stringify(binder)}`,
      "_p = robot_plan(_o, _b)",
      "_r = court_check(_p, _b)",
      'print("@@" + _j.dumps({"plan": _p, "ruling": _r}) + "@@")',
    ].join("\n");
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 20000);
    const r = await fetch(`${base}/api/kernel/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Marimo-Session-Id": sid, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code }),
      signal: ctl.signal,
    });
    clearTimeout(timer);
    if (!r.ok) return OFFLINE;
    const m = /@@(.*?)@@/s.exec(stdoutOf(await r.text()));
    if (!m) return OFFLINE;
    const { plan, ruling } = JSON.parse(m[1]) as {
      plan: { action?: string; why?: string; ms?: number; device?: string; raw?: string };
      ruling: { action: GpuPlan["action"]; struck: boolean };
    };
    return { camera: "gpu", action: ruling.action, wanted: plan.action, struck: ruling.struck, why: plan.why, ms: plan.ms, device: plan.device, raw: plan.raw };
  } catch {
    return OFFLINE;
  }
}
