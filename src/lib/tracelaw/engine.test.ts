import assert from "node:assert/strict";
import { test } from "node:test";
import {
  admitLaw,
  archiveTrace,
  evaluate,
  existingKind,
  failNight1,
  lawMatches,
  proposeLaw,
  repealIfHitsGold,
  runNight2,
  serveTicket,
  stickyEval,
} from "./engine.ts";
import type { Law } from "./types.ts";

test("cut_batch matches archive 2048-batch and is vetoed", () => {
  const fail = failNight1();
  const gold = archiveTrace();
  assert.equal(lawMatches("cut_batch", fail), true);
  assert.equal(lawMatches("cut_batch", gold), true);
  const v = admitLaw("cut_batch", fail, [gold]);
  assert.equal(v.ok, false);
  assert.equal(v.vetoCount, 1);
});

test("free_ckpt matches fail only", () => {
  const fail = failNight1();
  const gold = archiveTrace();
  assert.equal(lawMatches("free_ckpt", fail), true);
  assert.equal(lawMatches("free_ckpt", gold), false);
  const v = admitLaw("free_ckpt", fail, [gold]);
  assert.equal(v.ok, true);
});

test("idempotent file does not duplicate a kind", () => {
  const fail = failNight1();
  const gold = [archiveTrace()];
  const first = proposeLaw("free_ckpt", fail, gold, []);
  assert.equal(first.skipped, false);
  const second = proposeLaw("free_ckpt", fail, gold, [first.law]);
  assert.equal(second.skipped, true);
  assert.equal(existingKind([first.law], "free_ckpt")?.id, first.law.id);
});

test("night 2 lives only after free_ckpt is admitted", () => {
  assert.equal(runNight2([]).passed, false);
  const law: Law = {
    id: "l1",
    title: "x",
    plain: "x",
    kind: "free_ckpt",
    predicate: "x",
    status: "admitted",
    sourceTraceId: "tr-night1",
    reason: "ok",
    ts: "t",
  };
  const n2 = runNight2([law]);
  assert.equal(n2.passed, true);
  assert.equal(n2.batch, 2048);
});

test("eval 2/3 before statute, 3/3 after", () => {
  const gold = archiveTrace();
  const before = evaluate("before", [], gold);
  assert.equal(before.passed, 2);
  const filed = proposeLaw("free_ckpt", failNight1(), [gold], []).law;
  const after = evaluate("after", [filed], gold);
  assert.equal(after.passed, 3);
  const sticky = stickyEval(gold);
  assert.equal(sticky.cases.find((c) => c.name === "archive")?.ok, false);
});

test("serveTicket: jam dies until statute, sticky kills gold runs", () => {
  assert.equal(serveTicket("jam", []).passed, false);
  const filed = proposeLaw("free_ckpt", failNight1(), [archiveTrace()], []).law;
  assert.equal(serveTicket("jam", [filed]).passed, true);
  assert.equal(serveTicket("clean", [filed]).passed, true);
  const sticky: Law = {
    id: "s",
    title: "x",
    plain: "x",
    kind: "cut_batch",
    predicate: "x",
    status: "admitted",
    sourceTraceId: "tr-night1",
    reason: "override",
    ts: "t",
  };
  assert.equal(serveTicket("clean", [sticky]).passed, false);
  assert.equal(serveTicket("clean", [sticky]).goldHit, true);
});

test("repeal if an admitted law later hits gold", () => {
  const poison: Law = {
    id: "bad",
    title: "x",
    plain: "x",
    kind: "cut_batch",
    predicate: "x",
    status: "admitted",
    sourceTraceId: "tr-night1",
    reason: "oops",
    ts: "t",
  };
  const out = repealIfHitsGold([poison], [archiveTrace()]);
  assert.equal(out[0].status, "repealed");
});
