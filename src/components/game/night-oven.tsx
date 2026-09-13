import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Button } from "@/components/ui/button";
import {
  bindControls,
  createGame,
  currentStep,
  fileStickyAnyway,
  forceNextBake,
  interact,
  startShift,
  type Game,
} from "@/game/bakery";
import { BakeryScene, Loop } from "@/game/world3d";
import { cn } from "@/lib/utils";
import { RobotShift } from "@/components/game/robot-shift";

export function NightOven() {
  const gameRef = useRef<Game>(createGame());
  const [ui, setUi] = useState(snap(gameRef.current));
  const [booted, setBooted] = useState(false);
  const [lab, setLab] = useState(false);

  useEffect(() => bindControls(gameRef.current), []);

  const play = (learned = false) => {
    startShift(gameRef.current, learned);
    setBooted(true);
    setUi(snap(gameRef.current));
  };

  const hold = (code: string, on: boolean) => {
    const g = gameRef.current;
    if (on) g.keys.add(code);
    else g.keys.delete(code);
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#2a2018] text-fg">
      <div className="relative h-full w-full">
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <p className="font-display text-xl text-[#f3e9d8] drop-shadow">The Night Oven</p>
          <p className="rounded-md bg-elevated/90 px-3 py-1 font-mono text-sm shadow-sheet">
            ${ui.cash} · {ui.served} served · {ui.walked} gone · {fmt(ui.timeLeft)}
          </p>
        </div>

        <div className="absolute inset-0">
          <Canvas
            className="absolute inset-0 touch-none"
            shadows
            dpr={[1, 1.5]}
            camera={{ position: [0, 9.2, 11.5], fov: 42, near: 0.1, far: 80 }}
            onPointerDown={() => interact(gameRef.current)}
          >
            <Loop game={gameRef} onUi={(g) => setUi(snap(g))} />
            <BakeryScene game={gameRef} />
          </Canvas>

          {lab ? (
            <div className="absolute inset-0 z-30 grid place-items-center overflow-auto bg-fg/60 p-4">
              <RobotShift onClose={() => setLab(false)} />
            </div>
          ) : null}

          {ui.phase === "menu" && !booted && !lab ? (
            <div className="absolute inset-0 z-30 grid place-items-center bg-fg/50 p-4">
              <div className="max-w-md rounded-xl bg-elevated p-6 text-center shadow-sheet">
                <p className="text-xs uppercase tracking-widest text-muted">TRACELAW café</p>
                <h1 className="mt-1 font-display text-3xl">Bake the 2048</h1>
                <p className="mt-3 text-sm text-muted">
                  An order comes in. The Unitree G1 makes it. If it fails, it learns the right rule and does it again. Its brain is a model on an RTX PRO 6000; when the oven jams, Jules tapes a lazy note: ALWAYS BAKE SMALLER. You are the manager: WASD to the BINDER, Space to tear up the note and file the real rule.
                </p>
                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
                  <Button size="lg" onClick={() => play(false)}>
                    Night 1 · before learning
                  </Button>
                  <Button size="lg" onClick={() => play(true)}>
                    Night 2 · after learning
                  </Button>
                  <Button size="lg" variant="secondary" onClick={() => setLab(true)}>
                    Robot log
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {ui.phase === "play" || ui.phase === "court" ? (
            <div className="pointer-events-none absolute left-4 top-16 z-10 max-w-sm rounded-md bg-elevated/95 p-3 shadow-sheet">
              <p className="text-[10px] uppercase tracking-widest text-muted">Ticket · 2048 croissant</p>
              <ol className="mt-1 space-y-0.5 font-mono text-xs">
                {["Register — take order", "Tray — raw muffin", "Oven — bake", "Register — serve"].map((line, i) => (
                  <li key={line} className={ui.step.n === i + 1 || (ui.step.n === 5 && i === 3) || (ui.step.n === 4 && i === 2) ? "font-semibold text-fg" : "text-muted"}>
                    {i + 1}. {line}
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-sm">{ui.step.label}</p>
            </div>
          ) : null}

          {ui.phase === "court" ? (
            <div className="absolute bottom-28 left-4 right-4 z-10 mx-auto max-w-xl rounded-md bg-elevated/95 p-3 shadow-sheet">
              <p className="font-display text-lg text-danger">Oven jammed — extra recipe book</p>
              <p className="text-sm text-muted">Jules taped a note on the binder: “ALWAYS BAKE SMALLER.” Walk to the BINDER. Space tears up the note; Space again files the real rule: put the extra recipe book back.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => interact(gameRef.current)}>
                  Tear up note / file rule
                </Button>
                <Button size="sm" variant="danger" onClick={() => fileStickyAnyway(gameRef.current)}>
                  Keep Jules’s note
                </Button>
              </div>
            </div>
          ) : null}

          {ui.phase === "over" && !lab ? (
            <div className="absolute inset-0 z-30 grid place-items-center bg-fg/50 p-4">
              <div className="max-w-md rounded-xl bg-elevated p-6 shadow-sheet">
                <p className="text-xs uppercase tracking-widest text-muted">Night over</p>
                <h2 className="font-display text-3xl">${ui.cash}</h2>
                <p className="mt-1 text-sm text-muted">
                  {ui.served} served · {ui.walked} walkouts
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {ui.evals.map((e) => (
                    <div key={e.label} className={e.label.includes("sticky") ? "rounded-md bg-danger/10 p-3" : "rounded-md bg-ok/10 p-3"}>
                      <p className="text-xs uppercase tracking-widest">{e.label.includes("sticky") ? "Jules’s note" : "Your binder"}</p>
                      <p className="font-display text-2xl">
                        {e.passed}/{e.total}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <Button size="lg" onClick={() => play(false)}>
                    Night 1 · before
                  </Button>
                  <Button size="lg" onClick={() => play(true)}>
                    Night 2 · after
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 flex flex-col items-center gap-1 px-4 pb-4">
          <p className="rounded-md bg-elevated/90 px-3 py-1 text-center text-sm shadow-sheet">{ui.hint}</p>
          <p className="rounded-md bg-elevated/80 px-2 py-0.5 text-center font-mono text-xs text-muted">Robot brain (GPU) · {ui.gpu}</p>
          <p className="rounded-md bg-elevated/80 px-2 py-0.5 text-center font-mono text-xs text-muted">Second judge (TypeSafe) · {ui.judge}</p>
        </div>

        {ui.phase === "play" ? (
          <div className="absolute bottom-4 right-4 z-10 flex gap-1 opacity-40 transition hover:opacity-90">
            <button type="button" className="rounded bg-elevated px-2 py-0.5 font-mono text-[10px] text-muted" onClick={() => forceNextBake(gameRef.current, "clean")}>
              next: success
            </button>
            <button type="button" className="rounded bg-elevated px-2 py-0.5 font-mono text-[10px] text-muted" onClick={() => forceNextBake(gameRef.current, "jam")}>
              next: failure
            </button>
          </div>
        ) : null}

        <div className="absolute bottom-24 left-0 right-0 z-10 flex justify-center gap-6 sm:hidden">
          <div className="grid grid-cols-3 gap-1">
            <span />
            <Pad onHold={(on) => hold("KeyW", on)}>W</Pad>
            <span />
            <Pad onHold={(on) => hold("KeyA", on)}>A</Pad>
            <Pad onHold={(on) => hold("KeyS", on)}>S</Pad>
            <Pad onHold={(on) => hold("KeyD", on)}>D</Pad>
          </div>
          <Pad className="h-16 w-16" onHold={(on) => hold("Space", on)}>
            Use
          </Pad>
        </div>
      </div>
    </div>
  );
}

function snap(g: Game) {
  return {
    phase: g.phase,
    cash: g.cash,
    served: g.served,
    walked: g.walked,
    timeLeft: g.timeLeft,
    hint: g.hint,
    evals: g.evals,
    gpu: g.gpu.pending ? "thinking" : g.gpu.last ? (g.gpu.last.camera === "gpu" ? `${g.gpu.last.struck ? `${g.gpu.last.wanted ?? "?"} ✂` : g.gpu.last.action} · ${g.gpu.last.ms ?? "?"} ms · ${(g.gpu.last.device ?? "GPU").replace(" Blackwell Server Edition", "")}` : "offline") : "idle",
    judge: g.judge.pending ? "Jev thinking" : g.judge.last ? (g.judge.last.camera === "typesafe" ? `${g.judge.last.kind}: court ${g.judge.last.ruling} · Jev ${g.judge.last.verdict} ${Math.round((g.judge.last.confidence ?? 0) * 100)}% · punishes gold ${Math.round((g.judge.last.punishes_gold ?? 0) * 100)}% · ${g.judge.last.ms ?? "?"} ms` : "offline (no TYPESAFE_API_KEY)") : "idle",
    step: currentStep(g),
    ticket: g.ticket,
  };
}

function fmt(t: number) {
  const s = Math.max(0, Math.ceil(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Pad({
  children,
  onHold,
  className,
}: {
  children: string;
  onHold: (on: boolean) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn("h-12 w-12 rounded-md bg-elevated text-sm font-medium shadow-sheet", className)}
      onPointerDown={(e) => {
        e.preventDefault();
        onHold(true);
      }}
      onPointerUp={() => onHold(false)}
      onPointerLeave={() => onHold(false)}
    >
      {children}
    </button>
  );
}
