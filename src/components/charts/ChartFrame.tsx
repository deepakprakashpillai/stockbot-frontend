import { useId } from "react";
import type { KeyboardEvent, ReactNode } from "react";

import type { ChartView } from "./chartTypes";

export function ChartFrame({
  title,
  description,
  controls,
  legend,
  insight,
  view,
  chart,
  table,
  onKeyDown,
  status,
  isExpanded = false,
}: {
  title: string;
  description: string;
  controls: ReactNode;
  legend: ReactNode;
  insight?: ReactNode;
  view: ChartView;
  chart: ReactNode;
  table: ReactNode;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  status: string;
  isExpanded?: boolean;
}) {
  const uniqueId = useId();
  const headingId = `chart-heading-${uniqueId}`;
  return (
    <section
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-labelledby={headingId}
      className={`w-full overflow-hidden rounded-xl border border-border bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${isExpanded ? "min-h-full p-3 sm:p-5" : "p-3 sm:p-5"}`}
    >
      <div className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-brand">
            Research workspace
          </p>
          <h3
            id={headingId}
            className="m-0 mt-1 text-base font-semibold tracking-tight text-foreground sm:text-lg"
          >
            {title}
          </h3>
          <p className="m-0 mt-1 max-w-2xl text-xs leading-5 text-muted">
            {description}
          </p>
        </div>
        <div className="shrink-0 rounded-lg border border-border bg-surface-subtle p-1">
          {controls}
        </div>
      </div>
      {(insight || legend) && (
        <div className="mt-3 flex flex-col gap-3 border-b border-border/70 pb-3 xl:flex-row xl:items-center xl:justify-between">
          {insight}
          {legend}
        </div>
      )}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {status}
      </div>
      <div
        className={
          isExpanded
            ? "mt-4 h-[min(68vh,680px)]"
            : "mt-4 h-[320px] sm:h-[380px] lg:h-[420px]"
        }
      >
        {view === "chart" ? chart : table}
      </div>
    </section>
  );
}
