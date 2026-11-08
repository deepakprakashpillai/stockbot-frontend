import type { ChartSeries } from "./chartTypes";

export function ChartLegend({
  series,
  visibleSeries,
  onToggle,
}: {
  series: ChartSeries[];
  visibleSeries: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      aria-label="Visible chart series"
    >
      {series.map((item) => {
        const visible = visibleSeries.includes(item.id);
        return (
          <button
            type="button"
            key={item.id}
            aria-pressed={visible}
            onClick={() => onToggle(item.id)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${visible ? "border-border bg-surface text-foreground shadow-sm hover:border-brand/40" : "border-transparent bg-surface-subtle text-muted line-through hover:bg-surface"}`}
          >
            <span
              className="h-2.5 w-2.5 rounded-sm border border-white/30"
              style={{
                backgroundColor: visible ? item.color : "var(--border-strong)",
              }}
              aria-hidden="true"
            />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
