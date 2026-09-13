import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "muted",
  children,
}: {
  className?: string;
  tone?: "muted" | "ok" | "danger" | "warn" | "accent";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tracking-wide uppercase",
        tone === "muted" && "bg-subtle text-muted",
        tone === "ok" && "bg-ok/15 text-ok",
        tone === "danger" && "bg-danger/15 text-danger",
        tone === "warn" && "bg-warn/15 text-warn",
        tone === "accent" && "bg-accent/15 text-fg",
        className,
      )}
    >
      {children}
    </span>
  );
}
