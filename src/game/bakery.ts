import {
  archiveTrace,
  evaluate,
  failNight1,
  forceLaw,
  proposeLaw,
  repealIfHitsGold,
  serveTicket,
  stickyEval,
} from "@/lib/tracelaw/engine";
import type { EvalReport, Law } from "@/lib/tracelaw/types";
import { camera } from "@/lib/tracelaw/camera";
import { askGpu, type GpuPlan } from "@/lib/tracelaw/gpu";
import { askJudge, type JudgeVerdict } from "@/lib/tracelaw/typesafe";

export const W = 960;
export const H = 540;
const SHIFT = 90;
const SPEED = 165;

export type Phase = "menu" | "play" | "court" | "over";
export type Hold = "empty" | "raw" | "cooked" | "burnt" | "sticky";

type Body = { x: number; y: number; vx: number; vy: number; facing: number; bob: number };
type Customer = Body & { wait: number; slot: number; alive: boolean };

type Oven = {
  has: Hold;
  t: number;
  jam: boolean;
  books: 1 | 2;
};

export type Game = {
  phase: Phase;
  t: number;
  timeLeft: number;
  cash: number;
  served: number;
  walked: number;
  combo: number;
  player: Body & { hold: Hold };
  cass: Body;
  baker: Body & { hold: Hold; ai: number; task: "idle" | "pull" };
  gpu: { pending: boolean; last: GpuPlan | null; seq: number };
  judge: { pending: boolean; last: (JudgeVerdict & { kind: string; ruling: string }) | null };
  customers: Customer[];
  oven: Oven;
  laws: Law[];
  evals: EvalReport[];
  hint: string;
  popup: { text: string; life: number };
  ticket: boolean;
  keys: Set<string>;
  inject: Set<string> | null;
  interactLatch: boolean;
  firstJam: boolean;
  goldHit: boolean;
};

export const ST = {
  tray: { x: 700, y: 140, r: 56, label: "tray" },
  oven: { x: 520, y: 130, r: 58, label: "oven" },
  register: { x: 220, y: 200, r: 56, label: "register" },
  binder: { x: 80, y: 120, r: 50, label: "binder" },
};

function near(a: Body, s: { x: number; y: number; r: number }) {
  const dx = a.x - s.x;
  const dy = a.y - s.y;
  return dx * dx + dy * dy <= s.r * s.r;
}

function body(x: number, y: number): Body {
  return { x, y, vx: 0, vy: 0, facing: 0, bob: 0 };
}

export function createGame(): Game {
  return {
    phase: "menu",
    t: 0,
    timeLeft: SHIFT,
    cash: 0,
    served: 0,
    walked: 0,
    combo: 0,
    player: { ...body(400, 280), hold: "empty" },
    cass: body(220, 168),
    baker: { ...body(560, 180), hold: "empty", ai: 0, task: "idle" },
    gpu: { pending: false, last: null, seq: 0 },
    judge: { pending: false, last: null },
    customers: [],
    oven: { has: "empty", t: 0, jam: false, books: 1 },
    laws: [],
    evals: [],
    hint: "WASD move · Space to take order / pick up / put down",
    popup: { text: "", life: 0 },
    ticket: false,
    keys: new Set(),
    inject: null,
    interactLatch: false,
    firstJam: true,
    goldHit: false,
  };
}

function held(g: Game, code: string) {
  if (g.inject) return g.inject.has(code);
  return g.keys.has(code);
}

function pop(g: Game, text: string) {
  g.popup = { text, life: 1.1 };
}

function statuteOn(g: Game) {
  return g.laws.some((l) => l.kind === "free_ckpt" && l.status === "admitted");
}

function stickyOn(g: Game) {
  return g.laws.some((l) => l.kind === "cut_batch" && l.status === "admitted");
}

export function startShift(g: Game) {
  g.phase = "play";
  g.timeLeft = SHIFT;
  g.cash = 0;
  g.served = 0;
  g.walked = 0;
  g.combo = 0;
  g.player = { ...body(400, 280), hold: "empty" };
  g.baker = { ...body(560, 180), hold: "empty", ai: 0, task: "idle" };
  g.cass = body(220, 168);
  g.gpu = { pending: false, last: null, seq: 0 };
  g.judge = { pending: false, last: null };
  g.customers = [];
  g.oven = { has: "empty", t: 0, jam: false, books: 1 };
  g.ticket = false;
  g.hint = "Customer at the REGISTER. Walk there, press Space — take the 2048 ticket.";
  g.firstJam = true;
  g.goldHit = false;
  spawnCustomer(g);
}

function spawnCustomer(g: Game) {
  const used = new Set(g.customers.filter((c) => c.alive).map((c) => c.slot));
  const slot = [0, 1, 2].find((s) => !used.has(s));
  if (slot == null) return;
  g.customers.push({
    ...body(220 + slot * 70, 520),
    wait: 32,
    slot,
    alive: true,
  });
}

function clampPlayer(p: Body) {
  p.x = Math.max(36, Math.min(W - 36, p.x));
  p.y = Math.max(70, Math.min(H - 36, p.y));
}

function moveToward(b: Body, x: number, y: number, speed: number, dt: number) {
  const dx = x - b.x;
  const dy = y - b.y;
  const d = Math.hypot(dx, dy) || 1;
  if (d < 6) {
    b.vx = 0;
    b.vy = 0;
    return true;
  }
  b.vx = (dx / d) * speed;
  b.vy = (dy / d) * speed;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.facing = Math.atan2(b.vy, b.vx);
  return false;
}

function loadOven(g: Game, from: Hold) {
  if (g.oven.has !== "empty") return false;
  if (from !== "raw") return false;
  const jam = g.firstJam || Math.random() < 0.4;
  g.firstJam = false;
  g.oven = { has: "raw", t: jam ? 3.4 : 2.6, jam, books: jam ? 2 : 1 };
  g.hint = jam ? "Jules slammed an extra recipe book. GPU robot is reading the ticket…" : "Baking — wait for the ding.";
  if (jam) askRobot(g);
  return true;
}

/** A filed law → TypeSafe Jev: catches failure? punishes gold? admit/reject. Second opinion only. */
function askSecondJudge(g: Game, law: Law) {
  g.judge.pending = true;
  const fail = failNight1();
  const gold = archiveTrace();
  void askJudge({
    law: { kind: law.kind, predicate: law.predicate, reason: law.reason, status: law.status },
    failed_night: { job_id: fail.jobId, passed: fail.passed, ...fail.attrs },
    gold_night: { job_id: gold.jobId, passed: gold.passed, ...gold.attrs },
  }).then((v) => {
    g.judge.pending = false;
    g.judge.last = { ...v, kind: law.kind, ruling: law.status };
    camera("judge", { kind: law.kind, ruling: law.status, ...v });
  });
}

/** Ticket → molab GPU → court check → Jules acts. Fails closed: offline GPU changes nothing. */
function askRobot(g: Game) {
  const seq = ++g.gpu.seq;
  g.gpu.pending = true;
  const laws = g.laws.filter((l) => l.status === "admitted").map((l) => l.kind);
  void askGpu({ job_id: `ticket-${seq}`, batch: 2048, param_copies: 2 }, laws).then((plan) => {
    if (seq !== g.gpu.seq) return;
    g.gpu.pending = false;
    g.gpu.last = plan;
    camera("robot", { seq, laws, ...plan });
    if (plan.camera !== "gpu") return;
    if (plan.action === "free_ckpt" && !plan.struck && g.oven.has === "raw" && g.oven.books === 2) {
      g.baker.task = "pull";
      g.hint = `GPU robot: free_ckpt in ${plan.ms ?? "?"} ms. Jules is pulling the extra book.`;
    } else if (plan.struck) {
      g.hint = `GPU robot wanted ${plan.wanted ?? plan.action}. Court struck it: not in the binder.`;
    } else {
      g.hint = `GPU robot: ${plan.action}. Two books stay on the oven.`;
    }
  });
}

function finishOven(g: Game) {
  const kind = g.oven.jam ? "jam" : "clean";
  const result = serveTicket(kind, g.laws);
  camera("oven", { ticket: kind, books: g.oven.books, batch: 2048, passed: result.passed, why: result.why, gpu: g.gpu.last?.camera === "gpu" ? g.gpu.last.action : "offline", laws: g.laws.map((l) => `${l.kind}:${l.status}`) });
  if (result.passed) {
    g.oven.has = "cooked";
    g.oven.books = 1;
    g.hint = "Ding! Space at the OVEN, then carry it to the REGISTER.";
  } else {
    g.oven.has = "burnt";
    g.oven.books = result.books;
    g.goldHit = result.goldHit;
    g.combo = 0;
    if (!statuteOn(g) && !stickyOn(g)) {
      g.phase = "court";
      g.hint = "FAIL. Jules wrote ALWAYS BAKE SMALLER. Walk to the BINDER, press Space.";
    } else {
      g.hint = result.why;
    }
  }
}

function serve(g: Game) {
  if (!g.ticket) {
    g.hint = "Take the order at the REGISTER first (Space).";
    return;
  }
  const waiting = g.customers.find((c) => c.alive);
  if (!waiting) {
    g.hint = "No ticket. Take an order at the REGISTER.";
    return;
  }
  const tip = 10 + g.combo * 2;
  g.cash += tip;
  g.served += 1;
  g.combo += 1;
  waiting.alive = false;
  g.player.hold = "empty";
  g.ticket = false;
  pop(g, `+$${tip}`);
  g.hint = "Served. Next customer — REGISTER, then TRAY, then OVEN.";
}

export function interact(g: Game) {
  if (g.phase === "menu") {
    startShift(g);
    return;
  }
  if (g.phase === "over") {
    startShift(g);
    return;
  }
  const p = g.player;

  if (g.phase === "court" && near(p, ST.binder)) {
    const fail = failNight1();
    const gold = [archiveTrace()];
    if (!g.laws.some((l) => l.kind === "cut_batch")) {
      const { law } = proposeLaw("cut_batch", fail, gold, g.laws);
      g.laws = [...g.laws, law];
      camera("court", { kind: law.kind, status: law.status, reason: law.reason, predicate: law.predicate });
      askSecondJudge(g, law);
      p.hold = "empty";
      g.hint = "Sticky thrown out. Space again to file the camera rule.";
      pop(g, "Thrown out");
      return;
    }
    const { law } = proposeLaw("free_ckpt", fail, gold, g.laws);
    g.laws = repealIfHitsGold([...g.laws.filter((l) => l.id !== law.id), law], gold);
    camera("court", { kind: law.kind, status: law.status, reason: law.reason, predicate: law.predicate });
    askSecondJudge(g, law);
    g.phase = "play";
    g.oven.has = "empty";
    g.hint = "Filed: put extra book back. Next jam will live.";
    pop(g, "Filed");
    return;
  }

  if (g.phase !== "play") return;

  if (near(p, ST.register) && p.hold === "empty" && !g.ticket) {
    const waiting = g.customers.find((c) => c.alive);
    if (!waiting) {
      g.hint = "No one in line yet.";
      return;
    }
    g.ticket = true;
    g.hint = "Ticket: 2048 croissant muffin. TRAY (raw) → OVEN → REGISTER.";
    pop(g, "2048 ticket");
    return;
  }
  if (near(p, ST.tray) && p.hold === "empty") {
    if (!g.ticket) {
      g.hint = "Take the order at the REGISTER first.";
      return;
    }
    p.hold = "raw";
    g.hint = "Raw muffin. Walk to the OVEN, Space to load.";
    return;
  }
  if (near(p, ST.oven) && p.hold === "raw") {
    if (loadOven(g, "raw")) p.hold = "empty";
    else g.hint = "Oven busy.";
    return;
  }
  if (near(p, ST.oven) && p.hold === "empty" && (g.oven.has === "cooked" || g.oven.has === "burnt")) {
    p.hold = g.oven.has;
    g.oven.has = "empty";
    g.oven.books = 1;
    g.hint = p.hold === "cooked" ? "Carry it to the REGISTER. Space to serve." : "Burnt. Walk to the BINDER.";
    return;
  }
  if (near(p, ST.register) && p.hold === "cooked") {
    serve(g);
    return;
  }
  if (near(p, ST.binder) && p.hold === "burnt") {
    p.hold = "empty";
    g.hint = "Tossed. File the camera rule, not Jules’s sticky.";
  }
}

export function fileStickyAnyway(g: Game) {
  if (g.phase !== "court") return;
  const { law } = forceLaw("cut_batch", failNight1(), g.laws);
  g.laws = [...g.laws.filter((l) => l.kind !== "cut_batch"), law];
  g.phase = "play";
  g.goldHit = true;
  camera("court", { kind: law.kind, status: law.status, reason: "filed sticky anyway", predicate: law.predicate, goldHit: true });
  askSecondJudge(g, law);
  g.oven.has = "empty";
  g.hint = "You filed the sticky. Every 2048 batch will die.";
  pop(g, "Gold ruined");
}

export function tick(g: Game, dt: number) {
  dt = Math.min(0.1, dt);
  g.t += dt;
  if (g.popup.life > 0) g.popup.life -= dt;

  if (g.phase === "play") {
    g.timeLeft -= dt;
    if (g.timeLeft <= 0) {
      g.timeLeft = 0;
      g.phase = "over";
      const gold = archiveTrace();
      g.evals = [stickyEval(gold), evaluate("night binder", g.laws, gold)];
      g.hint = "Night over.";
      camera("night_over", { cash: g.cash, served: g.served, walked: g.walked, evals: g.evals.map((e) => `${e.label} ${e.passed}/${e.total}`), laws: g.laws.map((l) => `${l.kind}:${l.status}`) });
      return;
    }
    const waiting = g.customers.filter((c) => c.alive).length;
    if (waiting === 0) spawnCustomer(g);
    else if (waiting < 2 && !g.ticket && Math.random() < dt * 0.12) spawnCustomer(g);
  }

  const p = g.player;
  if (g.phase === "play" || g.phase === "court") {
    let ax = 0;
    let ay = 0;
    if (held(g, "KeyA") || held(g, "ArrowLeft")) ax -= 1;
    if (held(g, "KeyD") || held(g, "ArrowRight")) ax += 1;
    if (held(g, "KeyW") || held(g, "ArrowUp")) ay -= 1;
    if (held(g, "KeyS") || held(g, "ArrowDown")) ay += 1;
    const len = Math.hypot(ax, ay) || 1;
    p.vx = (ax / len) * SPEED * (ax || ay ? 1 : 0);
    p.vy = (ay / len) * SPEED * (ax || ay ? 1 : 0);
    if (ax || ay) p.facing = Math.atan2(p.vy, p.vx);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    clampPlayer(p);
    p.bob += Math.hypot(p.vx, p.vy) * dt * 0.08;
  }

  const space = held(g, "Space") || held(g, "KeyE");
  if (space && !g.interactLatch) {
    g.interactLatch = true;
    interact(g);
  }
  if (!space) g.interactLatch = false;

  bakerAi(g, dt);
  cassAi(g, dt);
  customersAi(g, dt);

  if (g.phase === "play" && g.oven.has === "raw") {
    g.oven.t -= dt;
    if (g.oven.t <= 0) finishOven(g);
  }
}

function bakerAi(g: Game, dt: number) {
  const b = g.baker;
  b.bob += dt * 6;
  if (g.phase !== "play") {
    moveToward(b, 560, 180, 70, dt);
    return;
  }
  b.ai += dt;
  if (b.task === "pull") {
    if (moveToward(b, ST.oven.x - 30, ST.oven.y + 40, 120, dt)) {
      b.task = "idle";
      if (g.oven.has === "raw" && g.oven.books === 2) {
        g.oven.books = 1;
        g.oven.jam = false;
        pop(g, "Book pulled");
        g.hint = "Extra book back on the shelf. Batch 2048 held.";
      }
    }
    return;
  }
  const jam = g.oven.books === 2;
  moveToward(b, ST.oven.x + (jam ? 24 : 48), ST.oven.y + 42, jam ? 110 : 40, dt);
}

function cassAi(g: Game, dt: number) {
  g.cass.bob += dt * 5;
  const sway = Math.sin(g.t * 2) * 6;
  moveToward(g.cass, ST.register.x + sway, ST.register.y - 28, 40, dt);
}

function customersAi(g: Game, dt: number) {
  for (const c of g.customers) {
    if (!c.alive) continue;
    const tx = ST.register.x + 18 + c.slot * 54;
    const ty = ST.register.y + 90;
    moveToward(c, tx, ty, 80, dt);
    c.bob += dt * 5;
    if (g.phase === "play" && Math.hypot(c.x - tx, c.y - ty) < 12) {
      c.wait -= dt;
      if (c.wait <= 0) {
        c.alive = false;
        g.walked += 1;
        g.combo = 0;
        g.ticket = false;
        g.cash = Math.max(0, g.cash - 4);
        pop(g, "Walkout");
      }
    }
  }
  g.customers = g.customers.filter((c) => c.alive || c.y < 600);
}

export function currentStep(g: Game): { n: number; label: string; station: keyof typeof ST | "wait" } {
  if (g.phase === "court") return { n: 0, label: "BINDER — throw sticky, file extra-book rule", station: "binder" };
  if (g.phase === "over") return { n: 0, label: "Night over", station: "wait" };
  if (!g.ticket) return { n: 1, label: "REGISTER — Space, take the 2048 ticket", station: "register" };
  if (g.player.hold === "raw") return { n: 3, label: "OVEN — Space, load the muffin", station: "oven" };
  if (g.oven.has === "raw") return { n: 3, label: "Wait for the ding", station: "oven" };
  if (g.oven.has === "cooked" && g.player.hold === "empty") return { n: 4, label: "OVEN — Space, take muffin out", station: "oven" };
  if (g.player.hold === "cooked") return { n: 5, label: "REGISTER — Space, serve", station: "register" };
  if (g.player.hold === "burnt") return { n: 0, label: "BINDER — dump the burnt muffin", station: "binder" };
  return { n: 2, label: "TRAY — Space, pick up raw muffin", station: "tray" };
}

export function bindControls(g: Game) {
  const down = (e: KeyboardEvent) => {
    g.keys.add(e.code);
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  };
  const up = (e: KeyboardEvent) => g.keys.delete(e.code);
  const clear = () => g.keys.clear();
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", clear);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clear();
  });
  window.__controlsTest = {
    getYaw: () => g.player.facing,
    getSpeed: () => Math.hypot(g.player.vx, g.player.vy),
    getX: () => g.player.x,
    getY: () => g.player.y,
    setKeys: (codes: string[]) => {
      g.inject = codes.length ? new Set(codes) : null;
    },
  };
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", clear);
    window.__controlsTest = undefined;
  };
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      getX: () => number;
      getY: () => number;
      setKeys: (codes: string[]) => void;
    };
  }
}
