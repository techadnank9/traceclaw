"""Weave camera for the night-binder loop.

Every step of the loop is a weave.op: propose a law, veto it against gold,
serve the next night. The three nights form a weave.Dataset; the binder
policies are weave.Models; weave.Evaluation scores each policy on
"job alive AND batch held at 2048".
"""

from __future__ import annotations

import asyncio
import json
import os
import ssl
import urllib.request
from typing import Any

import weave

from court.engine import (
    Law,
    Trace,
    archive,
    admit,
    law_matches,
    night_fail,
    night_pass,
)

NIGHTS = [
    {"job_id": "archive", "param_copies": 1, "batch": 2048, "gold": True},
    {"job_id": "night1", "param_copies": 2, "batch": 2048, "gold": False},
    {"job_id": "night2", "param_copies": 2, "batch": 2048, "gold": False},
]


def _trace_for(row: dict) -> Trace:
    if row["gold"]:
        return archive()
    return night_fail(row["job_id"], f"tr-{row['job_id']}")


@weave.op
def propose_law(kind: str, reason: str) -> dict:
    """Intern slaps a sticky note. Nothing is admitted yet."""
    return {"kind": kind, "reason": reason, "predicate": "batch==2048" if kind == "cut_batch" else "param_copies>1"}


@weave.op
def veto_against_gold(law: dict, fail_job: str) -> dict:
    """Court: file only if it matches THIS failure and never a night that already worked."""
    gold = archive()
    fail = night_fail(fail_job, f"tr-{fail_job}")
    verdict = admit(law["kind"], fail, [gold])
    status = "admitted" if verdict["ok"] else "rejected"
    return {**law, "status": status, "catches_failure": verdict["catches"], "gold_vetoes": verdict["veto_count"]}


@weave.op
def serve_night(job_id: str, param_copies: int, batch: int, binder: list[dict]) -> dict:
    """Worker reads the binder, then bakes. Returns whether the job lived and at what batch."""
    admitted = {l["kind"] for l in binder if l.get("status") == "admitted"}
    if "free_ckpt" in admitted and param_copies > 1:
        return {"job_id": job_id, "action": "free_duplicate", "alive": True, "batch": batch, "param_copies": 1}
    if "cut_batch" in admitted and batch == 2048:
        return {"job_id": job_id, "action": "cut_batch", "alive": True, "batch": batch // 2, "param_copies": param_copies}
    if param_copies > 1:
        return {"job_id": job_id, "action": "oom", "alive": False, "batch": batch, "param_copies": param_copies}
    return {"job_id": job_id, "action": "noop", "alive": True, "batch": batch, "param_copies": param_copies}


@weave.op
def jev_second_opinion(law: dict, fail_job: str) -> dict:
    """TypeSafe Jev (System One) answers three typed questions about the same evidence."""
    key = os.environ.get("TYPESAFE_API_KEY", "").strip()
    if not key:
        return {"camera": "offline"}
    fail = night_fail(fail_job, f"tr-{fail_job}")
    gold = archive()
    body = {
        "state": {
            "law": {k: law[k] for k in ("kind", "predicate", "reason", "status") if k in law},
            "failed_night": {"job_id": fail.job_id, "passed": fail.passed, **fail.attrs},
            "gold_night": {"job_id": gold.job_id, "passed": gold.passed, **gold.attrs},
        },
        "model": "jev-latest",
        "questions": {
            "catches_failure": {"type": "noul", "instructions": "The proposed law's predicate is true for the failed night's attributes, so the law would have caught this failure."},
            "punishes_gold": {"type": "noul", "instructions": "The proposed law's predicate is also true for the gold night, a night that already worked, so filing it would punish a success."},
            "verdict": {"type": "choice", "instructions": "Should the night-binder court admit this law? Admit only if it matches the failed night AND would not have fired on the gold night.", "criteria": {"admit": "Explains the failure and leaves the gold night alone", "reject": "Either misses the failure or would have punished the gold night"}},
        },
    }
    req = urllib.request.Request(
        "https://api.typesafe.ai/v1/systemone",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    try:
        try:
            import certifi  # macOS python.org builds ship no CA bundle

            ctx = ssl.create_default_context(cafile=certifi.where())
        except ImportError:
            ctx = ssl.create_default_context()
        with urllib.request.urlopen(req, timeout=15, context=ctx) as r:
            a = json.load(r)["answers"]
    except Exception as e:  # noqa: BLE001
        return {"camera": "offline", "error": str(e)[:120]}
    return {
        "camera": "typesafe",
        "verdict": a["verdict"]["choice"],
        "confidence": a["verdict"]["confidence"],
        "probabilities": a["verdict"]["probabilities"],
        "catches_failure": a["catches_failure"]["noul"],
        "punishes_gold": a["punishes_gold"]["noul"],
    }


class BinderPolicy(weave.Model):
    """A binder = the set of laws the worker is allowed to read tonight."""

    name: str
    binder: list[dict]

    @weave.op
    def predict(self, job_id: str, param_copies: int, batch: int, gold: bool) -> dict:
        return serve_night(job_id, param_copies, batch, self.binder)


@weave.op
def alive_at_2048(gold: bool, output: dict) -> dict:
    """Score: job lives AND huge loaf held. Gold nights must never be punished."""
    alive = bool(output["alive"])
    held = output["batch"] == 2048
    return {"alive": alive, "batch_held": held, "pass": alive and held, "gold_punished": gold and not (alive and held)}


async def run() -> dict[str, Any]:
    dataset = weave.Dataset(name="night-oven-nights", rows=NIGHTS)
    weave.publish(dataset)

    sticky = veto_against_gold(propose_law("cut_batch", "always bake smaller"), "night1")
    narrow = veto_against_gold(propose_law("free_ckpt", "put the extra book back"), "night1")
    jev = {"sticky": jev_second_opinion(sticky, "night1"), "narrow": jev_second_opinion(narrow, "night1")}

    policies = [
        BinderPolicy(name="no-binder", binder=[]),
        BinderPolicy(name="sticky-forced", binder=[{**sticky, "status": "admitted"}]),
        BinderPolicy(name="court-binder", binder=[sticky, narrow]),
    ]
    evaluation = weave.Evaluation(name="night-binder-eval", dataset=dataset, scorers=[alive_at_2048])
    results = {}
    for p in policies:
        results[p.name] = await evaluation.evaluate(p, __weave={"display_name": p.name})
    return {"sticky": sticky, "narrow": narrow, "jev": jev, "eval": results}


def main(entity: str, project: str) -> int:
    name = f"{entity}/{project}" if entity else project
    weave.init(name)
    out = asyncio.run(run())
    summary = {k: v.get("alive_at_2048", {}) for k, v in out["eval"].items()}
    jev = {k: (f"{v.get('verdict')} {v.get('confidence')}" if v.get("camera") == "typesafe" else "offline") for k, v in out["jev"].items()}
    print(json.dumps({"sticky": out["sticky"]["status"], "narrow": out["narrow"]["status"], "jev": jev, "eval": summary}, indent=2, default=str))
    court = summary.get("court-binder", {}).get("pass", {}).get("true_fraction")
    return 0 if court == 1.0 else 1
