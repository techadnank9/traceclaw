"""CLI: python3 -m court replay | eval | weave"""

from __future__ import annotations

import json
import os
import sys

from court.engine import archive, evaluate, night_fail, propose, replay


from pathlib import Path


def load_dotenv() -> None:
    """Read a local .env into os.environ. Existing env wins. No extra package."""
    path = Path(__file__).resolve().parent.parent / ".env"
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        if key and key not in os.environ:
            os.environ[key] = value


def cmd_replay() -> int:
    result = replay()
    print(json.dumps(result, indent=2))
    ok = (
        result["sticky"]["status"] == "rejected"
        and result["narrow"]["status"] == "admitted"
        and result["night2"] is True
        and result["after"]["passed"] == 3
        and result["before"]["passed"] == 2
    )
    print("PASS court replay" if ok else "FAIL court replay")
    return 0 if ok else 1


def cmd_eval() -> int:
    before = evaluate([])
    law = propose("free_ckpt", night_fail("job_a", "tr-night1"), [archive()], [])
    after = evaluate([law])
    print(json.dumps({"before": before, "after": after}, indent=2))
    ok = before["passed"] == 2 and after["passed"] == 3
    print("PASS eval 2/3 → 3/3" if ok else "FAIL eval")
    return 0 if ok else 1


def cmd_weave() -> int:
    key = os.environ.get("WANDB_API_KEY")
    project = os.environ.get("WANDB_PROJECT", "tracelaw")
    entity = os.environ.get("WANDB_ENTITY", "superhero")
    if not key:
        print("camera offline: WANDB_API_KEY unset. Replaying fixtures.")
        return cmd_replay()
    try:
        import weave  # type: ignore
    except ImportError:
        print("camera offline: weave not installed. pip install weave")
        return cmd_replay()

    name = f"{entity}/{project}" if entity else project
    weave.init(name)

    @weave.op
    def load_ckpt(job_id: str) -> dict:
        if job_id == "archive":
            return {"param_copies": 1, "batch": 2048}
        return {"param_copies": 2, "batch": 2048}

    @weave.op
    def diagnose(job_id: str, statutes: list[dict]) -> dict:
        ckpt = load_ckpt(job_id)
        admitted = {s["kind"] for s in statutes if s.get("status") == "admitted"}
        if "free_ckpt" in admitted and ckpt["param_copies"] > 1:
            return {"action": "free_duplicate", "alive": True, "batch": ckpt["batch"], "param_copies": 1}
        if ckpt["param_copies"] > 1:
            return {"action": "cut_batch", "alive": False, "batch": 1024, "param_copies": ckpt["param_copies"]}
        return {"action": "noop", "alive": True, **ckpt}

    gold = diagnose("archive", [])
    fail = diagnose("night1", [])
    after = diagnose("night2", [{"kind": "free_ckpt", "status": "admitted"}])
    print(json.dumps({"archive": gold, "night1": fail, "night2": after, "project": name}, indent=2))
    ok = gold["alive"] and not fail["alive"] and after["alive"] and after["batch"] == 2048
    return 0 if ok else 1


def main(argv: list[str]) -> int:
    load_dotenv()
    cmd = argv[1] if len(argv) > 1 else "replay"
    if cmd == "replay":
        return cmd_replay()
    if cmd == "eval":
        return cmd_eval()
    if cmd == "weave":
        return cmd_weave()
    print("usage: python3 -m court [replay|eval|weave]")
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
