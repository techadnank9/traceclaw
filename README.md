# THE NIGHT OVEN

W&B entity: **iamadnan** · project: **tracelaw** · CoreWeave Hacks: Agent Loops (Sept 2026)

A 2:14 AM cafe shift. Maya orders the huge loaf. Jules the intern hands it to Cass the cashier. The oven jams. Jules slaps a sticky note: *always bake smaller*. You are the manager. Last week’s perfect huge loaf is the constitution.

Same court as TRACELAW: a house rule is filed only if it matches **this failed tape** and would **not** have punished a night that already worked.

## Play

Clock in → take ticket → intern → cashier → oven fails (two recipe books) → throw sticky out → file “put the extra book back” → same order again → delivered. Huge loaf. Eval 2/3 → 3/3.

## Court (no GPU)

```bash
python3 -m court replay
python3 -m court eval
```


## Sponsor stack (how each is used, honestly)

| Sponsor | What it does here | Where |
| --- | --- | --- |
| **W&B Weave** | The browser game itself is traced: `cafe.oven_bake`, `cafe.gpu_robot`, `cafe.court_verdict`, `cafe.typesafe_judge`, `cafe.night_over` land as `weave.op` calls through a server function (key stays server-side). CLI side: `propose_law` → `veto_against_gold` → `serve_night`. Three nights = `weave.Dataset`. Three binders (`no-binder`, `sticky-forced`, `court-binder`) = `weave.Model`s scored by `weave.Evaluation` on *alive AND batch held at 2048*. Court binder 3/3, sticky punishes gold. | `court/weave_loop.py`, [Weave](https://wandb.ai/iamadnan/tracelaw/weave) |
| **marimo molab** | RTX PRO 6000 notebook is the robot's brain, **live**: every oven jam in the game POSTs the ticket + binder to the molab kernel (`/api/kernel/execute`), Qwen2.5-0.5B on CUDA picks an action, the court strikes anything not admitted, and Jules physically walks to the oven and pulls the extra book. ~300 ms per decision, shown in the HUD. Cells were written by a coding agent via `marimo pair`; the notebook's own shift run is exported to `fixtures/robot-shift.json` (**Robot log** button). Needs `MOLAB_URL` + `MARIMO_TOKEN` from molab's "Pair with an agent"; fails closed. | [notebook](https://molab.marimo.io/notebooks/nb_XpnzWXXyteA47H9NYunt5T), `notebooks/night_oven.py` |
| **TypeSafe AI (Jev)** | Second judge in the court. Every filed law goes to `POST /v1/systemone` with three typed questions: `catches_failure` (noul), `punishes_gold` (noul), `verdict` (choice admit/reject). The deterministic binder stays the law of record; Jev's calibrated view + confidence is shown in the HUD and traced to Weave. Measured: sticky → **reject 0.94–0.98**, punishes-gold 0.96; statute → **admit 0.91–0.97**, punishes-gold 0.03–0.07; ~280 ms. Also a `weave.op` (`jev_second_opinion`) in the CLI loop. Needs `TYPESAFE_API_KEY`; fails closed to "offline". | `src/lib/tracelaw/typesafe.server.ts` |
| **ARIA** | Not integrated. Said plainly. | — |

## The loop, as judges will see it

```
ticket → robot plan (GPU LLM) → court check (admitted laws only) → bake
      ↘ fail trace → propose law → veto against gold → binder
                                                  ↘ Weave Evaluation: no-binder 1/3 · sticky 1/3 (gold punished) · court 3/3
```

## Loop

```
fail trace  →  reckless bill  →  gold veto
            →  narrow bill    →  admit
            →  worker reads binder  →  night 2
            →  eval  2/3 → 3/3
```

Memory is not a diary. Memory is a meaner form.

## Demo (four clicks)

1. Open tonight’s ticket
2. Check the sticky note against last week → Thrown out
3. File the narrow rule → Filed
4. Play night 2 → job lives, batch 2048. Show the camera if asked.

## Court (no GPU)

```bash
python3 -m court replay
python3 -m court eval
PYTHONPATH=. python3 court/test_engine.py
```

Optional Weave (fails closed if no key):

```bash
export WANDB_API_KEY=...
export WANDB_ENTITY=iamadnan
export WANDB_PROJECT=tracelaw
python3 -m pip install weave
python3 -m court weave
```

Weave: https://wandb.ai/iamadnan/tracelaw/weave · GPU notebook: https://molab.marimo.io/notebooks/nb_XpnzWXXyteA47H9NYunt5T

## Mac (M4) setup

Homebrew + Python already installed.

1. Node 22  
   `brew install node@22`  
   then put `/opt/homebrew/opt/node@22/bin` on your PATH.
2. Unzip this repo, `cd` into it.
3. `cp env.example .env` — add `WANDB_API_KEY`, `WANDB_ENTITY`, and optionally `MOLAB_URL`/`MARIMO_TOKEN` (molab → Pair with an agent) and `TYPESAFE_API_KEY` (console.typesafe.ai). Everything fails closed without them.
4. `npm install`
5. Prove the court: `python3 -m court replay` and `python3 -m court eval`
If `npm run dev` says `spawn vite ENOENT`, Vite is not installed yet:

```bash
cd tracelaw-superheros
npm install
npm run dev
```

## Robots

The café robots are the **Unitree G1** from MuJoCo Menagerie, posed at the `stand` keyframe with MuJoCo forward kinematics and baked to glTF by `scripts/g1/export_g1.py` (0.7 MB each, PBR tints; the same G1 [robot-gym](https://github.com/techadnank9/robot-gym) races in MuJoCo). They are on by default; `?g1=0` restores the placeholder bodies. The glTF is loaded by a small cached `GLTFLoader` hook, not drei's Suspense `<Gltf>`, which remount-storms with several robots until WebGL loses its context.

**Jules (G1) runs the orders.** Autopilot: take the ticket at the register → raw muffin from the tray → load the oven → serve → repeat. On every jam the ticket goes to the molab GPU; when the court binder allows `free_ckpt`, Jules walks to the oven and pulls the extra book. You still walk the floor and you file the laws — the binder is the human's job.

Verified run (embedded browser, no human input except filing): jam → GPU `free_ckpt ✂` struck (empty binder) → FAIL → file rule (Jev admit 0.96) → next jam → GPU `free_ckpt` admitted, 274 ms → "Extra book back on the shelf. Batch 2048 held." → 3 orders served.

## Binder

Field predicates on span attributes (`batch`, `param_copies`), not string search.

- Reckless `cut_batch` matches `batch == 2048` (hits the archive) → reject
- Narrow `free_ckpt` matches `param_copies > 1` only → admit
- Filing the same kind twice is a no-op
- An admitted law that later hits gold is repealed
- Binder + audit persist in the browser; **Export binder** downloads JSON

## Tests

```bash
npm test
```

## What we did not ship

Live GPU training. Login. A second UI. Five extra laws. If Weave is down the camera says **offline** and fixtures still run.

## License

MIT
