import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronRight,
  Filter,
  History,
  Play,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { listAlgorithms } from "../../api/algorithms";
import {
  getBacktest,
  getBacktestHistorySummary,
  getMetrics,
  listBacktests,
  listEquity,
  listLatestRunEvents,
  type BacktestCatalogRun,
  type BacktestFilters,
} from "../../api/backtests";
import { listDatasets } from "../../api/datasets";
import { formatPlatformDateTime } from "../../lib/dateTime";
import { ComparisonSlideover } from "./ComparisonSlideover";
import { DemoEquityChart } from "./DemoEquityChart";
import { AppSelect } from "@/components/ui/app-select";

const statuses = ["", "PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"];
const statusColors: Record<string, string> = {
  COMPLETED: "#55c596",
  FAILED: "#ef746c",
  RUNNING: "#a879ff",
  PENDING: "#d6a642",
  CANCELLED: "#a9a4b8",
};

function statusClass(status: string) {
  if (status === "COMPLETED") return "bg-success/10 text-success";
  if (status === "FAILED") return "bg-danger/10 text-danger";
  if (status === "CANCELLED") return "bg-surface-subtle text-muted";
  return "bg-brand/10 text-brand";
}

function duration(value: number | null) {
  if (value === null) return "—";
  if (value < 60) return `${value}s`;
  return `${Math.floor(value / 60)}m ${value % 60}s`;
}

function Kpi({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface/80 p-4 shadow-sm">
      <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
      <p className="m-0 text-xs text-muted">{detail}</p>
    </div>
  );
}

function AnalyticsBand({ filters }: { filters: BacktestFilters }) {
  const summary = useQuery({
    queryKey: ["backtest-history-summary", filters],
    queryFn: () => getBacktestHistorySummary(filters),
  });
  const data = summary.data;
  const statusData = Object.entries(data?.status_counts ?? {}).map(
    ([name, value]) => ({
      name,
      value,
      color: statusColors[name] ?? "#a879ff",
    }),
  );
  return (
    <section className="space-y-4" aria-label="Run history analytics">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Matching runs"
          value={String(data?.total_runs ?? "—")}
          detail="Across the applied history filters"
        />
        <Kpi
          label="Completion rate"
          value={data ? `${data.completion_rate}%` : "—"}
          detail={`${data?.completed_runs ?? 0} completed runs`}
        />
        <Kpi
          label="Median duration"
          value={duration(data?.median_duration_seconds ?? null)}
          detail="Completed platform workflow time"
        />
        <Kpi
          label="Active / failed"
          value={data ? `${data.active_runs} / ${data.failed_runs}` : "—"}
          detail="Current and terminal operational states"
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(260px,0.8fr)_minmax(280px,0.9fr)]">
        <div className="rounded-xl border border-border bg-surface/80 p-4 shadow-sm">
          <div>
            <h2 className="m-0 text-sm font-semibold text-foreground">
              Execution activity
            </h2>
            <p className="m-0 text-xs text-muted">
              Completed, failed, and active runs by creation date.
            </p>
          </div>
          <div className="mt-3 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.activity ?? []}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)",
                    borderColor: "var(--border)",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="completed" stackId="runs" fill="#55c596" />
                <Bar dataKey="failed" stackId="runs" fill="#ef746c" />
                <Bar dataKey="active" stackId="runs" fill="#a879ff" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface/80 p-4 shadow-sm">
          <h2 className="m-0 text-sm font-semibold text-foreground">
            Run status
          </h2>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  innerRadius={32}
                  outerRadius={52}
                >
                  {statusData.map((item) => (
                    <Cell key={item.name} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)",
                    borderColor: "var(--border)",
                    borderRadius: 8,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] text-muted">
            {statusData.map((item) => (
              <span key={item.name}>
                <i
                  className="mr-1 inline-block h-2 w-2 rounded-full"
                  style={{ background: item.color }}
                />
                {item.name} {item.value}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface/80 p-4 shadow-sm">
          <h2 className="m-0 text-sm font-semibold text-foreground">
            Dataset usage
          </h2>
          <p className="m-0 text-xs text-muted">
            Runs grouped by immutable dataset.
          </p>
          <div className="mt-3 space-y-2">
            {(data?.dataset_usage ?? []).map((item) => (
              <div key={item.key}>
                <div className="flex justify-between gap-3 text-xs">
                  <span className="truncate text-foreground">{item.label}</span>
                  <span className="font-mono text-muted">{item.count}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-surface-subtle">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{
                      width: `${Math.max(8, (item.count / Math.max(data?.total_runs ?? 1, 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
            {!data?.dataset_usage.length && (
              <p className="text-xs text-muted">No matching records yet.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function RunPreview({ item }: { item: BacktestCatalogRun | undefined }) {
  const run = useQuery({
    queryKey: ["history-preview-run", item?.id],
    queryFn: () => getBacktest(item!.id),
    enabled: Boolean(item),
  });
  const metrics = useQuery({
    queryKey: ["history-preview-metrics", item?.id],
    queryFn: () => getMetrics(item!.id),
    enabled: Boolean(item),
  });
  const equity = useQuery({
    queryKey: ["history-preview-equity", item?.id],
    queryFn: () => listEquity(item!.id),
    enabled: Boolean(item),
  });
  const events = useQuery({
    queryKey: ["history-preview-events", item?.id],
    queryFn: () => listLatestRunEvents(item!.id),
    enabled: Boolean(item),
  });
  const [tab, setTab] = useState<"overview" | "inputs" | "activity">(
    "overview",
  );
  if (!item)
    return (
      <aside className="flex min-h-96 items-center justify-center rounded-xl border border-dashed border-border bg-surface/50 p-6 text-center text-sm text-muted">
        Select a durable run to inspect its context and activity.
      </aside>
    );
  const metric = metrics.data?.metrics ?? {};
  const snapshot = run.data?.snapshot as Record<string, unknown> | undefined;
  return (
    <aside className="min-w-0 rounded-xl border border-border bg-surface/90 shadow-sm xl:sticky xl:top-0 xl:max-h-[calc(100vh-9rem)] xl:overflow-auto">
      <div className="border-b border-border p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="m-0 font-mono text-xs text-brand">
              RUN {item.id.slice(0, 8)}
            </p>
            <h2 className="m-0 mt-1 text-base font-semibold text-foreground">
              {item.algorithm_display_name}
            </h2>
            <p className="m-0 text-xs text-muted">
              {item.dataset_name} · v{item.dataset_version_number}
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClass(item.status)}`}
          >
            {item.status}
          </span>
        </div>
        <div className="mt-4 flex gap-1 border-b border-border">
          {(["overview", "inputs", "activity"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`border-b-2 px-2.5 py-2 text-xs font-bold capitalize ${tab === value ? "border-brand text-brand" : "border-transparent text-muted"}`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4">
        {tab === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Kpi
                label="Progress"
                value={`${item.progress}%`}
                detail={item.mode}
              />
              <Kpi
                label="Duration"
                value={duration(item.duration_seconds)}
                detail="Wall-clock run time"
              />
              <Kpi
                label={
                  item.mode === "OPTION_SPREAD_SIMULATION"
                    ? "Executed trades"
                    : "Synthetic trades"
                }
                value={String(
                  metric.total_trades ??
                    item.metrics_summary?.total_trades ??
                    "—",
                )}
                detail={
                  item.mode === "OPTION_SPREAD_SIMULATION"
                    ? "Indian Rupees (₹)"
                    : "DEMO_UNITS only"
                }
              />
              <Kpi
                label="Processed candles"
                value={String(
                  metric.processed_candles ??
                    item.metrics_summary?.processed_candles ??
                    "—",
                )}
                detail="Historical inputs evaluated"
              />
            </div>
            {equity.data?.items.length ? (
              <DemoEquityChart items={equity.data.items.slice(-100)} />
            ) : (
              <p className="rounded-lg bg-surface-subtle p-3 text-xs text-muted">
                No durable synthetic equity points are available for this run.
              </p>
            )}
            {item.error_message && (
              <p className="rounded-lg bg-danger/10 p-3 text-xs text-danger">
                {item.error_message}
              </p>
            )}
            <Link
              to={
                item.status === "RUNNING" || item.status === "PENDING"
                  ? `/studio?run=${item.id}`
                  : `/backtests/${item.id}`
              }
              className="flex items-center justify-center gap-1 rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white"
            >
              {item.status === "RUNNING" || item.status === "PENDING"
                ? "Continue in Studio"
                : "Open full result"}
              <ChevronRight size={14} />
            </Link>
          </div>
        )}
        {tab === "inputs" && (
          <div className="space-y-3 text-xs">
            <dl className="grid gap-3">
              <div>
                <dt className="text-muted">Algorithm version</dt>
                <dd className="m-0 text-foreground">
                  {item.algorithm_version_name} · v
                  {item.algorithm_version_number} · {item.code_version}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Research range</dt>
                <dd className="m-0 text-foreground">
                  {item.start_date} → {item.end_date}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Parameters</dt>
                <dd className="mt-1 max-h-48 overflow-auto rounded-lg bg-[#0b0f19] p-3 font-mono text-[10px] text-slate-300">
                  <pre>
                    {JSON.stringify(
                      (
                        snapshot?.algorithm as
                          Record<string, unknown> | undefined
                      )?.parameters ?? {},
                      null,
                      2,
                    )}
                  </pre>
                </dd>
              </div>
            </dl>
          </div>
        )}
        {tab === "activity" && (
          <div className="space-y-2">
            {(events.data ?? []).map((event) => (
              <div
                key={event.id}
                className="rounded-lg bg-surface-subtle p-2 text-[11px]"
              >
                <p className="m-0 font-mono text-brand">
                  #{event.sequence} {event.event_type}
                </p>
                <p className="m-0 text-muted">{event.created_at}</p>
              </div>
            ))}
            {!events.data?.length && (
              <p className="text-xs text-muted">
                No durable events loaded yet.
              </p>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

export function BacktestHistoryPage() {
  const [params, setParams] = useSearchParams();
  const [advanced, setAdvanced] = useState(false);
  const [initial] = useState<BacktestFilters>(() => ({
    runQuery: params.get("q") ?? "",
    status: params.get("status") ?? "",
    datasetId: params.get("dataset") ?? "",
    algorithmKey: params.get("algorithm") ?? "",
    createdFrom: params.get("from") ?? "",
    createdTo: params.get("to") ?? "",
    mode: "PLATFORM_DEMO",
  }));
  const [draft, setDraft] = useState(initial);
  const [filters, setFilters] = useState(initial);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const selectedId = params.get("run");
  const datasets = useQuery({
    queryKey: ["datasets", "history-filters"],
    queryFn: () => listDatasets(),
  });
  const algorithms = useQuery({
    queryKey: ["algorithms", "history-filters"],
    queryFn: listAlgorithms,
  });
  const catalog = useInfiniteQuery({
    queryKey: ["history-catalog", filters],
    queryFn: ({ pageParam }) => listBacktests(filters, pageParam, 25),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
  });
  const items = useMemo(
    () => catalog.data?.pages.flatMap((page) => page.items) ?? [],
    [catalog.data],
  );
  const selected = items.find((item) => item.id === selectedId) ?? items[0];
  useEffect(() => {
    if (!selectedId && items[0])
      setParams(
        (current) => {
          current.set("run", items[0].id);
          return current;
        },
        { replace: true },
      );
  }, [items, selectedId, setParams]);
  const apply = () => {
    const next = { ...draft, mode: "PLATFORM_DEMO" };
    setFilters(next);
    setParams(
      (current) => {
        const urlFilters: Array<[string, string | undefined]> = [
          ["q", next.runQuery],
          ["status", next.status],
          ["dataset", next.datasetId],
          ["algorithm", next.algorithmKey],
          ["from", next.createdFrom],
          ["to", next.createdTo],
        ];
        for (const [key, value] of urlFilters) {
          if (value) current.set(key, String(value));
          else current.delete(key);
        }
        return current;
      },
      { replace: true },
    );
  };
  const toggle = (id: string) =>
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length < 10
          ? [...current, id]
          : current,
    );
  return (
    <section className="mx-auto flex w-full max-w-[1800px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-border bg-surface/80 px-5 py-4 shadow-sm">
        <div>
          <p className="m-0 text-[11px] font-bold uppercase tracking-[0.16em] text-brand">
            Durable run archive
          </p>
          <h1 className="m-0 text-2xl font-semibold text-foreground">
            Run history
          </h1>
          <p className="m-0 mt-1 text-sm text-muted">
            Audit platform execution, inspect immutable context, and compose
            guarded comparisons.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/studio"
            className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white"
          >
            <Play size={14} fill="currentColor" /> New run
          </Link>
          <button
            type="button"
            disabled={selectedIds.length < 2}
            onClick={() => setComparisonOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground disabled:cursor-not-allowed disabled:opacity-45"
          >
            <BarChart3 size={14} /> Compare
          </button>
        </div>
      </header>
      <AnalyticsBand filters={filters} />
      <section className="rounded-xl border border-border bg-surface/80 p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <label className="relative min-w-[190px] flex-1">
            <Search className="absolute left-3 top-2.5 text-muted" size={16} />
            <input
              value={draft.runQuery ?? ""}
              onChange={(event) =>
                setDraft({ ...draft, runQuery: event.target.value })
              }
              placeholder="Search run ID…"
              className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-foreground"
            />
          </label>
          <AppSelect
            value={draft.datasetId || "__all__"}
            ariaLabel="Dataset filter"
            placeholder="All datasets"
            onValueChange={(value) =>
              setDraft({
                ...draft,
                datasetId: value === "__all__" ? "" : value,
              })
            }
            className="w-auto min-w-[180px]"
            options={[
              { value: "__all__", label: "All datasets" },
              ...(datasets.data?.items ?? []).map((item) => ({
                value: item.id,
                label: item.name,
              })),
            ]}
          />
          <AppSelect
            value={draft.algorithmKey || "__all__"}
            ariaLabel="Algorithm filter"
            placeholder="All algorithms"
            onValueChange={(value) =>
              setDraft({
                ...draft,
                algorithmKey: value === "__all__" ? "" : value,
              })
            }
            className="w-auto min-w-[180px]"
            options={[
              { value: "__all__", label: "All algorithms" },
              ...(algorithms.data?.items ?? []).map((item) => ({
                value: item.key,
                label: item.display_name,
              })),
            ]}
          />
          <button
            type="button"
            onClick={() => setAdvanced(!advanced)}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground"
          >
            <SlidersHorizontal size={14} /> Advanced
          </button>
          <button
            type="button"
            onClick={apply}
            className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white"
          >
            <Filter size={14} /> Apply
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {statuses.slice(1).map((status) => (
            <button
              type="button"
              key={status}
              onClick={() =>
                setDraft({
                  ...draft,
                  status: draft.status === status ? "" : status,
                })
              }
              className={`rounded-full px-3 py-1 text-xs font-bold ${draft.status === status ? "bg-brand text-white" : "bg-surface-subtle text-muted"}`}
            >
              {status}
            </button>
          ))}
        </div>
        {advanced && (
          <div className="mt-3 grid gap-3 border-t border-border pt-3 md:grid-cols-2">
            <label className="text-xs text-muted">
              Range starts
              <input
                type="date"
                value={draft.startDate ?? ""}
                onChange={(event) =>
                  setDraft({ ...draft, startDate: event.target.value })
                }
                className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className="text-xs text-muted">
              Range ends
              <input
                type="date"
                value={draft.endDate ?? ""}
                onChange={(event) =>
                  setDraft({ ...draft, endDate: event.target.value })
                }
                className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
              />
            </label>
          </div>
        )}
      </section>
      <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_440px]">
        <section className="min-w-0 rounded-xl border border-border bg-surface/80 shadow-sm">
          <div className="flex items-center justify-between border-b border-border p-4">
            <div>
              <h2 className="m-0 text-base font-semibold text-foreground">
                Catalog
              </h2>
              <p className="m-0 text-xs text-muted">
                {catalog.data?.pages[0]?.total_count ?? 0} matching ·{" "}
                {items.length} loaded
              </p>
            </div>
            <History size={18} className="text-brand" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-xs">
              <thead className="bg-surface-subtle text-muted">
                <tr>
                  <th className="p-3">Compare</th>
                  <th className="p-3">Run / status</th>
                  <th className="p-3">Dataset</th>
                  <th className="p-3">Algorithm</th>
                  <th className="p-3">Range</th>
                  <th className="p-3">Created</th>
                  <th className="p-3">Duration</th>
                  <th className="p-3">Activity</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() =>
                      setParams((current) => {
                        current.set("run", item.id);
                        return current;
                      })
                    }
                    className={`cursor-pointer border-t border-border transition hover:bg-brand/5 ${selected?.id === item.id ? "bg-brand/10" : ""}`}
                  >
                    <td
                      className="p-3"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <input
                        aria-label={`Select run ${item.id.slice(0, 8)} for comparison`}
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        disabled={
                          item.status !== "COMPLETED" &&
                          !selectedIds.includes(item.id)
                        }
                        onChange={() => toggle(item.id)}
                      />
                    </td>
                    <td className="p-3">
                      <p className="m-0 font-mono font-bold text-foreground">
                        {item.id.slice(0, 8)}
                      </p>
                      <span
                        className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${statusClass(item.status)}`}
                      >
                        {item.status}{" "}
                        {item.status === "RUNNING" ? `${item.progress}%` : ""}
                      </span>
                    </td>
                    <td className="p-3">
                      <p className="m-0 max-w-32 truncate text-foreground">
                        {item.dataset_name}
                      </p>
                      <p className="m-0 text-muted">
                        v{item.dataset_version_number}
                      </p>
                    </td>
                    <td className="p-3">
                      <p className="m-0 max-w-36 truncate text-foreground">
                        {item.algorithm_display_name}
                      </p>
                      <p className="m-0 text-muted">
                        {item.algorithm_version_name} · v
                        {item.algorithm_version_number}
                      </p>
                    </td>
                    <td className="p-3 whitespace-nowrap text-foreground">
                      {item.start_date}
                      <br />
                      {item.end_date}
                    </td>
                    <td className="p-3 whitespace-nowrap text-muted">
                      {formatPlatformDateTime(item.created_at)}
                    </td>
                    <td className="p-3 font-mono text-foreground">
                      {duration(item.duration_seconds)}
                    </td>
                    <td className="p-3">
                      <p className="m-0 text-foreground">
                        {String(item.metrics_summary?.total_trades ?? "—")}{" "}
                        trades
                      </p>
                      <p className="m-0 text-muted">
                        {String(item.metrics_summary?.processed_candles ?? "—")}{" "}
                        candles
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!items.length && !catalog.isLoading && (
            <div className="p-12 text-center text-sm text-muted">
              No runs match these filters. Clear a filter or start a new
              platform-demo run.
            </div>
          )}
          {catalog.hasNextPage && (
            <button
              type="button"
              onClick={() => catalog.fetchNextPage()}
              className="m-4 w-[calc(100%-2rem)] rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground"
            >
              Load 25 more runs
            </button>
          )}
        </section>
        <RunPreview item={selected} />
      </div>
      {selectedIds.length > 0 && (
        <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/30 bg-surface px-4 py-3 shadow-xl">
          <div className="text-sm text-foreground">
            <Check className="mr-1 inline text-brand" size={15} />
            <strong>{selectedIds.length}</strong> completed demo runs selected
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="rounded-lg px-3 py-2 text-xs font-bold text-muted"
            >
              <X className="inline" size={14} /> Clear
            </button>
            <button
              type="button"
              disabled={selectedIds.length < 2}
              onClick={() => setComparisonOpen(true)}
              className="rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              Compare selected <ArrowUpRight className="inline" size={14} />
            </button>
          </div>
        </div>
      )}
      <ComparisonSlideover
        isOpen={comparisonOpen}
        onClose={() => setComparisonOpen(false)}
        runIds={selectedIds}
      />
    </section>
  );
}
