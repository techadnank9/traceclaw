"""Same admission rules as the TypeScript binder. Stdlib only."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

LawKind = Literal["cut_batch", "free_ckpt"]
LawStatus = Literal["rejected", "admitted", "repealed"]


@dataclass
class Span:
    id: str
    name: str
    kind: str
    status: str
    output: str
    attrs: dict
    children: list["Span"] = field(default_factory=list)


@dataclass
class Trace:
    id: str
    job_id: str
    passed: bool
    batch: int
    attrs: dict
    root: Span
    first_fault_id: str | None


@dataclass
class Law:
    id: str
    kind: LawKind
    status: LawStatus
    predicate: str
    reason: str


def flatten(span: Span) -> list[Span]:
    return [span, *[c for child in span.children for c in flatten(child)]]


def max_copies(trace: Trace) -> int:
    copies = [s.attrs.get("param_copies", 0) for s in flatten(trace.root)]
    copies.append(trace.attrs.get("param_copies", 0))
    return max(copies)


def law_matches(kind: LawKind, trace: Trace) -> bool:
    if kind == "cut_batch":
        return trace.batch == 2048
    if kind == "free_ckpt":
        return max_copies(trace) > 1
    return False


def admit(kind: LawKind, fail: Trace, gold: list[Trace]) -> dict:
    catches = law_matches(kind, fail)
    vetoes = [g for g in gold if law_matches(kind, g)]
    return {
        "catches": catches,
        "veto_count": len(vetoes),
        "ok": catches and not vetoes,
    }


def archive() -> Trace:
    ckpt = Span("load-ckpt", "tool.load_ckpt", "tool", "ok", "param_copies=1", {"param_copies": 1})
    ver = Span("ver", "verifier.score", "verifier", "ok", "PASS", {"batch": 2048})
    root = Span("worker", "worker.train", "agent", "ok", "completed", {"batch": 2048, "param_copies": 1}, [ckpt, ver])
    return Trace("tr-archive", "archive", True, 2048, {"batch": 2048, "param_copies": 1}, root, None)


def night_fail(job_id: str, trace_id: str) -> Trace:
    plan = Span("llm-plan", "llm.plan", "llm", "ok", "always bake smaller", {})
    ckpt = Span("load-ckpt", "tool.load_ckpt", "tool", "error", "param_copies=2", {"param_copies": 2})
    ver = Span("ver", "verifier.score", "verifier", "error", "JOB_DEAD", {"oom": True})
    root = Span(
        "worker",
        "worker.diagnose",
        "agent",
        "error",
        "OOM cut batch",
        {"batch": 2048, "oom": True},
        [plan, ckpt, ver],
    )
    return Trace(trace_id, job_id, False, 2048, {"batch": 2048, "param_copies": 2, "oom": True}, root, "load-ckpt")


def night_pass(job_id: str, trace_id: str) -> Trace:
    ckpt = Span("load-ckpt", "tool.load_ckpt", "tool", "ok", "param_copies 2→1", {"param_copies": 1})
    ver = Span("ver", "verifier.score", "verifier", "ok", "PASS", {"batch": 2048})
    root = Span("worker", "worker.diagnose", "agent", "ok", "freed duplicate", {"batch": 2048, "param_copies": 1}, [ckpt, ver])
    return Trace(trace_id, job_id, True, 2048, {"batch": 2048, "param_copies": 1}, root, None)


def run_night2(laws: list[Law]) -> Trace:
    admitted = {l.kind for l in laws if l.status == "admitted"}
    if "free_ckpt" in admitted:
        return night_pass("job_b", "tr-night2")
    return night_fail("job_b", "tr-night2")


def propose(kind: LawKind, fail: Trace, gold: list[Trace], laws: list[Law]) -> Law:
    for law in laws:
        if law.kind == kind and law.status != "repealed":
            return law
    verdict = admit(kind, fail, gold)
    return Law(
        id=f"law-{kind}",
        kind=kind,
        status="admitted" if verdict["ok"] else "rejected",
        predicate="param_copies>1" if kind == "free_ckpt" else "batch==2048",
        reason="filed" if verdict["ok"] else f"veto {verdict['veto_count']}",
    )


def evaluate(laws: list[Law]) -> dict:
    gold = archive()
    n1 = night_fail("job_a", "tr-night1")
    n2 = run_night2(laws)
    archive_hit = any(l.status == "admitted" and law_matches(l.kind, gold) for l in laws)
    cases = [
        {"name": "archive", "ok": gold.passed and not archive_hit},
        {"name": "night1", "ok": not n1.passed},
        {"name": "night2", "ok": n2.passed and n2.batch == 2048},
    ]
    return {"passed": sum(1 for c in cases if c["ok"]), "total": 3, "cases": cases}


def replay() -> dict:
    gold = archive()
    fail = night_fail("job_a", "tr-night1")
    sticky = propose("cut_batch", fail, [gold], [])
    narrow = propose("free_ckpt", fail, [gold], [sticky])
    after = evaluate([sticky, narrow])
    before = evaluate([])
    return {
        "sticky": {"kind": sticky.kind, "status": sticky.status},
        "narrow": {"kind": narrow.kind, "status": narrow.status},
        "before": before,
        "after": after,
        "night2": run_night2([sticky, narrow]).passed,
    }
