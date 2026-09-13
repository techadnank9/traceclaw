import shift from "../../../fixtures/robot-shift.json";
import { Button } from "@/components/ui/button";

type Row = {
  job_id: string;
  param_copies: number;
  robot: string;
  struck: boolean;
  alive: boolean;
  batch: number;
  ms: number;
};

/** GPU robot shift: what the CUDA model chose per ticket, with and without the court binder. */
export function RobotShift({ onClose }: { onClose?: () => void }) {
  return (
    <div className="max-w-2xl rounded-xl bg-elevated p-5 text-left shadow-sheet">
      <p className="text-xs uppercase tracking-widest text-muted">GPU robot · {shift.device}</p>
      <h2 className="mt-1 font-display text-2xl">Robot takes the orders</h2>
      <p className="mt-1 text-sm text-muted">
        <span className="font-mono">{shift.model}</span> on CUDA reads each ticket and the binder, picks an action.
        The court strikes anything not admitted. Every step is a Weave trace.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <ShiftTable title="Empty binder" rows={shift.empty as Row[]} tone="danger" />
        <ShiftTable title={`Court binder · ${shift.laws.join(", ") || "none"}`} rows={shift.binder as Row[]} tone="ok" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" asChild>
          <a href={shift.weave} target="_blank" rel="noreferrer">
            Weave traces
          </a>
        </Button>
        <Button size="sm" variant="secondary" asChild>
          <a href="https://molab.marimo.io/notebooks/nb_XpnzWXXyteA47H9NYunt5T" target="_blank" rel="noreferrer">
            molab notebook
          </a>
        </Button>
        {onClose ? (
          <Button size="sm" onClick={onClose}>
            Back
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ShiftTable({ title, rows, tone }: { title: string; rows: Row[]; tone: "ok" | "danger" }) {
  return (
    <div className={tone === "ok" ? "rounded-md bg-ok/10 p-3" : "rounded-md bg-danger/10 p-3"}>
      <p className="text-xs uppercase tracking-widest">{title}</p>
      <table className="mt-2 w-full font-mono text-xs">
        <thead className="text-muted">
          <tr>
            <th className="text-left font-normal">ticket</th>
            <th className="text-left font-normal">robot</th>
            <th className="text-right font-normal">batch</th>
            <th className="text-right font-normal">ms</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.job_id}>
              <td>{r.job_id}</td>
              <td>
                {r.robot}
                {r.struck ? " ✂" : ""}
              </td>
              <td className="text-right">
                {r.alive ? "✓" : "✗"} {r.batch}
              </td>
              <td className="text-right">{r.ms}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
