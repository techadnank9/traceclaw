export type SpanKind = "agent" | "llm" | "tool" | "verifier";
export type SpanStatus = "ok" | "error";

export type Attrs = {
  batch?: number;
  param_copies?: number;
  oom?: boolean;
};

export type Span = {
  id: string;
  name: string;
  kind: SpanKind;
  status: SpanStatus;
  input: string;
  output: string;
  attrs: Attrs;
  children: Span[];
};

export type JobId = "archive" | "job_a" | "job_b";

export type CameraKind = "fixture" | "weave";

export type Trace = {
  id: string;
  jobId: JobId;
  night: string;
  title: string;
  kitchen: string;
  passed: boolean;
  why: string;
  batch: number;
  attrs: Attrs;
  root: Span;
  firstFaultId: string | null;
  camera: CameraKind;
  weaveUrl: string | null;
};

export type LawKind = "cut_batch" | "free_ckpt";

export type LawStatus = "rejected" | "admitted" | "repealed";

export type Law = {
  id: string;
  title: string;
  plain: string;
  kind: LawKind;
  predicate: string;
  status: LawStatus;
  sourceTraceId: string;
  reason: string;
  ts: string;
};

export type AuditEvent = {
  id: string;
  ts: string;
  action: "reject" | "admit" | "skip" | "repeal" | "night2" | "eval";
  lawKind?: LawKind;
  traceId?: string;
  detail: string;
};

export type EvalCase = {
  name: string;
  ok: boolean;
  detail: string;
};

export type EvalReport = {
  label: string;
  passed: number;
  total: number;
  cases: EvalCase[];
};

export type Phase = "briefing" | "night1" | "veto" | "filed" | "night2";

export type Mode = "menu" | "shift" | "court" | "results";
export type Station = "idle" | "jules" | "cass" | "oven";
export type TicketKind = "clean" | "jam";

export type Ticket = {
  id: string;
  kind: TicketKind;
  patience: number;
  maxPatience: number;
};

export type Beat =
  | "title"
  | "order"
  | "take"
  | "pass"
  | "cook"
  | "fail"
  | "sticky"
  | "veto"
  | "file"
  | "stamped"
  | "order2"
  | "take2"
  | "pass2"
  | "cook2"
  | "win";


