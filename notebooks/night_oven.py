"""THE NIGHT OVEN — paste into molab notebook
https://molab.marimo.io/notebooks/nb_XpnzWXXyteA47H9NYunt5T

Header → notebook specs → attach GPU (RTX PRO 6000).
No Weave key needed for the GPU cell. WANDB_API_KEY is optional traces.
"""

import marimo

__generated_with = "0.13.0"
app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    return (mo,)


@app.cell
def _(mo):
    mo.md(
        r"""
        # THE NIGHT OVEN — GPU lab
        Café floor is the browser game. **This notebook is the camera.**

        | Café | Cluster |
        | --- | --- |
        | 2048 croissants | batch 2048 |
        | Extra recipe book | `param_copies > 1` in VRAM |
        | Oven FAIL | OOM |
        | Sticky ALWAYS BAKE SMALLER | untested agent law |
        | Night-binder | admit only if gold 2048 still lives |
        """
    )
    return


@app.cell
def _():
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
def _(court, mo):
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
def _(mo):
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
    return (ok,)


@app.cell
def _(mo):
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
def _(mo):
    mo.md(
        """
        ## 60-second demo
        1. Play the café. First jam → FAIL.
        2. Throw sticky, file extra-book rule.
        3. This page: eval 2/3 → 3/3.
        4. GPU cell: extra tensor gone, 2048 held.
        """
    )
    return


if __name__ == "__main__":
    app.run()
