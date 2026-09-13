import { findSpan, flattenSpans } from "@/lib/tracelaw/engine";
import type { Span, Trace } from "@/lib/tracelaw/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function Node({
  span,
  faultId,
  depth,
}: {
  span: Span;
  faultId: string | null;
  depth: number;
}) {
  const isFault = span.id === faultId;
  return (
    <div className={cn(depth > 0 && "ml-3 border-l border-border pl-3")}>
      <div
        className={cn(
          "rounded-sm px-3 py-2",
          isFault ? "bg-danger/10 ring-1 ring-danger/40" : "bg-subtle",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-fg">{span.name}</span>
          <Badge tone={span.kind === "tool" ? "warn" : "muted"}>{span.kind}</Badge>
          <Badge tone={span.status === "ok" ? "ok" : "danger"}>{span.status}</Badge>
          {isFault ? <Badge tone="danger">first fault</Badge> : null}
        </div>
        <p className="mt-1 font-mono text-xs text-muted break-words">{span.output}</p>
        {span.attrs && Object.keys(span.attrs).length > 0 ? (
          <p className="mt-1 font-mono text-xs text-faint">
            {Object.entries(span.attrs)
              .map(([k, v]) => `${k}=${String(v)}`)
              .join(" · ")}
          </p>
        ) : null}
      </div>
      <div className="mt-2 flex flex-col gap-2">
        {span.children.map((c) => (
          <Node key={c.id} span={c} faultId={faultId} depth={depth + 1} />
        ))}
      </div>
    </div>
  );
}

export function TraceTree({ trace }: { trace: Trace }) {
  const fault = trace.firstFaultId ? findSpan(trace.root, trace.firstFaultId) : null;
  const count = flattenSpans(trace.root).length;
  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-widest text-faint">
            The camera · {trace.camera} replay
          </p>
          <h2 className="font-display text-xl text-fg">{trace.title}</h2>
        </div>
        <p className="font-mono text-xs tabular-nums text-muted">{count} spans</p>
      </header>
      <p className="text-sm text-muted">{trace.why}</p>
      {fault ? (
        <p className="text-sm text-fg">
          First fault pinned at <span className="font-mono">{fault.name}</span>. The
          intern’s story is ignored.
        </p>
      ) : (
        <p className="text-sm text-ok">No fault. This night is precedent.</p>
      )}
      <Node span={trace.root} faultId={trace.firstFaultId} depth={0} />
    </section>
  );
}
