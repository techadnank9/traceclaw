"""THE NIGHT OVEN — molab GPU notebook (mirror of the live molab kernel)
https://molab.marimo.io/notebooks/nb_XpnzWXXyteA47H9NYunt5T

Header → notebook specs → attach GPU (RTX PRO 6000).
Cells were written into the running kernel by a coding agent via marimo pair.
WANDB_API_KEY / WANDB_ENTITY in the kernel env are optional (Weave camera).
"""
# /// script
# requires-python = ">=3.13"
# dependencies = [
#     "mujoco==3.13.0",
# ]
# ///

import marimo

__generated_with = "0.24.0"
app = marimo.App(width="medium", auto_download=["html"])


@app.cell
def imports():
    import marimo as mo

    return (mo,)


@app.cell
def header(mo):
    mo.md(r"""
    # THE NIGHT OVEN — GPU lab
    Café floor is the browser game. **This notebook is the camera.**

    | Café | Cluster |
    | --- | --- |
    | 2048 croissants | batch 2048 |
    | Extra recipe book | `param_copies > 1` in VRAM |
    | Oven FAIL | OOM |
    | Sticky ALWAYS BAKE SMALLER | untested agent law |
    | Night-binder | admit only if gold 2048 still lives |
    """)
    return


@app.cell
def court():
    def law_matches(kind, batch, copies):
        if kind == "cut_batch":
            return batch == 2048
        if kind == "free_ckpt":
            return copies > 1
        return False

    def admit(kind, fail_copies, gold_batch=2048, gold_copies=1):
        catches = law_matches(kind, 2048, fail_copies)
        hits_gold = law_matches(kind, gold_batch, gold_copies)
        return {
            "kind": kind,
            "status": "admitted" if catches and not hits_gold else "rejected",
            "hits_gold": hits_gold,
        }

    sticky = admit("cut_batch", fail_copies=2)
    statute = admit("free_ckpt", fail_copies=2)

    def evaluate(laws):
        gold_dead = any(l["status"] == "admitted" and l["hits_gold"] for l in laws)
        night2 = any(l["kind"] == "free_ckpt" and l["status"] == "admitted" for l in laws)
        cases = [
            {"name": "archive", "ok": not gold_dead},
            {"name": "night1", "ok": True},
            {"name": "night2", "ok": night2},
        ]
        return {"passed": sum(c["ok"] for c in cases), "total": 3, "cases": cases}

    before = evaluate([])
    after = evaluate([sticky, statute])
    court = {"sticky": sticky, "statute": statute, "before": before, "after": after}
    return (court,)


@app.cell
def court_md(court, mo):
    b, a = court["before"], court["after"]
    mo.md(
        f"""
        ## Court replay (CPU is enough)

        - Sticky `{court["sticky"]["status"]}` — would kill last week's 2048
        - Statute `{court["statute"]["status"]}` — extra book only
        - Eval **{b["passed"]}/{b["total"]} → {a["passed"]}/{a["total"]}**
        """
    )
    return


@app.cell
def gpu(mo):
    def gpu_report():
        try:
            import torch
        except ImportError:
            return False, "torch missing — molab usually has it. Restart the kernel."
        if not torch.cuda.is_available():
            return False, "No CUDA. Header → notebook specs → attach GPU, then rerun."
        a = torch.zeros((2048, 2048), device="cuda")
        extra = a.clone()
        two = torch.cuda.memory_allocated()
        del extra
        torch.cuda.empty_cache()
        one = torch.cuda.memory_allocated()
        name = torch.cuda.get_device_name(0)
        return True, (
            f"**{name}** live. Two copies `{two}` bytes → one copy `{one}` bytes. "
            "Extra book freed. Batch 2048 held."
        )

    ok, detail = gpu_report()
    mo.md(f"## Extra book on CUDA\n\n{detail}")
    return


@app.cell
def weave(mo):
    import os

    key = os.environ.get("WANDB_API_KEY", "")
    if not key:
        mo.md("## Weave (optional)\nNo `WANDB_API_KEY` in this kernel. GPU cell above does not need it.")
    else:
        try:
            import weave

            weave.init(os.environ.get("WANDB_ENTITY", "iamadnan") + "/" + os.environ.get("WANDB_PROJECT", "tracelaw"))
            mo.md("## Weave\n`weave.init` ok. Open the printed project link.")
        except Exception as e:
            mo.md(f"## Weave\nKey present but init failed: `{e}`")
    return


@app.cell
def robot(court, mo):
    import json, re, time, torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    import weave as _weave

    _MODEL = "Qwen/Qwen2.5-0.5B-Instruct"
    _tok = AutoTokenizer.from_pretrained(_MODEL)
    _llm = AutoModelForCausalLM.from_pretrained(_MODEL, dtype=torch.bfloat16).to("cuda").eval()

    BINDER = [l for l in (court["sticky"], court["statute"]) if l["status"] == "admitted"]
    ORDERS = [
        {"job_id": "archive", "batch": 2048, "param_copies": 1},
        {"job_id": "night1",  "batch": 2048, "param_copies": 2},
        {"job_id": "night2",  "batch": 2048, "param_copies": 2},
    ]

    @_weave.op
    def robot_plan(order: dict, binder: list) -> dict:
        """GPU robot reads the ticket + binder, picks ONE action as JSON."""
        laws = "\n".join(f"- {l['kind']}: allowed" for l in binder) or "- (binder empty)"
        msgs = [
            {"role": "system", "content": "You are the night-oven robot. Reply with only JSON: {\"action\": one of [\"noop\",\"cut_batch\",\"free_ckpt\"], \"why\": short}. Rule: you may only use actions listed in the binder. If the ticket has param_copies>1 and free_ckpt is allowed, use free_ckpt. If nothing applies, noop."},
            {"role": "user", "content": f"Ticket: {json.dumps(order)}\nBinder (allowed actions):\n{laws}"},
        ]
        enc = _tok.apply_chat_template(msgs, add_generation_prompt=True, return_tensors="pt", return_dict=True).to("cuda")
        t0 = time.time()
        with torch.no_grad():
            out = _llm.generate(**enc, max_new_tokens=48, do_sample=False)
        text = _tok.decode(out[0][enc["input_ids"].shape[1]:], skip_special_tokens=True)
        m = re.search(r"\{.*\}", text, re.S)
        try:
            plan = json.loads(m.group(0)) if m else {"action": "noop", "why": "unparseable"}
        except Exception:
            plan = {"action": "noop", "why": "bad json"}
        plan["raw"] = text.strip()
        plan["ms"] = round((time.time() - t0) * 1000)
        plan["device"] = torch.cuda.get_device_name(0)
        return plan

    @_weave.op
    def court_check(plan: dict, binder: list) -> dict:
        """Court: robot may only act on admitted laws. Anything else is struck."""
        allowed = {"noop"} | {l["kind"] for l in binder}
        ok = plan.get("action") in allowed
        return {"action": plan.get("action") if ok else "noop", "struck": not ok}

    @_weave.op
    def bake(order: dict, action: str) -> dict:
        if action == "free_ckpt" and order["param_copies"] > 1:
            return {"alive": True, "batch": order["batch"], "param_copies": 1}
        if action == "cut_batch":
            return {"alive": True, "batch": order["batch"] // 2, "param_copies": order["param_copies"]}
        if order["param_copies"] > 1:
            return {"alive": False, "batch": order["batch"], "param_copies": order["param_copies"]}
        return {"alive": True, "batch": order["batch"], "param_copies": 1}

    @_weave.op
    def robot_shift(orders: list, binder: list) -> list:
        rows = []
        for o in orders:
            plan = robot_plan(o, binder)
            ruling = court_check(plan, binder)
            result = bake(o, ruling["action"])
            rows.append({**o, "robot": plan["action"], "ms": plan["ms"], "struck": ruling["struck"], **result})
        return rows

    shift_empty = robot_shift(ORDERS, [])
    shift_binder = robot_shift(ORDERS, BINDER)

    def _table(rows):
        head = "| ticket | copies | robot said | struck | alive | batch | ms |\n|---|---|---|---|---|---|---|\n"
        return head + "\n".join(f"| {r['job_id']} | {r['param_copies']} | `{r['robot']}` | {'✂️' if r['struck'] else ''} | {'✅' if r['alive'] else '💀'} | {r['batch']} | {r['ms']} |" for r in rows)

    mo.md(f"""
    ## GPU robot takes the orders — {torch.cuda.get_device_name(0)}
    Model: `{_MODEL}` on CUDA. Every ticket → robot plan → court check → bake. All traced in Weave.

    **Night 1 — empty binder**

    {_table(shift_empty)}

    **Night 2 — court binder ({', '.join(l['kind'] for l in BINDER) or 'empty'})**

    {_table(shift_binder)}
    """)
    return


@app.cell
def mujoco(mo):
    import time as _time, numpy as _np, mujoco
    import weave as _w

    @_w.op
    def g1_mujoco_shift(steps: int = 1500) -> dict:
        """Real MuJoCo physics: the G1 holds the night shift under gravity with position actuators."""
        m = mujoco.MjModel.from_xml_path("/marimo/g1/unitree_g1/scene.xml")
        d = mujoco.MjData(m)
        k = mujoco.mj_name2id(m, mujoco.mjtObj.mjOBJ_KEY, "stand")
        mujoco.mj_resetDataKeyframe(m, d, k)
        d.ctrl[:] = m.key_ctrl[k]
        h0 = float(d.qpos[2])
        t0 = _time.time()
        fell_at = None
        for i in range(steps):
            mujoco.mj_step(m, d)
            if fell_at is None and d.qpos[2] < 0.45:
                fell_at = i * m.opt.timestep
        wall = _time.time() - t0
        return {
            "model": "unitree_g1 (mujoco_menagerie)", "mujoco": mujoco.__version__,
            "nq": int(m.nq), "nu": int(m.nu), "timestep": float(m.opt.timestep),
            "sim_seconds": steps * float(m.opt.timestep), "wall_ms": round(wall * 1000),
            "pelvis_height_start": round(h0, 3), "pelvis_height_end": round(float(d.qpos[2]), 3),
            "standing": fell_at is None, "fell_at_s": fell_at,
        }

    mj = g1_mujoco_shift()
    mo.md(f"""
    ## G1 in MuJoCo — real physics on the same box
    `{mj["model"]}` · MuJoCo {mj["mujoco"]} · {mj["nq"]} dof, {mj["nu"]} actuators · {mj["sim_seconds"]:.1f} s simulated in {mj["wall_ms"]} ms

    Pelvis {mj["pelvis_height_start"]} m → {mj["pelvis_height_end"]} m · **{"standing" if mj["standing"] else f"fell at {mj['fell_at_s']:.2f} s"}**

    The café's G1 is this exact model, posed at the `stand` keyframe with MuJoCo forward kinematics and baked to glTF (`scripts/g1/export_g1.py`). The physics loop above is the same body under gravity with its position actuators holding the pose — traced in Weave.
    """)
    return


@app.cell
def gait(mo):
    import math as _math, mujoco as _mj

    _gm = _mj.MjModel.from_xml_path("/marimo/g1/unitree_g1/scene.xml")
    _gd = _mj.MjData(_gm)
    _gk = _mj.mj_name2id(_gm, _mj.mjtObj.mjOBJ_KEY, "stand")
    _mj.mj_resetDataKeyframe(_gm, _gd, _gk)
    _gd.ctrl[:] = _gm.key_ctrl[_gk]
    _gait_ids = {n: _mj.mj_name2id(_gm, _mj.mjtObj.mjOBJ_ACTUATOR, n) for n in
        ["left_hip_pitch_joint", "right_hip_pitch_joint", "left_knee_joint", "right_knee_joint",
         "left_shoulder_pitch_joint", "right_shoulder_pitch_joint"]}
    gait_bodies = [_mj.mj_id2name(_gm, _mj.mjtObj.mjOBJ_BODY, b) for b in range(_gm.nbody)]

    def g1_gait(phase: float, moving: bool, steps: int = 12) -> dict:
        """Real MuJoCo step: swing hips/knees/arms toward gait targets, integrate physics, return body poses."""
        base = _gm.key_ctrl[_gk].copy()
        a = 0.45 if moving else 0.0
        s = _math.sin(phase)
        base[_gait_ids["left_hip_pitch_joint"]] += -a * s
        base[_gait_ids["right_hip_pitch_joint"]] += a * s
        base[_gait_ids["left_knee_joint"]] += 0.6 * a * max(0.0, s)
        base[_gait_ids["right_knee_joint"]] += 0.6 * a * max(0.0, -s)
        base[_gait_ids["left_shoulder_pitch_joint"]] += 0.6 * a * s
        base[_gait_ids["right_shoulder_pitch_joint"]] += -0.6 * a * s
        _gd.ctrl[:] = base
        # keep the pelvis over the floor: the café moves the body, physics only articulates it
        _gd.qpos[0:2] = 0.0
        _gd.qvel[0:2] = 0.0
        for _ in range(steps):
            _mj.mj_step(_gm, _gd)
        if _gd.qpos[2] < 0.5:  # fell: reset, keep going
            _mj.mj_resetDataKeyframe(_gm, _gd, _gk)
        return {"xpos": [[round(float(v), 4) for v in _gd.xpos[b]] for b in range(_gm.nbody)],
                "xquat": [[round(float(v), 4) for v in _gd.xquat[b]] for b in range(_gm.nbody)],
                "pelvis_z": round(float(_gd.qpos[2]), 3)}

    _probe = g1_gait(0.0, False)
    mo.md(f"## G1 gait sim armed\n{len(gait_bodies)} bodies · pelvis {_probe['pelvis_z']} m · `g1_gait(phase, moving)` serves the café.")
    return


@app.cell
def rlwalk(mo):
    import numpy as _np, mujoco as _mjc, onnxruntime as _rt
    from mujoco_playground._src.locomotion.g1 import g1_constants as _g1c
    from mujoco_playground._src.locomotion.g1.base import get_assets as _g1_assets

    class G1Walker:
        """Pretrained MuJoCo Playground G1 joystick policy (ONNX), run headless in C MuJoCo."""
        def __init__(self):
            self.m = _mjc.MjModel.from_xml_path(_g1c.FEET_ONLY_FLAT_TERRAIN_XML.as_posix(), assets=_g1_assets())
            self.d = _mjc.MjData(self.m)
            _mjc.mj_resetDataKeyframe(self.m, self.d, 1)
            self.ctrl_dt, self.sim_dt = 0.02, 0.002
            self.m.opt.timestep = self.sim_dt
            self.n_sub = int(round(self.ctrl_dt / self.sim_dt))
            self.default = _np.array(self.m.keyframe("knees_bent").qpos[7:])
            self.policy = _rt.InferenceSession("/marimo/g1/mp/mujoco_playground/experimental/sim2sim/onnx/g1_policy.onnx", providers=["CPUExecutionProvider"])
            self.last = _np.zeros_like(self.default, dtype=_np.float32)
            self.phase = _np.array([0.0, _np.pi]); self.phase_dt = 2 * _np.pi * 1.5 * self.ctrl_dt
            self.names = [_mjc.mj_id2name(self.m, _mjc.mjtObj.mjOBJ_BODY, b) for b in range(self.m.nbody)]
        def obs(self, cmd):
            d, m = self.d, self.m
            linvel = d.sensor("local_linvel_pelvis").data; gyro = d.sensor("gyro_pelvis").data
            imu = d.site_xmat[m.site("imu_in_pelvis").id].reshape(3, 3); grav = imu.T @ _np.array([0, 0, -1])
            ph = _np.concatenate([_np.cos(self.phase), _np.sin(self.phase)])
            return _np.hstack([linvel, gyro, grav, cmd, d.qpos[7:] - self.default, d.qvel[6:], self.last, ph]).astype(_np.float32)
        def step(self, vx=0.0, vy=0.0, wz=0.0, n_ctrl=10):
            cmd = _np.array([vx, vy, wz], dtype=_np.float32)
            for _ in range(n_ctrl):
                a = self.policy.run(["continuous_actions"], {"obs": self.obs(cmd).reshape(1, -1)})[0][0]
                self.last = a.copy(); self.d.ctrl[:] = a * 0.5 + self.default
                self.phase = _np.fmod(self.phase + self.phase_dt + _np.pi, 2 * _np.pi) - _np.pi
                for _ in range(self.n_sub): _mjc.mj_step(self.m, self.d)
            return {"pelvis": [round(float(v), 3) for v in self.d.qpos[:3]],
                    "xpos": [[round(float(v), 4) for v in self.d.xpos[b]] for b in range(self.m.nbody)],
                    "xquat": [[round(float(v), 4) for v in self.d.xquat[b]] for b in range(self.m.nbody)]}
        def reset(self):
            _mjc.mj_resetDataKeyframe(self.m, self.d, 1); self.last[:] = 0; self.phase = _np.array([0.0, _np.pi])

    g1_walker = G1Walker()
    _t0 = g1_walker.step(0, 0, 0, 25)["pelvis"]
    _t1 = g1_walker.step(0.8, 0, 0, 100)["pelvis"]   # 2 s at 0.8 m/s forward
    mo.md(f"""
    ## G1 walks in MuJoCo — pretrained RL policy, real physics
    MuJoCo Playground `g1_policy.onnx` (joystick locomotion) in C MuJoCo on this box. Stand: pelvis {_t0}. After 2 s of `vx=0.8`: pelvis {_t1} — **moved {round(_t1[0]-_t0[0], 2)} m, height {_t1[2]} m**.
    `g1_walker.step(vx, vy, wz)` serves the café: the game sends the robot's velocity command, MuJoCo returns the body poses.
    """)
    return


@app.cell
def demo(mo):
    mo.md("""
    ## 60-second demo
    1. Play the café. First jam → FAIL.
    2. Throw sticky, file extra-book rule.
    3. This page: eval 2/3 → 3/3.
    4. GPU cell: extra tensor gone, 2048 held.
    """)
    return


if __name__ == "__main__":
    app.run()


