import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const DATA = [
  { name: "Last week", sticky: 0, binder: 100 },
  { name: "Night 1", sticky: 0, binder: 0 },
  { name: "Night 2", sticky: 0, binder: 100 },
];

export function ScoreChart() {
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={DATA} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid
            stroke="color-mix(in oklab, var(--color-fg) 10%, transparent)"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            tick={{ fill: "var(--color-muted)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "var(--color-muted)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-elevated)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              color: "var(--color-fg)",
              fontSize: 12,
            }}
          />
          <Bar dataKey="sticky" fill="var(--color-danger)" name="Sticky note" radius={4} />
          <Bar dataKey="binder" fill="var(--color-ok)" name="Night binder" radius={4} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
