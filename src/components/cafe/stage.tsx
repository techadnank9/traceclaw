import type { ReactNode } from "react";
import { BookOpen, Clock, Settings, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Law } from "@/lib/tracelaw/types";
import { useBinder } from "@/lib/tracelaw/store";

export function CafeHud({
  sticky,
  narrow,
  extra,
  cta,
}: {
  sticky?: Law;
  narrow?: Law;
  extra?: ReactNode;
  cta: ReactNode;
}) {
  const tap = useBinder((s) => s.tap);
  const mode = useBinder((s) => s.mode);
  const cash = useBinder((s) => s.cash);
  const combo = useBinder((s) => s.combo);
  const load = useBinder((s) => s.load);
  const rep = useBinder((s) => s.rep);
  const timeLeft = useBinder((s) => s.timeLeft);
  const night = useBinder((s) => s.night);
  const hint = useBinder((s) => s.hint);
  const lastVerdict = useBinder((s) => s.lastVerdict);

  const clock = formatClock(timeLeft);

  return (
    <div className="mx-auto max-w-6xl px-2 py-2 sm:px-4 sm:py-3">
      <div className="overflow-hidden rounded-xl border-2 border-fg/25 bg-[#f3e6d2] shadow-sheet">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-fg/15 bg-[#efe0c8] px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-elevated text-fg shadow-sheet">
              <BookOpen className="size-4" />
            </span>
            <div>
              <p className="font-display text-lg leading-none text-fg">TRACELAW</p>
              <p className="text-[10px] uppercase tracking-widest text-muted">Café management</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-fg">
            <span>$ {cash.toLocaleString()}</span>
            <span className="inline-flex items-center gap-1">
              <Star className="size-3" /> {combo > 1 ? `${combo} streak` : `Night ${night}`}
            </span>
            <span>{rep}%</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" /> Day {night} · {clock}
            </span>
          </div>
          <span className="inline-flex items-center gap-1 rounded-md border border-border bg-elevated px-2 py-1 text-xs text-muted">
            <Settings className="size-3" /> Menu
          </span>
        </header>

        <p className="bg-[#fff3bf] px-3 py-1.5 text-center text-sm text-fg">{hint}</p>
        {lastVerdict ? <p className="px-3 pb-1 text-center text-xs text-muted">{lastVerdict}</p> : null}

        <div className="grid gap-3 p-3 lg:grid-cols-[240px_minmax(0,1fr)_230px]">
          <Phone />
          <Kitchen />
          <Binder sticky={sticky} narrow={narrow} />
        </div>

        <footer className="grid gap-2 border-t-2 border-fg/15 bg-[#efe0c8] px-3 py-2 sm:grid-cols-4">
          <HudStat label="Café status" value={mode === "court" ? "Court" : mode === "results" ? "Closed" : load > 120 ? "Overworked" : "Open"} />
          <HudStat label="Active runner" value={narrow?.status === "admitted" ? "Jules · binder" : "Jules"} />
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted">Kitchen load</p>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-subtle">
              <div className={cn("h-full bg-danger", load < 80 && "bg-ok")} style={{ width: `${Math.min(load, 100)}%` }} />
            </div>
            <p className="mt-0.5 font-mono text-xs text-fg">{Math.round(load)}%</p>
          </div>
          <HudStat label="Reputation" value={rep >= 70 ? "Held" : "Falling"} />
        </footer>
      </div>
      {extra}
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">{cta}</div>
      <button type="button" className="sr-only" onClick={() => tap("phone")}>
        Accept ticket
      </button>
    </div>
  );
}

function formatClock(timeLeft: number) {
  const t = Math.max(0, Math.ceil(timeLeft));
  const m = Math.floor(t / 60);
  const s = String(t % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function Glow({
  on,
  onClick,
  className,
  children,
}: {
  on: boolean;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}) {
  if (!on) return <div className={className}>{children}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("rounded-md ring-2 ring-highlight", className)}
      style={{ animation: "hotspot-pulse 1.6s ease-out infinite" }}
    >
      {children}
    </button>
  );
}

function HudStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted">{label}</p>
      <p className="font-display text-base text-fg">{value}</p>
    </div>
  );
}

function Phone() {
  const tap = useBinder((s) => s.tap);
  const mode = useBinder((s) => s.mode);
  const station = useBinder((s) => s.station);
  const ticket = useBinder((s) => s.ticket);
  const accept = mode === "menu" || (mode === "shift" && station === "idle" && Boolean(ticket));
  const pct = ticket ? Math.max(0, ticket.patience / ticket.maxPatience) : 0;

  return (
    <aside className="rounded-[1.7rem] border-4 border-fg bg-[#1c1915] p-2">
      <div className="rounded-[1.15rem] bg-[#fffaf3] p-3 text-fg">
        <p className="text-[10px] uppercase tracking-widest text-muted">DoorDash · bakery</p>
        <p className="mt-1 text-xs text-muted">{ticket ? `Ticket ${ticket.id}` : "Waiting for ping"}</p>
        <p className="mt-3 text-xs uppercase tracking-widest text-muted">{ticket?.kind === "jam" ? "Problem order" : "New order"}</p>
        <img src="/cafe/croissant.jpg" alt="Croissant" className="mx-auto mt-2 h-24 w-24 rounded-md object-cover" />
        <p className="mt-2 text-center font-display text-4xl leading-none text-fg">2048</p>
        <p className="text-center text-xs uppercase tracking-widest text-muted">Croissant</p>
        {ticket ? (
          <div className="mt-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-subtle">
              <div className={cn("h-full bg-ok", pct < 0.35 && "bg-danger")} style={{ width: `${pct * 100}%` }} />
            </div>
            <p className="mt-1 text-center text-[10px] uppercase tracking-widest text-muted">Patience</p>
          </div>
        ) : null}
        <Glow on={accept} onClick={() => tap("phone")} className="mt-3 w-full">
          <span className="block rounded-md bg-ok px-3 py-2 text-center text-sm font-medium text-paper">
            {mode === "menu" ? "Clock in" : ticket ? "Accept order" : "Waiting"}
          </span>
        </Glow>
      </div>
    </aside>
  );
}

function Kitchen() {
  const tap = useBinder((s) => s.tap);
  const station = useBinder((s) => s.station);
  const books = useBinder((s) => s.books);
  const oven = useBinder((s) => s.oven);
  const ticket = useBinder((s) => s.ticket);
  const mode = useBinder((s) => s.mode);
  const failed = oven === "dead";

  return (
    <section className="relative min-h-80 overflow-hidden rounded-lg border border-fg/20">
      <img src="/cafe/kitchen.jpg" alt="Kitchen" className="absolute inset-0 size-full object-cover" />
      <div className="absolute inset-0 bg-[#3c2814]/20" />
      <p className="relative z-10 mx-auto mt-3 w-max rounded-md bg-elevated/95 px-3 py-1 text-xs font-medium text-fg shadow-sheet">
        Kitchen · {ticket ? `2048 × croissant` : "Idle"}
      </p>

      <Glow on={mode === "shift" && station === "jules"} onClick={() => tap("jules")} className="absolute bottom-[18%] left-[18%] z-10 w-24">
        <img src="/cafe/jules.jpg" alt="Jules the intern" className="h-24 w-24 rounded-full object-cover ring-2 ring-elevated" />
        <span className="mt-1 block rounded-sm bg-elevated/95 text-center text-[10px] text-fg">Jules</span>
      </Glow>

      <Glow on={mode === "shift" && station === "cass"} onClick={() => tap("cass")} className="absolute bottom-[20%] left-[46%] z-10 w-24">
        <img src="/cafe/cass.jpg" alt="Cass the cashier" className="h-24 w-24 rounded-full object-cover ring-2 ring-elevated" />
        <span className="mt-1 block rounded-sm bg-elevated/95 text-center text-[10px] text-fg">Cass</span>
      </Glow>

      <Glow on={mode === "shift" && station === "oven"} onClick={() => tap("oven")} className="absolute right-[8%] top-[28%] z-10">
        <span className="block rounded-md bg-elevated/95 px-3 py-2 text-xs font-medium text-fg">
          {oven === "ok" ? "Oven · baking" : oven === "dead" ? "Oven · jammed" : "Light the oven"}
        </span>
      </Glow>

      <div className="absolute bottom-3 left-3 z-10 flex gap-2">
        <img src="/cafe/book-brown.jpg" alt="Classic croissant" className="h-16 w-12 rounded-sm object-cover shadow-sheet" />
        {books === 2 ? <img src="/cafe/book-green.jpg" alt="Extra book" className="h-16 w-12 rounded-sm object-cover shadow-sheet" /> : null}
      </div>

      <p className="absolute left-[12%] top-[38%] z-10 max-w-32 rounded-md bg-elevated/95 px-2 py-1 text-xs text-fg">
        {failed ? "We don’t have that." : ticket ? "Ticket for 2048 croissants!" : "Kitchen quiet."}
      </p>

      {failed ? (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
          <span
            className="rounded-full border-[10px] border-danger px-7 py-5 font-display text-6xl font-semibold uppercase tracking-widest text-danger"
            style={{ animation: "stamp-pop 420ms cubic-bezier(0.22,1,0.36,1) both" }}
          >
            Fail
          </span>
        </div>
      ) : null}
    </section>
  );
}

function Binder({ sticky, narrow }: { sticky?: Law; narrow?: Law }) {
  const mode = useBinder((s) => s.mode);
  const throwSticky = useBinder((s) => s.throwSticky);
  const fileStatute = useBinder((s) => s.fileStatute);
  const fileSticky = useBinder((s) => s.fileSticky);
  const court = mode === "court";

  return (
    <aside className="flex flex-col gap-3 rounded-lg bg-[#3d2a18] p-3 text-[#fffaf3]">
      <div>
        <p className="font-display text-lg leading-tight">Manager’s night-binder</p>
        <p className="text-[10px] uppercase tracking-widest text-[#d9cfc0]">Review. File. Fix.</p>
      </div>
      <div className="relative min-h-40 rounded-sm bg-[#2b1d12] p-3">
        <div className="h-36 rounded-sm bg-[#1a4a6e] shadow-sheet" />
        <Glow on={court && sticky?.status !== "rejected"} onClick={throwSticky} className="absolute right-3 top-5 w-[5.5rem]">
          <p className="-rotate-6 bg-highlight p-2 text-center font-display text-xs text-fg shadow-sheet">
            Always bake smaller
            <span className="mt-1 block text-[10px] uppercase tracking-widest text-danger">
              {sticky?.status === "rejected" ? "Thrown out" : court ? "Tap to throw out" : sticky?.status === "admitted" ? "Policy" : ""}
            </span>
          </p>
        </Glow>
      </div>
      {court ? (
        <div className="grid gap-2">
          <Glow on={court} onClick={fileStatute} className="w-full">
            <div className="rounded-md bg-ok px-3 py-2 text-center text-xs text-paper">File: put extra book back</div>
          </Glow>
          <button type="button" onClick={fileSticky} className="rounded-md bg-danger/80 px-3 py-2 text-xs text-paper">
            File the sticky anyway
          </button>
        </div>
      ) : (
        <div className={cn("rounded-md px-3 py-2 text-xs", narrow?.status === "admitted" ? "bg-ok text-paper" : "bg-[#2b1d12] text-[#d9cfc0]")}>
          {narrow?.status === "admitted" ? "Filed · put extra book back" : "No statute filed yet"}
        </div>
      )}
    </aside>
  );
}
