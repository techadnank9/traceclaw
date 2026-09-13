/** Ask the molab kernel's MuJoCo G1 for the next physically-stepped body poses. Server-only. */
export type GaitPose = { camera: "mujoco" | "offline"; xpos?: number[][]; xquat?: number[][]; pelvis_z?: number };

async function sessionId(base: string, token: string): Promise<string | null> {
  const r = await fetch(`${base}/api/sessions`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  return Object.keys((await r.json()) as Record<string, unknown>)[0] ?? null;
}

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
        /* partial */
      }
    }
  }
  return out;
}

let cachedSession: string | null = null;

export async function gaitStep(phase: number, moving: boolean): Promise<GaitPose> {
  const base = process.env.MOLAB_URL?.trim().replace(/\/$/, "");
  const token = process.env.MARIMO_TOKEN?.trim();
  if (!base || !token) return { camera: "offline" };
  try {
    cachedSession ??= await sessionId(base, token);
    if (!cachedSession) return { camera: "offline" };
    const code = `import json as _j\nprint("@@" + _j.dumps(g1_gait(${Number(phase).toFixed(3)}, ${moving ? "True" : "False"})) + "@@")`;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(`${base}/api/kernel/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Marimo-Session-Id": cachedSession, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code }),
      signal: ctl.signal,
    });
    clearTimeout(timer);
    if (!r.ok) {
      cachedSession = null;
      return { camera: "offline" };
    }
    const m = /@@(.*?)@@/s.exec(stdoutOf(await r.text()));
    if (!m) return { camera: "offline" };
    const j = JSON.parse(m[1]) as { xpos: number[][]; xquat: number[][]; pelvis_z: number };
    return { camera: "mujoco", ...j };
  } catch {
    return { camera: "offline" };
  }
}
