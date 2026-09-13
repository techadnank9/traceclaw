import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Button } from "@/components/ui/button";
import {
  bindControls,
  createGame,
  fileStickyAnyway,
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

  const play = () => {
    startShift(gameRef.current);
    setBooted(true);
    setUi(snap(gameRef.current));
  };

  const hold = (code: string, on: boolean) => {
    const g = gameRef.current;
    if (on) g.keys.add(code);
    else g.keys.delete(code);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col px-3 py-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-md bg-elevated px-3 py-2 shadow-sheet">
          <p className="font-display text-lg">The Night Oven</p>
          <p className="font-mono text-sm">
            ${ui.cash} · {ui.served} served · {ui.walked} gone · {fmt(ui.timeLeft)}
          </p>
        </div>

        <div className="relative min-h-[70dvh] flex-1 overflow-hidden rounded-xl border border-border bg-fg shadow-sheet">
          <Canvas
            className="h-[70dvh] min-h-[420px] touch-none"
            shadows
            dpr={[1, 2]}
            camera={{ position: [1.2, 4.8, 6.4], fov: 50, near: 0.1, far: 80 }}
            onPointerDown={() => interact(gameRef.current)}
          >
            <Loop game={gameRef} onUi={(g) => setUi(snap(g))} />
            <BakeryScene game={gameRef} />
          </Canvas>

          {lab ? (
            <div className="absolute inset-0 grid place-items-center overflow-auto bg-fg/60 p-4">
              <RobotShift onClose={() => setLab(false)} />
            </div>
          ) : null}

          {ui.phase === "menu" && !booted && !lab ? (
            <div className="absolute inset-0 grid place-items-center bg-fg/50 p-4">
              <div className="max-w-md rounded-xl bg-elevated p-6 text-center shadow-sheet">
                <p className="text-xs uppercase tracking-widest text-muted">TRACELAW café</p>
                <h1 className="mt-1 font-display text-3xl">Bake the 2048</h1>
                <p className="mt-3 text-sm text-muted">
                  WASD walk. Space or click to pick up / put down. Jules will load an extra recipe book. File the camera
                  rule, not ALWAYS BAKE SMALLER.
                </p>
                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
                  <Button size="lg" onClick={play}>
                    Play
                  </Button>
                  <Button size="lg" variant="secondary" onClick={() => setLab(true)}>
                    GPU robot
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {ui.phase === "court" ? (
            <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => interact(gameRef.current)}>
                Throw sticky / file rule
              </Button>
              <Button size="sm" variant="danger" onClick={() => fileStickyAnyway(gameRef.current)}>
                File sticky anyway
              </Button>
            </div>
          ) : null}

          {ui.phase === "over" && !lab ? (
            <div className="absolute inset-0 grid place-items-center bg-fg/50 p-4">
              <div className="max-w-md rounded-xl bg-elevated p-6 shadow-sheet">
                <p className="text-xs uppercase tracking-widest text-muted">Night over</p>
                <h2 className="font-display text-3xl">${ui.cash}</h2>
                <p className="mt-1 text-sm text-muted">
                  {ui.served} served · {ui.walked} walkouts
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {ui.evals.map((e) => (
                    <div key={e.label} className={e.label.includes("sticky") ? "rounded-md bg-danger/10 p-3" : "rounded-md bg-ok/10 p-3"}>
                      <p className="text-xs uppercase tracking-widest">{e.label.includes("sticky") ? "Sticky" : "Binder"}</p>
                      <p className="font-display text-2xl">
                        {e.passed}/{e.total}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <Button size="lg" onClick={play}>
                    Play
                  </Button>
                  <Button size="lg" variant="secondary" onClick={() => setLab(true)}>
                    GPU robot
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <p className="mt-2 text-center text-sm text-muted">{ui.hint}</p>

        <div className="mt-2 flex justify-center gap-6 sm:hidden">
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
