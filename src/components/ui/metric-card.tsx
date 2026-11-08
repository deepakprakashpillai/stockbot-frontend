import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type MetricCardProps = {
  label: string;
  value: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  className?: string;
};

export function MetricCard({
  label,
  value,
  description,
  icon,
  className,
}: MetricCardProps) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card p-5 text-card-foreground",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight tabular-nums text-foreground">
        {value}
      </div>
      {description && (
        <div className="mt-2 text-sm leading-5 text-muted-foreground">
          {description}
        </div>
      )}
    </section>
  );
}
