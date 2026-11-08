import type { AlgorithmUsage } from "../../api/algorithms";

export function AlgorithmUsage({ usage }: { usage?: AlgorithmUsage }) {
  if (!usage)
    return (
      <p className="text-sm text-muted">
        Select a version to load bounded operational run usage.
      </p>
    );
  return (
    <div className="space-y-3">
      <p className="m-0 text-sm text-muted">
        {usage.total_runs} run(s) · statuses:{" "}
        {Object.entries(usage.status_counts)
          .map(([status, count]) => `${status} ${count}`)
          .join(", ") || "none"}
      </p>
      {usage.items.map((run) => (
        <a
          key={run.id}
          href={`/backtests/${run.id}`}
          className="block rounded-lg border border-border p-3 text-sm hover:bg-surface-subtle"
        >
          <strong className="text-foreground">
            {run.status} · {run.mode}
          </strong>
          <p className="m-0 mt-1 text-xs text-muted">
            {run.created_at} · {run.synthetic ? "Synthetic" : "Non-synthetic"} ·{" "}
            {run.unit} · financial P&L unavailable
          </p>
        </a>
      ))}
    </div>
  );
}
