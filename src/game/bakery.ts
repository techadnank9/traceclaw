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
  baker: Body & { hold: Hold; ai: number };
  customers: Customer[];
  oven: Oven;
  laws: Law[];
  evals: EvalReport[];
  hint: string;
  popup: { text: string; life: number };
  keys: Set<string>;
  inject: Set<string> | null;
  interactLatch: boolean;
  firstJam: boolean;
  goldHit: boolean;
};

export const ST = {
  tray: { x: 860, y: 150, r: 52, label: "tray" },
  oven: { x: 720, y: 130, r: 54, label: "oven" },
  register: { x: 200, y: 210, r: 50, label: "register" },
  binder: { x: 90, y: 110, r: 48, label: "binder" },
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
    player: { ...body(480, 420), hold: "empty" },
    cass: body(200, 188),
    baker: { ...body(780, 200), hold: "empty", ai: 0 },
    customers: [],
    oven: { has: "empty", t: 0, jam: false, books: 1 },
    laws: [],
    evals: [],
    hint: "WASD move · Space pick up / put down",
    popup: { text: "", life: 0 },
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
  g.player = { ...body(480, 420), hold: "empty" };
  g.baker = { ...body(780, 200), hold: "empty", ai: 0 };
  g.customers = [];
  g.oven = { has: "empty", t: 0, jam: false, books: 1 };
  g.hint = "Grab a raw muffin from the tray. Oven is hungry.";
  g.firstJam = true;
  g.goldHit = false;
  spawnCustomer(g);
}

function spawnCustomer(g: Game) {
  const used = new Set(g.customers.filter((c) => c.alive).map((c) => c.slot));
  const slot = [0, 1, 2].find((s) => !used.has(s));
  if (slot == null) return;
  g.customers.push({
    ...body(240 + slot * 120, 560),
    wait: 18,
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
  const jam = g.firstJam || (!statuteOn(g) && Math.random() < 0.4);
  g.firstJam = false;
  g.oven = { has: "raw", t: jam && !statuteOn(g) ? 1.8 : 2.6, jam, books: jam ? 2 : 1 };
  g.hint = jam ? "Two recipe books on the oven. That’s the extra copy." : "Baking.";
  return true;
}

function finishOven(g: Game) {
  const kind = g.oven.jam ? "jam" : "clean";
  const result = serveTicket(kind, g.laws);
  if (result.passed) {
    g.oven.has = "cooked";
    g.oven.books = 1;
    g.hint = "Muffin done. Carry it to a customer or the register.";
  } else {
    g.oven.has = "burnt";
    g.oven.books = result.books;
    g.goldHit = result.goldHit;
    g.combo = 0;
    if (!statuteOn(g) && !stickyOn(g)) {
      g.phase = "court";
      g.hint = "FAIL. Jules wrote ALWAYS BAKE SMALLER. Walk to the binder.";
    } else {
      g.hint = result.why;
    }
  }
}

function serve(g: Game) {
  const waiting = g.customers.find((c) => c.alive && c.y < 430);
  if (!waiting) {
    g.hint = "No one at the counter yet.";
    return;
  }
  const tip = 10 + g.combo * 2;
  g.cash += tip;
  g.served += 1;
  g.combo += 1;
  waiting.alive = false;
  g.player.hold = "empty";
  pop(g, `+$${tip}`);
  g.hint = g.combo > 1 ? `${g.combo} streak` : "Served. Next muffin.";
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
      p.hold = "empty";
      g.hint = "Sticky thrown out. Space again to file the camera rule.";
      pop(g, "Thrown out");
      return;
    }
    const { law } = proposeLaw("free_ckpt", fail, gold, g.laws);
    g.laws = repealIfHitsGold([...g.laws.filter((l) => l.id !== law.id), law], gold);
    g.phase = "play";
    g.oven.has = "empty";
    g.hint = "Filed: put extra book back. Next jam will live.";
    pop(g, "Filed");
    return;
  }

  if (g.phase !== "play") return;

  if (near(p, ST.tray) && p.hold === "empty") {
    p.hold = "raw";
    g.hint = "Raw muffin. Walk to the oven.";
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
    g.hint = p.hold === "cooked" ? "Carry it to the counter." : "Burnt. Take it to the binder.";
    return;
  }
  if ((near(p, ST.register) || g.customers.some((c) => c.alive && Math.hypot(c.x - p.x, c.y - p.y) < 56)) && p.hold === "cooked") {
    serve(g);
    return;
  }
  if (near(p, ST.binder) && p.hold === "burnt") {
    p.hold = "empty";
    g.hint = "Tossed. Don’t file Jules’s sticky.";
  }
}

export function fileStickyAnyway(g: Game) {
  if (g.phase !== "court") return;
  const { law } = forceLaw("cut_batch", failNight1(), g.laws);
  g.laws = [...g.laws.filter((l) => l.kind !== "cut_batch"), law];
  g.phase = "play";
  g.goldHit = true;
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
      return;
    }
    if (g.customers.filter((c) => c.alive).length < 3 && Math.random() < dt * 0.35) spawnCustomer(g);
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
    moveToward(b, 780, 200, 70, dt);
    return;
  }
  b.ai += dt;
  if (b.hold === "empty" && g.oven.has === "empty") {
    if (moveToward(b, ST.tray.x - 20, ST.tray.y + 10, 90, dt)) b.hold = "raw";
  } else if (b.hold === "raw") {
    if (moveToward(b, ST.oven.x + 30, ST.oven.y + 40, 90, dt)) {
      if (loadOven(g, "raw")) b.hold = "empty";
    }
  } else {
    moveToward(b, 760, 210, 60, dt);
  }
}

function cassAi(g: Game, dt: number) {
  g.cass.bob += dt * 5;
  const sway = Math.sin(g.t * 2) * 8;
  moveToward(g.cass, 200 + sway, 188, 40, dt);
}

function customersAi(g: Game, dt: number) {
  for (const c of g.customers) {
    if (!c.alive) continue;
    const tx = 240 + c.slot * 120;
    const ty = 355;
    moveToward(c, tx, ty, 70, dt);
    c.bob += dt * 5;
    if (g.phase === "play" && Math.hypot(c.x - tx, c.y - ty) < 10) {
      c.wait -= dt;
      if (c.wait <= 0) {
        c.alive = false;
        g.walked += 1;
        g.combo = 0;
        g.cash = Math.max(0, g.cash - 4);
        pop(g, "Walkout");
      }
    }
  }
  g.customers = g.customers.filter((c) => c.alive || c.y < 600);
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
