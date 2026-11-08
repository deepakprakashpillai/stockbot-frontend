import { useMemo, useState, type FormEvent } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { cn } from "@/lib/utils";
import { AppSelect } from "@/components/ui/app-select";

import {
  listBacktests,
  type BacktestFilters,
  type BacktestCatalogRun,
} from "../../api/backtests";
import { ApiError } from "../../api/system";
import { formatPlatformDateTime } from "../../lib/dateTime";

const statuses = ["", "PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"];

function ErrorText({ error }: { error: unknown }) {
  if (!(error instanceof ApiError)) return null;
  return (
    <p className="mb-4 text-sm font-medium text-danger" role="alert">
      {error.message}
      {error.requestId ? ` Request ID: ${error.requestId}` : ""}
    </p>
  );
}

function RunCard({
  run,
  selection,
}: {
  run: BacktestCatalogRun;
  selection?: {
    selected: boolean;
    disabled: boolean;
    toggle: (runId: string) => void;
  };
}) {
  const failure = run.status === "FAILED" ? run.error_message : null;
  return (
    <article className="flex flex-col rounded-xl border border-border bg-surface p-6 shadow-sm transition-transform hover:-translate-y-1">
      <div className="mb-4 flex items-center justify-between border-b border-border pb-4">
        {selection ? (
          <label className="flex items-center gap-2 text-sm font-medium text-muted">
            <input
              type="checkbox"
              className="rounded border-border text-brand focus:ring-brand"
              checked={selection.selected}
              disabled={selection.disabled && !selection.selected}
              onChange={() => selection.toggle(run.id)}
              aria-label={`Select run ${run.id.slice(0, 8)} for comparison`}
            />
            Compare
          </label>
        ) : (
          <div />
        )}
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
            run.status === "COMPLETED"
              ? "bg-success/10 text-success"
              : run.status === "FAILED"
                ? "bg-danger/10 text-danger"
                : "bg-warning/10 text-warning",
          )}
        >
          {run.status}
        </span>
      </div>
      <h3 className="mb-4 text-lg font-bold text-foreground">
        <Link
          className="hover:text-brand hover:underline"
          to={`/backtests/${run.id}`}
        >
          Run {run.id.slice(0, 8)}
        </Link>
      </h3>
      <dl className="mb-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-muted">Mode</dt>
          <dd className="font-medium text-foreground">{run.mode}</dd>
        </div>
        <div>
          <dt className="text-muted">Range</dt>
          <dd className="font-medium text-foreground">
            {run.start_date} → {run.end_date}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted">Created</dt>
          <dd className="font-medium text-foreground">
            {formatPlatformDateTime(run.created_at)}
          </dd>
        </div>
      </dl>
      {failure && (
        <p className="mb-2 text-sm text-danger">Failure: {failure}</p>
      )}
      {run.status === "CANCELLED" && (
        <p className="mb-2 text-sm text-muted">
          Cancelled safely. No result was finalized.
        </p>
      )}
      <p className="mt-auto pt-4 text-xs font-medium text-brand">
        Synthetic · DEMO_UNITS · non-financial
      </p>
    </article>
  );
}

export function BacktestCatalog({
  selectable = false,
  selectedRunIds = [],
  onSelectionChange,
  initialCompletedOnly = false,
}: {
  selectable?: boolean;
  selectedRunIds?: string[];
  onSelectionChange?: (runIds: string[]) => void;
  initialCompletedOnly?: boolean;
}) {
  const [draft, setDraft] = useState<BacktestFilters>({
    status: initialCompletedOnly ? "COMPLETED" : "",
    mode: "PLATFORM_DEMO",
  });
  const [filters, setFilters] = useState(draft);
  const queryKey = useMemo(() => JSON.stringify(filters), [filters]);
  const runs = useInfiniteQuery({
    queryKey: ["backtest-catalog", queryKey],
    queryFn: ({ pageParam }) => listBacktests(filters, pageParam, 12),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
  });
  const items = useMemo(
    () => runs.data?.pages.flatMap((page) => page.items) ?? [],
    [runs.data],
  );
  const total = runs.data?.pages[0]?.total_count ?? items.length;

  // Chart Analytics Data
  const frequencyData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      const date = item.created_at ? item.created_at.slice(0, 10) : "Unknown";
      counts[date] = (counts[date] || 0) + 1;
    }
    return Object.entries(counts).map(([date, count]) => ({ date, count }));
  }, [items]);

  const statusDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      counts[item.status] = (counts[item.status] || 0) + 1;
    }
    const colors: Record<string, string> = {
      COMPLETED: "#10b981",
      FAILED: "#ef4444",
      RUNNING: "#8c52ff",
      CANCELLED: "#f59e0b",
      PENDING: "#6b7280",
    };
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      color: colors[name] || "#8c52ff",
    }));
  }, [items]);

  function submit(event: FormEvent) {
    event.preventDefault();
    setFilters({ ...draft });
  }

  function toggle(runId: string) {
    if (!onSelectionChange) return;
    onSelectionChange(
      selectedRunIds.includes(runId)
        ? selectedRunIds.filter((id) => id !== runId)
        : [...selectedRunIds, runId],
    );
  }

  return (
    <section
      className="flex flex-col gap-6"
      aria-labelledby="run-history-heading"
    >
      <div className="flex items-end justify-between border-b border-border pb-4">
        <div>
          <p className="text-xs font-medium leading-none text-brand">
            Durable history
          </p>
          <h2
            id="run-history-heading"
            className="mt-2 text-xl font-bold text-foreground"
          >
            Backtest run catalog
          </h2>
        </div>
        <span className="text-sm text-muted" aria-live="polite">
          {total} matching runs
        </span>
      </div>

      {/* Analytics Summary */}
      {items.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-xl border border-border bg-surface p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-foreground m-0 mb-3">
              Execution History Frequency
            </h3>
            <div className="h-[140px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={frequencyData}
                  margin={{ top: 5, right: 10, left: -25, bottom: 0 }}
                >
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "var(--muted)" }}
                    stroke="var(--border)"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--muted)" }}
                    stroke="var(--border)"
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--surface)",
                      borderColor: "var(--border)",
                      borderRadius: "8px",
                      fontSize: "11px",
                    }}
                  />
                  <Bar dataKey="count" fill="#8c52ff" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm flex flex-col justify-between">
            <h3 className="text-xs font-semibold text-foreground m-0">
              Status Breakdown
            </h3>
            <div className="h-[100px] w-full my-auto">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={45}
                    dataKey="value"
                  >
                    {statusDistribution.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--surface)",
                      borderColor: "var(--border)",
                      borderRadius: "8px",
                      fontSize: "11px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-2 justify-center text-[11px]">
              {statusDistribution.map((s) => (
                <span
                  key={s.name}
                  className="flex items-center gap-1 text-muted"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  {s.name}:{" "}
                  <strong className="text-foreground">{s.value}</strong>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <form
        className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-surface p-6 shadow-sm md:grid-cols-2 lg:grid-cols-4"
        onSubmit={submit}
      >
        <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
          Status
          <AppSelect
            value={draft.status || "__all__"}
            ariaLabel="Status"
            placeholder="All statuses"
            onValueChange={(value) =>
              setDraft({
                ...draft,
                status: value === "__all__" ? "" : value,
              })
            }
            options={statuses.map((status) => ({
              value: status || "__all__",
              label: status || "All statuses",
            }))}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
          Dataset version ID
          <input
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            value={draft.datasetVersionId ?? ""}
            onChange={(event) =>
              setDraft({ ...draft, datasetVersionId: event.target.value })
            }
            placeholder="Optional UUID"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
          Algorithm key
          <input
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            value={draft.algorithmKey ?? ""}
            onChange={(event) =>
              setDraft({ ...draft, algorithmKey: event.target.value })
            }
            placeholder="platform_demo"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
          Algorithm version ID
          <input
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            value={draft.algorithmVersionId ?? ""}
            onChange={(event) =>
              setDraft({ ...draft, algorithmVersionId: event.target.value })
            }
            placeholder="Optional UUID"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
          Range starts on
          <input
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            type="date"
            value={draft.startDate ?? ""}
            onChange={(event) =>
              setDraft({ ...draft, startDate: event.target.value })
            }
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
          Range ends on
          <input
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            type="date"
            value={draft.endDate ?? ""}
            onChange={(event) =>
              setDraft({ ...draft, endDate: event.target.value })
            }
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
          Created from
          <input
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            type="datetime-local"
            value={draft.createdFrom ?? ""}
            onChange={(event) =>
              setDraft({ ...draft, createdFrom: event.target.value })
            }
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
          Created to
          <input
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            type="datetime-local"
            value={draft.createdTo ?? ""}
            onChange={(event) =>
              setDraft({ ...draft, createdTo: event.target.value })
            }
          />
        </label>
        <div className="col-span-full flex items-center gap-3 pt-4 border-t border-border mt-2">
          <button
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand/90"
            type="submit"
          >
            Apply filters
          </button>
          <button
            type="button"
            className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-subtle"
            onClick={() => {
              const reset = {
                status: initialCompletedOnly ? "COMPLETED" : "",
                mode: "PLATFORM_DEMO",
              };
              setDraft(reset);
              setFilters(reset);
            }}
          >
            Reset
          </button>
        </div>
      </form>
      <ErrorText error={runs.error} />
      {runs.isLoading && (
        <p className="text-sm text-muted" role="status">
          Loading run history…
        </p>
      )}
      {!runs.isLoading && items.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted">
          No runs match these filters.
        </p>
      )}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((run) => (
          <RunCard
            key={run.id}
            run={run}
            selection={
              selectable
                ? {
                    selected: selectedRunIds.includes(run.id),
                    disabled: selectedRunIds.length >= 10,
                    toggle,
                  }
                : undefined
            }
          />
        ))}
      </div>
      {runs.hasNextPage && (
        <button
          className="mx-auto mt-4 rounded-md border border-border bg-surface px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-subtle"
          onClick={() => runs.fetchNextPage()}
          disabled={runs.isFetchingNextPage}
        >
          {runs.isFetchingNextPage ? "Loading more runs…" : "Load more runs"}
        </button>
      )}
    </section>
  );
}
