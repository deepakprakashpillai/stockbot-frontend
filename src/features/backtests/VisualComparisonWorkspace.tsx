import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  getComparisonSeries,
  type Comparison,
  type ComparisonSeriesName,
} from "../../api/backtests";
import { useChartViewport } from "../../components/charts";
import { ApiError } from "../../api/system";

type Metric =
  | "equity"
  | "drawdown"
  | "trade_outcomes"
  | "signal_decisions"
  | "rejection_reasons";
type Layout = "overlay" | "small-multiples";

const METRICS: Array<{
  id: Metric;
  label: string;
  series: ComparisonSeriesName[];
}> = [
  { id: "equity", label: "Equity", series: ["equity"] },
  { id: "drawdown", label: "Drawdown", series: ["drawdown"] },
  {
    id: "trade_outcomes",
    label: "Trade outcomes",
    series: ["trade_outcomes"],
  },
  {
    id: "signal_decisions",
    label: "Signal decisions",
    series: ["signal_decisions"],
  },
  {
    id: "rejection_reasons",
    label: "Rejection reasons",
    series: ["rejection_reasons"],
  },
];
const COLORS = [
  "#8c52ff",
  "#2f80ed",
  "#f2a93b",
  "#db6f97",
  "#3aa981",
  "#8e72d9",
];
const DASHES = ["", "7 4", "2 3", "10 3 2 3", "5 2", "1 3"];

function exact(value: unknown) {
  return value === undefined || value === null
    ? "Unavailable"
    : `${String(value)} DEMO_UNITS`;
}

function displayTime(value: string | number) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? String(value) : date.toLocaleString();
}

function localInputValue(value: string | undefined) {
  return value ? value.slice(0, 16) : "";
}

function isoFromLocalInput(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

function metricFrom(params: URLSearchParams): Metric {
  const value = params.get("comparison_metric");
  return METRICS.some((item) => item.id === value)
    ? (value as Metric)
    : "equity";
}

function layoutFrom(params: URLSearchParams): Layout {
  return params.get("comparison_layout") === "small-multiples"
    ? "small-multiples"
    : "overlay";
}

function parseVisible(params: URLSearchParams, runIds: string[]) {
  const raw = params.get("comparison_visible");
  if (raw === null) return runIds;
  return raw.split(",").filter((id) => runIds.includes(id));
}

function ComparisonTooltip({
  active,
  label,
  runIds,
  data,
}: {
  active?: boolean;
  label?: number;
  runIds: string[];
  data: Array<Record<string, number | string | undefined>>;
}) {
  if (!active || label === undefined) return null;
  const row = data.find((item) => item.timestampValue === label);
  return (
    <div className="elevation-floating min-w-60 rounded-xl border border-border bg-surface p-3 text-xs">
      <p className="m-0 font-semibold text-foreground">{displayTime(label)}</p>
      <dl className="m-0 mt-2 space-y-1 border-t border-border pt-2">
        {runIds.map((id) => (
          <div key={id} className="flex justify-between gap-4">
            <dt className="font-mono text-muted">{id.slice(0, 8)}</dt>
            <dd className="m-0 font-mono text-foreground">
              {row?.[id] === undefined
                ? "No point at this timestamp"
                : exact(row[id])}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function SeriesTable({
  title,
  rows,
  runIds,
}: {
  title: string;
  rows: Array<Record<string, number | string | undefined>>;
  runIds: string[];
}) {
  return (
    <div
      className="overflow-x-auto rounded-lg border border-border"
      role="region"
      aria-label={`${title} exact values`}
      tabIndex={0}
    >
      <table className="min-w-[700px] w-full text-left text-xs">
        <caption className="sr-only">
          Exact {title.toLowerCase()} values by run
        </caption>
        <thead className="bg-surface-subtle text-muted">
          <tr>
            <th scope="col" className="p-3 font-medium">
              Timestamp or category
            </th>
            {runIds.map((id) => (
              <th scope="col" key={id} className="p-3 font-mono font-medium">
                Run {id.slice(0, 8)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={String(row.key ?? row.timestamp)}
              className="border-t border-border"
            >
              <th scope="row" className="p-3 font-medium text-foreground">
                {row.category
                  ? String(row.category)
                  : displayTime(String(row.timestamp))}
              </th>
              {runIds.map((id) => (
                <td key={id} className="p-3 font-mono text-muted">
                  {row[id] === undefined
                    ? "No point"
                    : row.category
                      ? String(row[id])
                      : exact(row[id])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function VisualComparisonWorkspace({
  comparison,
}: {
  comparison: Comparison;
}) {
  const [params, setParams] = useSearchParams();
  const [requested, setRequested] = useState(() =>
    Boolean(params.get("comparison_metric")),
  );
  const metric = metricFrom(params);
  const layout = layoutFrom(params);
  const visibleRunIds = parseVisible(params, comparison.run_ids);
  const rangeStart = params.get("comparison_from") ?? undefined;
  const rangeEnd = params.get("comparison_to") ?? undefined;
  const selectedMetric =
    METRICS.find((item) => item.id === metric) ?? METRICS[0];

  function update(next: Record<string, string | undefined>) {
    const value = new URLSearchParams(params);
    Object.entries(next).forEach(([key, item]) =>
      item === undefined ? value.delete(key) : value.set(key, item),
    );
    setParams(value, { replace: true });
  }

  const evidence = useQuery({
    queryKey: [
      "comparison-series",
      comparison.run_ids,
      selectedMetric.series,
      rangeStart,
      rangeEnd,
    ],
    queryFn: () =>
      getComparisonSeries({
        runIds: comparison.run_ids,
        series: selectedMetric.series,
        start: rangeStart,
        end: rangeEnd,
      }),
    enabled: requested,
    staleTime: 60_000,
  });
  const isCategoryMetric =
    metric === "signal_decisions" || metric === "rejection_reasons";
  const rows = useMemo<
    Array<Record<string, number | string | undefined>>
  >(() => {
    if (!evidence.data) return [];
    const values = new Map<
      string,
      Record<string, number | string | undefined>
    >();
    for (const run of evidence.data.runs) {
      const items = run[metric] ?? [];
      for (const item of items) {
        const category = "category" in item ? item.category : undefined;
        const timestamp = "timestamp" in item ? item.timestamp : undefined;
        const key = category ?? timestamp ?? "unknown";
        const row = values.get(key) ?? {
          key,
          category,
          timestamp,
          timestampValue: timestamp ? Date.parse(timestamp) : undefined,
        };
        row[run.run_id] = "count" in item ? item.count : Number(item.value);
        values.set(key, row);
      }
    }
    return [...values.values()].sort(
      (left, right) =>
        Number(left.timestampValue ?? 0) - Number(right.timestampValue ?? 0) ||
        String(left.category ?? "").localeCompare(String(right.category ?? "")),
    );
  }, [evidence.data, metric]);
  const timestamps = useMemo(
    () => rows.map((row) => Number(row.timestampValue)).filter(Number.isFinite),
    [rows],
  );
  const viewport = useChartViewport(timestamps, comparison.run_ids);
  const chartRows = useMemo(
    () =>
      viewport.visibleDomain
        ? rows.filter((row) => {
            const timestamp = Number(row.timestampValue);
            return (
              !Number.isFinite(timestamp) ||
              (timestamp >= viewport.visibleDomain!.start &&
                timestamp <= viewport.visibleDomain!.end)
            );
          })
        : rows,
    [rows, viewport.visibleDomain],
  );

  function toggleRun(id: string) {
    const next = visibleRunIds.includes(id)
      ? visibleRunIds.filter((item) => item !== id)
      : [...visibleRunIds, id];
    update({ comparison_visible: next.join(",") });
  }

  return (
    <section
      className="mt-6 space-y-4 rounded-2xl border border-brand/25 bg-surface p-4 sm:p-6"
      aria-labelledby="visual-comparison-heading"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="m-0 text-[11px] font-bold uppercase tracking-[0.16em] text-brand">
            Visual evidence
          </p>
          <h2
            id="visual-comparison-heading"
            className="m-0 mt-1 text-xl font-bold text-foreground"
          >
            Synchronized comparison
          </h2>
          <p className="mb-0 mt-1 text-sm text-muted">
            Exact persisted demo evidence only. Visuals do not rank runs or
            imply financial performance.
          </p>
        </div>
        {!requested && (
          <button
            type="button"
            onClick={() => {
              setRequested(true);
              update({ comparison_metric: metric });
            }}
            className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand/90"
          >
            Load visual evidence
          </button>
        )}
      </div>
      {requested && (
        <>
          <div className="flex flex-col gap-3 border-y border-border py-3 lg:flex-row lg:items-center lg:justify-between">
            <div
              className="flex flex-wrap gap-1"
              role="group"
              aria-label="Comparison metric"
            >
              {METRICS.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  aria-pressed={metric === item.id}
                  onClick={() => update({ comparison_metric: item.id })}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${metric === item.id ? "bg-brand text-white" : "border border-border text-muted hover:text-foreground"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Comparison layout"
            >
              {(["overlay", "small-multiples"] as Layout[]).map((item) => (
                <button
                  type="button"
                  key={item}
                  aria-pressed={layout === item}
                  onClick={() => update({ comparison_layout: item })}
                  className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold ${layout === item ? "border-brand bg-brand/10 text-foreground" : "border-border text-muted"}`}
                >
                  {item === "overlay" ? "Overlay" : "Small multiples"}
                </button>
              ))}
            </div>
          </div>
          <fieldset
            className="flex flex-wrap items-end gap-2"
            aria-label="Shared comparison range"
          >
            <legend className="sr-only">Shared comparison range</legend>
            <label className="grid gap-1 text-[11px] font-semibold text-muted">
              From
              <input
                type="datetime-local"
                value={localInputValue(rangeStart)}
                onChange={(event) =>
                  update({
                    comparison_from: isoFromLocalInput(event.target.value),
                  })
                }
                className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-foreground"
              />
            </label>
            <label className="grid gap-1 text-[11px] font-semibold text-muted">
              To
              <input
                type="datetime-local"
                value={localInputValue(rangeEnd)}
                onChange={(event) =>
                  update({
                    comparison_to: isoFromLocalInput(event.target.value),
                  })
                }
                className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-foreground"
              />
            </label>
            <button
              type="button"
              onClick={() =>
                update({ comparison_from: undefined, comparison_to: undefined })
              }
              className="rounded-md px-2 py-1.5 text-xs font-semibold text-brand hover:underline"
            >
              Full returned range
            </button>
          </fieldset>
          <div className="flex flex-wrap gap-2" aria-label="Visible runs">
            {comparison.runs.map((run, index) => (
              <button
                type="button"
                key={run.run_id}
                aria-pressed={visibleRunIds.includes(run.run_id)}
                onClick={() => toggleRun(run.run_id)}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-mono text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {visibleRunIds.includes(run.run_id) ? (
                  <Eye size={13} aria-hidden="true" />
                ) : (
                  <EyeOff size={13} aria-hidden="true" />
                )}{" "}
                {run.run_id.slice(0, 8)}{" "}
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
              </button>
            ))}
            <button
              type="button"
              onClick={() =>
                update({ comparison_visible: comparison.run_ids.join(",") })
              }
              className="rounded-md px-2 py-1 text-xs font-semibold text-brand hover:underline"
            >
              Show all
            </button>
          </div>
          {evidence.isLoading && (
            <p role="status" className="m-0 text-sm text-muted">
              Loading bounded visual evidence…
            </p>
          )}
          {evidence.error instanceof ApiError && (
            <p role="alert" className="error-text">
              {evidence.error.message}
            </p>
          )}
          {evidence.data && (
            <>
              <p className="m-0 text-xs text-muted" aria-live="polite">
                Resolution: {evidence.data.resolution}; up to{" "}
                {evidence.data.max_points_per_run} returned points per run.
                Missing timestamps remain visible as gaps.
              </p>
              {evidence.data.warnings.map((warning) => (
                <p
                  key={warning.code}
                  className="m-0 rounded-md border border-warning/30 bg-warning/10 p-2 text-xs text-foreground"
                >
                  {warning.message}
                </p>
              ))}
              {visibleRunIds.length === 0 ? (
                <p className="empty-state">
                  All runs are hidden. Use Show all to recover the comparison.
                </p>
              ) : isCategoryMetric ? (
                <div className="grid gap-4 xl:grid-cols-2">
                  {layout === "overlay" ? (
                    <div className="h-80 rounded-lg border border-border p-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={rows}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="category" />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Legend />
                          {visibleRunIds.map((id, index) => (
                            <Bar
                              key={id}
                              dataKey={id}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    visibleRunIds.map((id, index) => (
                      <div
                        key={id}
                        className="h-72 rounded-lg border border-border p-2"
                      >
                        <p className="m-0 text-xs font-mono text-muted">
                          Run {id.slice(0, 8)}
                        </p>
                        <ResponsiveContainer width="100%" height="92%">
                          <BarChart data={rows}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="category" />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Bar
                              dataKey={id}
                              fill={COLORS[index % COLORS.length]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p
                      className="m-0 text-xs text-muted"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "ArrowLeft") viewport.moveActive(-1);
                        if (event.key === "ArrowRight") viewport.moveActive(1);
                      }}
                    >
                      Use Left/Right Arrow here to move the active timestamp.{" "}
                      {viewport.activeTimestamp
                        ? displayTime(viewport.activeTimestamp)
                        : ""}
                    </p>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        aria-label="Zoom in"
                        onClick={() => viewport.zoom(1.8)}
                        disabled={!viewport.canZoom}
                        className="rounded border border-border p-1 text-muted"
                      >
                        <ZoomIn size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label="Zoom out"
                        onClick={() => viewport.zoom(0.56)}
                        disabled={!viewport.canZoom}
                        className="rounded border border-border p-1 text-muted"
                      >
                        <ZoomOut size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label="Reset comparison range"
                        onClick={viewport.reset}
                        className="rounded border border-border p-1 text-muted"
                      >
                        <RotateCcw size={14} />
                      </button>
                    </div>
                  </div>
                  <div
                    className={`grid gap-4 ${layout === "small-multiples" ? "xl:grid-cols-2" : ""}`}
                  >
                    {layout === "overlay" ? (
                      <div className="h-96 rounded-lg border border-border p-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={chartRows}
                            syncId="comparison-series"
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="timestampValue"
                              type="number"
                              domain={
                                viewport.visibleDomain
                                  ? [
                                      viewport.visibleDomain.start,
                                      viewport.visibleDomain.end,
                                    ]
                                  : ["auto", "auto"]
                              }
                              tickFormatter={displayTime}
                            />
                            <YAxis />
                            <Tooltip
                              content={
                                <ComparisonTooltip
                                  runIds={visibleRunIds}
                                  data={chartRows}
                                />
                              }
                            />
                            <Legend />
                            {visibleRunIds.map((id, index) => (
                              <Line
                                key={id}
                                type="linear"
                                dataKey={id}
                                stroke={COLORS[index % COLORS.length]}
                                strokeDasharray={DASHES[index % DASHES.length]}
                                dot={false}
                                connectNulls={false}
                                name={`Run ${id.slice(0, 8)}`}
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      visibleRunIds.map((id, index) => (
                        <div
                          key={id}
                          className="h-80 rounded-lg border border-border p-2"
                        >
                          <p className="m-0 text-xs font-mono text-muted">
                            Run {id.slice(0, 8)}
                          </p>
                          <ResponsiveContainer width="100%" height="92%">
                            <LineChart
                              data={chartRows}
                              syncId="comparison-series"
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis
                                dataKey="timestampValue"
                                type="number"
                                domain={
                                  viewport.visibleDomain
                                    ? [
                                        viewport.visibleDomain.start,
                                        viewport.visibleDomain.end,
                                      ]
                                    : ["auto", "auto"]
                                }
                                tickFormatter={displayTime}
                              />
                              <YAxis />
                              <Tooltip
                                content={
                                  <ComparisonTooltip
                                    runIds={[id]}
                                    data={chartRows}
                                  />
                                }
                              />
                              <Line
                                type="linear"
                                dataKey={id}
                                stroke={COLORS[index % COLORS.length]}
                                strokeDasharray={DASHES[index % DASHES.length]}
                                dot={false}
                                connectNulls={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
              <SeriesTable
                title={selectedMetric.label}
                rows={isCategoryMetric ? rows : chartRows}
                runIds={visibleRunIds}
              />
              <div className="flex flex-wrap gap-2 text-xs text-muted">
                {comparison.run_ids.map((id) => (
                  <Link
                    key={id}
                    to={`/backtests/${id}?comparison_return=${encodeURIComponent(`/comparisons?${params.toString()}`)}`}
                    className="text-brand hover:underline"
                  >
                    Open run {id.slice(0, 8)}
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
