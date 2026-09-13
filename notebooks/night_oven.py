"""THE NIGHT OVEN — molab GPU notebook (mirror of the live molab kernel)
https://molab.marimo.io/notebooks/nb_XpnzWXXyteA47H9NYunt5T

Header → notebook specs → attach GPU (RTX PRO 6000).
Cells were written into the running kernel by a coding agent via marimo pair.
WANDB_API_KEY / WANDB_ENTITY in the kernel env are optional (Weave camera).
"""

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

            weave.init(os.environ.get("WANDB_ENTITY", "night-oven") + "/night-oven")
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


