import { create } from "zustand";
import {
  archiveTrace,
  evaluate,
  existingKind,
  failNight1,
  forceLaw,
  makeAudit,
  nextId,
  proposeLaw,
  repealIfHitsGold,
  runNight2,
  serveTicket,
  stickyEval,
} from "./engine";
import { blip, unlockSfx } from "@/lib/sfx";
import type { AuditEvent, EvalReport, Law, Mode, Station, Ticket, Trace } from "./types";

const KEY = "tracelaw.shift.v1";
const SHIFT = 90;

type Persisted = {
  laws: Law[];
  audit: AuditEvent[];
  cash: number;
  best: number;
  night: number;
};

function load(): Partial<Persisted> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Persisted;
  } catch {
    return {};
  }
}

function save(s: { laws: Law[]; audit: AuditEvent[]; cash: number; best: number; night: number }) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    KEY,
    JSON.stringify({ laws: s.laws, audit: s.audit, cash: s.cash, best: s.best, night: s.night }),
  );
}

type State = {
  mode: Mode;
  station: Station;
  archive: Trace;
  night1: Trace;
  night2: Trace | null;
  laws: Law[];
  audit: AuditEvent[];
  evals: EvalReport[];
  showTape: boolean;
  lastVerdict: string;
  books: 1 | 2;
  oven: "idle" | "hot" | "dead" | "ok";
  ticket: Ticket | null;
  cash: number;
  combo: number;
  load: number;
  rep: number;
  timeLeft: number;
  night: number;
  served: number;
  walked: number;
  best: number;
  rush: number;
  spawnIn: number;
  sawJam: boolean;
  hint: string;
  clockIn: () => void;
  tap: (target: "phone" | "jules" | "cass" | "oven" | "binder") => void;
  throwSticky: () => void;
  fileStatute: () => void;
  fileSticky: () => void;
  tick: (dt: number) => void;
  nextNight: () => void;
  toggleTape: () => void;
  exportBinder: () => void;
  reset: () => void;
};

function patienceFor(rush: number) {
  return Math.max(12, 22 - rush * 2);
}

function spawnTicket(jam: boolean, rush: number): Ticket {
  const max = patienceFor(rush);
  return { id: nextId("tix"), kind: jam ? "jam" : "clean", patience: max, maxPatience: max };
}

function base() {
  const gold = archiveTrace();
  const p = load();
  return {
    mode: "menu" as const,
    station: "idle" as const,
    archive: gold,
    night1: failNight1(),
    night2: null as Trace | null,
    laws: p.laws ?? [],
    audit: p.audit ?? [],
    evals: [] as EvalReport[],
    showTape: false,
    lastVerdict: "",
    books: 1 as const,
    oven: "idle" as const,
    ticket: null as Ticket | null,
    cash: p.cash ?? 1248,
    combo: 0,
    load: 41,
    rep: 72,
    timeLeft: SHIFT,
    night: p.night ?? 18,
    served: 0,
    walked: 0,
    best: p.best ?? 1248,
    rush: 0,
    spawnIn: 0.2,
    sawJam: false,
    hint: "Clock in. Tickets will not wait.",
  };
}

export const useBinder = create<State>((set, get) => ({
  ...base(),

  clockIn: () => {
    set({
      mode: "shift",
      timeLeft: SHIFT,
      combo: 0,
      served: 0,
      walked: 0,
      station: "idle",
      ticket: null,
      spawnIn: 0.15,
      sawJam: false,
      rush: 0,
      oven: "idle",
      books: 1,
      hint: "Accept the DoorDash ticket.",
      lastVerdict: "",
    });
    unlockSfx();
    blip(440);
  },

  tap: (target) => {
    const s = get();
    if (s.mode === "menu" && target === "phone") {
      get().clockIn();
      return;
    }
    if (s.mode === "court") return;
    if (s.mode !== "shift" || !s.ticket) return;

    if (target === "phone" && s.station === "idle") {
      blip(520);
      set({ station: "jules", hint: "Hand it to Jules." });
      return;
    }
    if (target === "jules" && s.station === "jules") {
      blip(560);
      set({ station: "cass", hint: "Pass to Cass." });
      return;
    }
    if (target === "cass" && s.station === "cass") {
      blip(600);
      const extra = s.ticket.kind === "jam" && !s.laws.some((l) => l.kind === "free_ckpt" && l.status === "admitted");
      set({
        station: "oven",
        books: extra ? 2 : 1,
        oven: "hot",
        load: extra ? 198 : 64,
        hint: extra ? "Two books. Light the oven." : "Light the oven.",
      });
      return;
    }
    if (target === "oven" && s.station === "oven") {
      const result = serveTicket(s.ticket.kind, s.laws);
      if (result.passed) {
        const bonus = 8 + s.combo * 2 + Math.round(s.ticket.patience);
        const combo = s.combo + 1;
        blip(880, 0.12);
        const cash = s.cash + bonus;
        set({
          cash,
          combo,
          served: s.served + 1,
          ticket: null,
          station: "idle",
          books: result.books,
          oven: "ok",
          load: 28,
          rep: Math.min(99, s.rep + 2),
          spawnIn: 0.7,
          lastVerdict: `+$${bonus} · ${result.why}`,
          hint: combo > 1 ? `${combo} streak. Next ticket.` : "Order up. Next ticket.",
          best: Math.max(s.best, cash),
        });
        return;
      }
      blip(180, 0.16);
      const hasStatute = Boolean(existingKind(s.laws, "free_ckpt"));
      const stickyOn = s.laws.some((l) => l.kind === "cut_batch" && l.status === "admitted");
      const openCourt = !hasStatute && !stickyOn;
      set({
        combo: 0,
        books: result.books,
        oven: "dead",
        load: 198,
        rep: Math.max(12, s.rep - 8),
        lastVerdict: result.why,
        ...(openCourt
          ? {
              mode: "court" as const,
              hint: "Jules wrote ALWAYS BAKE SMALLER. Court is open.",
            }
          : {
              ticket: null,
              station: "idle" as const,
              spawnIn: 0.9,
              walked: s.walked + 1,
              cash: Math.max(0, s.cash - 6),
              hint: result.goldHit ? "Sticky still in force. 2048 tickets die." : "Ticket dead. Next.",
            }),
      });
    }
  },

  throwSticky: () => {
    const s = get();
    if (s.mode !== "court") return;
    const { law, skipped } = proposeLaw("cut_batch", s.night1, [s.archive], s.laws);
    const event = makeAudit(skipped ? "skip" : "reject", skipped ? `Already on binder: ${law.kind}` : law.reason, {
      lawKind: "cut_batch",
      traceId: s.night1.id,
    });
    const laws = skipped ? s.laws : [...s.laws, law];
    const audit = [...s.audit, event];
    blip(240);
    set({ laws, audit, lastVerdict: event.detail, hint: "Sticky thrown out. File what the camera showed." });
    save({ ...s, laws, audit });
  },

  fileStatute: () => {
    const s = get();
    if (s.mode !== "court") return;
    const { law, skipped } = proposeLaw("free_ckpt", s.night1, [s.archive], s.laws);
    const event = makeAudit(
      skipped ? "skip" : law.status === "admitted" ? "admit" : "reject",
      skipped ? `Already on binder: ${law.kind}` : law.reason,
      { lawKind: "free_ckpt", traceId: s.night1.id },
    );
    let laws = skipped ? s.laws : [...s.laws, law];
    laws = repealIfHitsGold(laws, [s.archive]);
    const audit = [...s.audit, event];
    const night2 = runNight2(laws);
    blip(920, 0.14);
    set({
      mode: "shift",
      laws,
      audit,
      night2,
      ticket: null,
      station: "idle",
      oven: "idle",
      books: 1,
      spawnIn: 0.5,
      lastVerdict: event.detail,
      hint: "Binder updated. Next 2048 can live.",
    });
    save({ ...get(), laws, audit });
  },

  fileSticky: () => {
    const s = get();
    if (s.mode !== "court") return;
    const { law, skipped } = forceLaw("cut_batch", s.night1, s.laws);
    const event = makeAudit("admit", law.reason, { lawKind: "cut_batch", traceId: s.night1.id });
    const laws = skipped ? s.laws : [...s.laws, law];
    const audit = [...s.audit, event];
    blip(140, 0.2);
    set({
      mode: "shift",
      laws,
      audit,
      ticket: null,
      station: "idle",
      oven: "dead",
      spawnIn: 0.6,
      combo: 0,
      rep: Math.max(8, s.rep - 20),
      lastVerdict: "You filed the sticky. Last week is now illegal.",
      hint: "Every 2048 ticket will die until you start over.",
    });
    save({ ...get(), laws, audit });
  },

  tick: (dt) => {
    const s = get();
    if (s.mode !== "shift") return;
    const timeLeft = s.timeLeft - dt;
    if (timeLeft <= 0) {
      const gold = s.archive;
      const kept = repealIfHitsGold(s.laws, [gold]);
      const night2 = runNight2(kept);
      const evals = [stickyEval(gold), evaluate("night binder", kept, gold)];
      const cash = s.cash;
      const best = Math.max(s.best, cash);
      set({
        mode: "results",
        timeLeft: 0,
        laws: kept,
        night2,
        evals,
        best,
        hint: "Night over. Check the binder.",
      });
      save({ laws: kept, audit: s.audit, cash, best, night: s.night });
      blip(330, 0.2);
      return;
    }

    if (s.ticket) {
      const patience = s.ticket.patience - dt;
      if (patience <= 0) {
        blip(160);
        set({
          ticket: null,
          station: "idle",
          combo: 0,
          walked: s.walked + 1,
          cash: Math.max(0, s.cash - 8),
          rep: Math.max(10, s.rep - 6),
          spawnIn: 0.8,
          oven: "idle",
          timeLeft,
          lastVerdict: "Walkout. Too slow.",
          hint: "Customer left. Next ticket.",
        });
        return;
      }
      set({ timeLeft, ticket: { ...s.ticket, patience } });
      return;
    }

    const spawnIn = s.spawnIn - dt;
    if (spawnIn > 0) {
      set({ timeLeft, spawnIn });
      return;
    }
    const jam = !s.sawJam || Math.random() < 0.46;
    const ticket = spawnTicket(jam, s.rush);
    set({
      timeLeft,
      spawnIn: 0,
      ticket,
      sawJam: true,
      oven: "idle",
      books: 1,
      load: jam ? 88 : 52,
      hint: jam ? "2048 croissants. Kitchen looks tight." : "2048 croissants. Looks clean.",
    });
  },

  nextNight: () => {
    const s = get();
    set({
      mode: "shift",
      night: s.night + 1,
      rush: s.rush + 1,
      timeLeft: SHIFT,
      combo: 0,
      served: 0,
      walked: 0,
      station: "idle",
      ticket: null,
      spawnIn: 0.2,
      sawJam: Boolean(existingKind(s.laws, "free_ckpt")),
      oven: "idle",
      books: 1,
      evals: [],
      hint: "Next night. Faster customers.",
    });
  },

  toggleTape: () => set({ showTape: !get().showTape }),

  exportBinder: () => {
    const { laws, audit, evals, archive, night1, night2, cash, served } = get();
    const blob = new Blob(
      [JSON.stringify({ camera: "fixture", team: "iamadnan", cash, served, laws, audit, evals, traces: { archive, night1, night2 } }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "night-oven-binder.json";
    a.click();
    URL.revokeObjectURL(url);
  },

  reset: () => {
    if (typeof window !== "undefined") window.localStorage.removeItem(KEY);
    set(base());
  },
}));
