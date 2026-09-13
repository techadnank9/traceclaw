import type {
  Attrs,
  AuditEvent,
  EvalReport,
  JobId,
  Law,
  LawKind,
  Span,
  TicketKind,
  Trace,
} from "./types";

function span(partial: Omit<Span, "children" | "attrs"> & { children?: Span[]; attrs?: Attrs }): Span {
  return { children: [], attrs: {}, ...partial };
}

export function findSpan(root: Span, id: string): Span | null {
  if (root.id === id) return root;
  for (const c of root.children) {
    const hit = findSpan(c, id);
    if (hit) return hit;
  }
  return null;
}

export function flattenSpans(root: Span): Span[] {
  return [root, ...root.children.flatMap(flattenSpans)];
}

function maxCopies(trace: Trace): number {
  return flattenSpans(trace.root).reduce(
    (m, s) => Math.max(m, s.attrs.param_copies ?? 0),
    trace.attrs.param_copies ?? 0,
  );
}

/** Field predicates. Never string-search the tape. */
export function lawMatches(kind: LawKind, trace: Trace): boolean {
  switch (kind) {
    case "cut_batch":
      return trace.batch === 2048;
    case "free_ckpt":
      return maxCopies(trace) > 1;
    default:
      return false;
  }
}

export function admitLaw(kind: LawKind, fail: Trace, successes: Trace[]) {
  const catchesThis = lawMatches(kind, fail);
  const vetoes = successes.filter((t) => lawMatches(kind, t));
  return {
    catchesThis,
    vetoesSuccess: vetoes.length > 0,
    vetoCount: vetoes.length,
    ok: catchesThis && vetoes.length === 0,
  };
}

export const LAW_COPY: Record<
  LawKind,
  { title: string; plain: string; predicate: string }
> = {
  cut_batch: {
    title: "Always bake smaller when the oven screams",
    plain: "If anything runs out of memory, cut the batch in half forever.",
    predicate: "if job.batch == 2048 → trainer.batch_size *= 0.5",
  },
  free_ckpt: {
    title: "Put the extra recipe book back",
    plain:
      "If the recipe book is loaded twice, free the extra copy. Do not touch the batch.",
    predicate: "if load_ckpt.param_copies > 1 → free duplicate; do not change batch",
  },
};

let seq = 0;
export function nextId(prefix: string) {
  seq += 1;
  return `${prefix}-${seq}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function makeAudit(
  action: AuditEvent["action"],
  detail: string,
  extra: Partial<AuditEvent> = {},
): AuditEvent {
  return {
    id: nextId("aud"),
    ts: nowIso(),
    action,
    detail,
    ...extra,
  };
}

/** Idempotent: a kind already on the binder is not filed twice. */
export function existingKind(laws: Law[], kind: LawKind): Law | undefined {
  return laws.find((l) => l.kind === kind && l.status !== "repealed");
}

export function repealIfHitsGold(laws: Law[], successes: Trace[]): Law[] {
  return laws.map((law) => {
    if (law.status !== "admitted") return law;
    if (!successes.some((t) => lawMatches(law.kind, t))) return law;
    return {
      ...law,
      status: "repealed" as const,
      reason: "Repealed. Fired on a night that already worked.",
    };
  });
}

function ckptFail(jobId: JobId, night: string, title: string, id: string): Trace {
  return {
    id,
    jobId,
    night,
    title,
    kitchen: "Huge baking job. Oven screamed: out of room.",
    passed: false,
    why: "Intern blamed the oven. Camera shows the recipe book loaded twice.",
    batch: 2048,
    attrs: { batch: 2048, oom: true, param_copies: 2 },
    firstFaultId: "load-ckpt",
    camera: "fixture",
    weaveUrl: null,
    root: span({
      id: "worker",
      name: "worker.diagnose",
      kind: "agent",
      status: "error",
      input: `${title} step=14102`,
      output: "OOM. Recommend cut batch 2048 → 1024.",
      attrs: { batch: 2048, oom: true },
      children: [
        span({
          id: "llm-plan",
          name: "llm.plan",
          kind: "llm",
          status: "ok",
          input: "blame trainer.batch_size",
          output: "always bake smaller",
        }),
        span({
          id: "load-ckpt",
          name: "tool.load_ckpt",
          kind: "tool",
          status: "error",
          input: "restore weights",
          output: "param_copies=2 expected=1",
          attrs: { param_copies: 2 },
        }),
        span({
          id: "ver",
          name: "verifier.score",
          kind: "verifier",
          status: "error",
          input: "job health",
          output: "JOB_DEAD · 41 min of H100s wasted",
          attrs: { oom: true },
        }),
      ],
    }),
  };
}

function ckptPass(jobId: JobId, night: string, title: string, id: string): Trace {
  return {
    id,
    jobId,
    night,
    title,
    kitchen: "Same oven scream. Extra book put back. Batch stayed big. Job lived.",
    passed: true,
    why: "Statute fired on the first-fault span. Batch size 2048 held.",
    batch: 2048,
    attrs: { batch: 2048, oom: true, param_copies: 1 },
    firstFaultId: null,
    camera: "fixture",
    weaveUrl: null,
    root: span({
      id: "worker",
      name: "worker.diagnose",
      kind: "agent",
      status: "ok",
      input: `${title} consulted binder`,
      output: "freed extra checkpoint · batch 2048 held",
      attrs: { batch: 2048, param_copies: 1 },
      children: [
        span({
          id: "load-ckpt",
          name: "tool.load_ckpt",
          kind: "tool",
          status: "ok",
          input: "restore weights",
          output: "param_copies 2 → 1",
          attrs: { param_copies: 1 },
        }),
        span({
          id: "ver",
          name: "verifier.score",
          kind: "verifier",
          status: "ok",
          input: "job health",
          output: "PASS · job resumed · batch still 2048",
          attrs: { batch: 2048 },
        }),
      ],
    }),
  };
}

export function archiveTrace(): Trace {
  return {
    id: "tr-archive",
    jobId: "archive",
    night: "Last week",
    title: "llama-70b · healthy 2048-batch",
    kitchen: "Big batch. Finished perfectly. Nobody screamed.",
    passed: true,
    why: "Precedent. A law may not punish this night.",
    batch: 2048,
    attrs: { batch: 2048, param_copies: 1, oom: false },
    firstFaultId: null,
    camera: "fixture",
    weaveUrl: null,
    root: span({
      id: "worker",
      name: "worker.train",
      kind: "agent",
      status: "ok",
      input: "llama-70b pretrain",
      output: "completed",
      attrs: { batch: 2048, param_copies: 1 },
      children: [
        span({
          id: "load-ckpt",
          name: "tool.load_ckpt",
          kind: "tool",
          status: "ok",
          input: "restore weights",
          output: "param_copies=1",
          attrs: { param_copies: 1 },
        }),
        span({
          id: "ver",
          name: "verifier.score",
          kind: "verifier",
          status: "ok",
          input: "job health",
          output: "PASS · 2048-batch held",
          attrs: { batch: 2048 },
        }),
      ],
    }),
  };
}

export function serveTicket(
  kind: TicketKind,
  laws: Law[],
): { passed: boolean; books: 1 | 2; why: string; goldHit: boolean } {
  const stickyOn = laws.some((l) => l.kind === "cut_batch" && l.status === "admitted");
  const statuteOn = laws.some((l) => l.kind === "free_ckpt" && l.status === "admitted");
  if (stickyOn) {
    return {
      passed: false,
      books: 1,
      why: "Sticky cut the 2048 batch. Last week would fail too.",
      goldHit: true,
    };
  }
  if (kind === "jam") {
    if (statuteOn) {
      return { passed: true, books: 1, why: "Binder put the extra book back. 2048 held.", goldHit: false };
    }
    return { passed: false, books: 2, why: "Oven jammed. Extra recipe book.", goldHit: false };
  }
  return { passed: true, books: 1, why: "Clean 2048 bake.", goldHit: false };
}

export function forceLaw(kind: LawKind, fail: Trace, laws: Law[]): { law: Law; skipped: boolean } {
  const already = existingKind(laws, kind);
  if (already) return { law: already, skipped: true };
  const copy = LAW_COPY[kind];
  return {
    skipped: false,
    law: {
      id: nextId("law"),
      title: copy.title,
      plain: copy.plain,
      kind,
      predicate: copy.predicate,
      status: "admitted",
      sourceTraceId: fail.id,
      reason: "Manager overrode the court. Reckless sticky is now policy.",
      ts: nowIso(),
    },
  };
}

export function failNight1(): Trace {
  return ckptFail("job_a", "Night 1", "llama-70b pretrain", "tr-night1");
}

export function runNight2(laws: Law[]): Trace {
  const admitted = new Set(
    laws.filter((l) => l.status === "admitted").map((l) => l.kind),
  );
  if (admitted.has("free_ckpt")) {
    return ckptPass("job_b", "Night 2", "llama-70b · same cluster", "tr-night2");
  }
  return ckptFail("job_b", "Night 2", "llama-70b · same cluster", "tr-night2");
}

export function proposeLaw(
  kind: LawKind,
  fail: Trace,
  gold: Trace[],
  laws: Law[],
): { law: Law; skipped: boolean } {
  const already = existingKind(laws, kind);
  if (already) {
    return { law: already, skipped: true };
  }
  const copy = LAW_COPY[kind];
  const verdict = admitLaw(kind, fail, gold);
  const law: Law = {
    id: nextId("law"),
    title: copy.title,
    plain: copy.plain,
    kind,
    predicate: copy.predicate,
    status: verdict.ok ? "admitted" : "rejected",
    sourceTraceId: fail.id,
    reason: verdict.ok
      ? "Filed. Matches tonight’s camera. Leaves last week alone."
      : `Thrown out. Would have punished ${verdict.vetoCount} night that already worked.`,
    ts: nowIso(),
  };
  return { law, skipped: false };
}

export function evaluate(label: string, laws: Law[], gold: Trace): EvalReport {
  const night1 = failNight1();
  const night2 = runNight2(laws);
  const archiveHit = laws.some(
    (l) => l.status === "admitted" && lawMatches(l.kind, gold),
  );
  const cases = [
    {
      name: "archive",
      ok: gold.passed && !archiveHit,
      detail: archiveHit
        ? "An admitted law would have punished last week."
        : "Last week untouched.",
    },
    {
      name: "night1",
      ok: !night1.passed,
      detail: "Night 1 is the incident. It must stay a failure on the docket.",
    },
    {
      name: "night2",
      ok: night2.passed && night2.batch === 2048,
      detail: night2.passed
        ? "Night 2 alive. Batch still 2048."
        : "Night 2 still dead. No admitted law covered the first fault.",
    },
  ];
  return {
    label,
    passed: cases.filter((c) => c.ok).length,
    total: cases.length,
    cases,
  };
}

export function stickyEval(gold: Trace): EvalReport {
  const fake: Law = {
    id: "law-sticky",
    title: LAW_COPY.cut_batch.title,
    plain: LAW_COPY.cut_batch.plain,
    kind: "cut_batch",
    predicate: LAW_COPY.cut_batch.predicate,
    status: "admitted",
    sourceTraceId: "tr-night1",
    reason: "counterfactual",
    ts: nowIso(),
  };
  return evaluate("sticky-note world", [fake], gold);
}
