import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  GitCompareArrows,
  Layers3,
  ShieldAlert,
  X,
} from "lucide-react";

import {
  compareBacktests,
  preflightComparison,
  type Comparison,
} from "../../api/backtests";
import { ApiError } from "../../api/system";
import { BacktestCatalog } from "./BacktestCatalog";
import { VisualComparisonWorkspace } from "./VisualComparisonWorkspace";

function ErrorText({ error }: { error: unknown }) {
  if (!(error instanceof ApiError)) return null;
  return (
    <p className="error-text" role="alert">
      {error.message}
      {error.requestId ? ` Request ID: ${error.requestId}` : ""}
    </p>
  );
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

function MetricValue({ value }: { value: unknown }) {
  if (value === undefined || value === null) return <>—</>;
  if (typeof value === "object") {
    return (
      <code className="metric-json">{JSON.stringify(stableValue(value))}</code>
    );
  }
  return <>{String(value)}</>;
}

function DifferenceTable({
  title,
  differences,
  runIds,
}: {
  title: string;
  differences: Record<string, Record<string, unknown>>;
  runIds: string[];
}) {
  const entries = Object.entries(differences);
  return (
    <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <Layers3 size={15} className="text-brand" aria-hidden="true" />
        <h2 className="m-0 text-sm font-bold tracking-wide text-foreground">
          {title}
        </h2>
      </div>
      {entries.length === 0 ? (
        <p className="empty-state">
          No differences were recorded across these runs.
        </p>
      ) : (
        <div
          className="overflow-x-auto rounded-lg border border-border"
          role="region"
          aria-label={`Scrollable ${title.toLowerCase()} table`}
          tabIndex={0}
        >
          <table className="min-w-[680px] w-full text-left text-xs">
            <caption>{title} across selected immutable runs</caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="bg-surface-subtle p-3 font-medium text-muted"
                >
                  Field
                </th>
                {runIds.map((id) => (
                  <th
                    scope="col"
                    key={id}
                    className="bg-surface-subtle p-3 font-mono font-medium text-muted"
                  >
                    Run {id.slice(0, 8)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map(([field, values]) => (
                <tr key={field} className="border-t border-border">
                  <th scope="row" className="p-3 font-medium text-foreground">
                    {field}
                  </th>
                  {runIds.map((id) => (
                    <td key={id} className="p-3 text-muted">
                      <code>{JSON.stringify(values[id] ?? null)}</code>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function ComparisonResults({ comparison }: { comparison: Comparison }) {
  const metricKeys = useMemo(
    () =>
      Array.from(
        new Set(comparison.runs.flatMap((run) => Object.keys(run.metrics))),
      )
        .filter(
          (key) =>
            !["mode", "synthetic", "unit", "financial_pnl_available"].includes(
              key,
            ),
        )
        .sort(),
    [comparison.runs],
  );
  return (
    <section
      className="mt-6 space-y-4"
      aria-labelledby="comparison-results-heading"
    >
      <div className="flex gap-3 rounded-xl border border-warning/35 bg-warning/10 p-4 text-sm text-foreground">
        <ShieldAlert
          className="mt-0.5 shrink-0 text-warning"
          size={18}
          aria-hidden="true"
        />
        <p className="m-0">
          <strong>{comparison.mode} comparison.</strong> {comparison.notice}
        </p>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <p className="m-0 text-[11px] font-bold uppercase tracking-[0.16em] text-brand">
            Immutable analysis
          </p>
          <h2
            id="comparison-results-heading"
            className="mt-1 text-xl font-bold text-foreground"
          >
            Side-by-side run context
          </h2>
        </div>
        <span className="rounded-full border border-border bg-surface px-3 py-1.5 font-mono text-xs text-muted">
          {comparison.run_ids.length} runs · {comparison.unit}
        </span>
      </div>
      <p className="m-0 text-sm text-muted">
        Interpret regions and repeated behaviour, not a single “best” result.
        {comparison.synthetic
          ? " These synthetic demo outcomes are not financial returns."
          : " These are historical INR estimates, not executable option fills."}
      </p>
      <div
        className="overflow-x-auto rounded-xl border border-border bg-surface"
        role="region"
        aria-label="Scrollable run context table"
        tabIndex={0}
      >
        <table className="min-w-[760px] w-full text-left text-xs">
          <caption>Immutable context for safely compatible runs</caption>
          <thead>
            <tr>
              {[
                "Run",
                "Dataset",
                "Range",
                "Code version",
                "Algorithm version",
              ].map((label) => (
                <th
                  scope="col"
                  key={label}
                  className="bg-surface-subtle p-3 font-medium text-muted"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparison.runs.map((run) => (
              <tr key={run.run_id} className="border-t border-border">
                <th scope="row" className="p-3 font-mono text-foreground">
                  <Link
                    className="hover:text-brand hover:underline"
                    to={`/backtests/${run.run_id}`}
                  >
                    {run.run_id.slice(0, 8)}
                  </Link>
                </th>
                <td className="p-3 font-mono text-muted">
                  {run.dataset_version_id.slice(0, 8)}
                </td>
                <td className="p-3 text-foreground">
                  {run.start_date} → {run.end_date}
                </td>
                <td className="p-3 font-mono text-muted">{run.code_version}</td>
                <td className="p-3 font-mono text-muted">
                  {run.algorithm_version_id.slice(0, 8)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DifferenceTable
        title="Parameter differences"
        differences={comparison.parameter_differences}
        runIds={comparison.run_ids}
      />
      <DifferenceTable
        title="Assumption differences"
        differences={comparison.assumption_differences}
        runIds={comparison.run_ids}
      />
      <VisualComparisonWorkspace comparison={comparison} />
      <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <h2 className="m-0 mb-1 text-sm font-bold tracking-wide text-foreground">
          {comparison.synthetic
            ? "Synthetic activity comparison"
            : "Estimated outcome comparison"}
        </h2>
        <p className="mb-4 text-xs text-muted">
          {comparison.synthetic
            ? "Operational activity only; no financial interpretation or ranking."
            : "Estimated historical results only; compare like-for-like runs without ranking a strategy."}
        </p>
        <div
          className="overflow-x-auto rounded-lg border border-border"
          role="region"
          aria-label="Scrollable comparison metrics table"
          tabIndex={0}
        >
          <table className="min-w-[680px] w-full text-left text-xs">
            <caption>
              {comparison.unit} where applicable ·{" "}
              {comparison.synthetic
                ? "synthetic and non-financial"
                : "historical estimate"}
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="bg-surface-subtle p-3 font-medium text-muted"
                >
                  Metric
                </th>
                {comparison.run_ids.map((id) => (
                  <th
                    scope="col"
                    key={id}
                    className="bg-surface-subtle p-3 font-mono font-medium text-muted"
                  >
                    Run {id.slice(0, 8)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metricKeys.map((metric) => (
                <tr key={metric} className="border-t border-border">
                  <th
                    scope="row"
                    className="p-3 font-medium capitalize text-foreground"
                  >
                    {metric.replaceAll("_", " ")}
                  </th>
                  {comparison.runs.map((run) => (
                    <td key={run.run_id} className="p-3 text-muted">
                      <MetricValue value={run.metrics[metric]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

export function ComparisonsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>(() =>
    (searchParams.get("runs") ?? "")
      .split(",")
      .filter((value) => /^[0-9a-f-]{36}$/i.test(value))
      .slice(0, 10),
  );
  const selectionKey = selectedRunIds.join(",");
  const preflight = useQuery({
    queryKey: ["comparison-preflight", selectionKey],
    queryFn: () => preflightComparison(selectedRunIds),
    enabled: selectedRunIds.length >= 2,
  });
  const comparison = useMutation({
    mutationFn: () => compareBacktests(selectedRunIds),
  });

  function changeSelection(ids: string[]) {
    const normalized = ids.slice(0, 10);
    setSelectedRunIds(normalized);
    comparison.reset();
    navigate(
      normalized.length
        ? `/comparisons?runs=${normalized.join(",")}`
        : "/comparisons",
      { replace: true },
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      <header className="rounded-2xl border border-border bg-surface p-5 shadow-[0_16px_50px_-35px_rgba(168,121,255,0.75)] sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0 max-w-3xl">
            <Link
              to="/backtests/history"
              className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-brand"
            >
              <ArrowLeft size={14} aria-hidden="true" /> Run History
            </Link>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand">
                <GitCompareArrows size={21} aria-hidden="true" />
              </span>
              <div>
                <p className="m-0 text-[11px] font-bold uppercase tracking-[0.16em] text-brand">
                  Research workspace
                </p>
                <h1 className="m-0 mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Compare runs
                </h1>
              </div>
            </div>
            <p className="mb-0 mt-4 text-sm leading-6 text-muted">
              Review comparable run context and saved outcomes side by side. The
              server checks mode, dataset, and coverage before comparison.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface-subtle px-4 py-3 text-right">
            <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-muted">
              Safety mode
            </p>
            <p className="m-0 mt-1 font-mono text-xs font-semibold text-foreground">
              Server-checked mode and units
            </p>
          </div>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="m-0 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                Selection
              </p>
              <p
                className="m-0 mt-1 text-lg font-bold text-foreground"
                aria-live="polite"
              >
                {selectedRunIds.length} of 10 runs selected
              </p>
            </div>
            {selectedRunIds.length > 0 && (
              <button
                type="button"
                onClick={() => changeSelection([])}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-subtle"
              >
                <X size={14} aria-hidden="true" /> Clear
              </button>
            )}
          </div>
          {selectedRunIds.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedRunIds.map((id) => (
                <span
                  key={id}
                  className="inline-flex items-center gap-2 rounded-md border border-brand/30 bg-brand/10 px-2.5 py-1.5 font-mono text-xs text-foreground"
                >
                  {id.slice(0, 8)}
                  <button
                    type="button"
                    aria-label={`Remove run ${id.slice(0, 8)}`}
                    onClick={() =>
                      changeSelection(
                        selectedRunIds.filter((value) => value !== id),
                      )
                    }
                    className="text-muted hover:text-foreground"
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="mb-0 mt-3 text-sm text-muted">
              Choose two to ten completed runs from the catalog below, or select
              them from Run History.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-brand/25 bg-brand/5 p-4">
          <div className="flex items-center gap-2 text-brand">
            <ShieldAlert size={16} aria-hidden="true" />
            <p className="m-0 text-xs font-bold uppercase tracking-wider">
              Compatibility gate
            </p>
          </div>
          <p className="mb-0 mt-2 text-xs leading-5 text-muted">
            The server verifies mode, dataset, range, and completion before it
            permits a comparison.
          </p>
        </div>
      </section>

      <section
        className="rounded-xl border border-border bg-surface p-4 sm:p-5"
        aria-live="polite"
      >
        {selectedRunIds.length < 2 && (
          <p className="m-0 text-sm text-muted">
            Select at least two compatible completed runs to begin the safety
            check.
          </p>
        )}
        {preflight.isFetching && (
          <p className="m-0 text-sm text-muted" role="status">
            Checking comparison safety…
          </p>
        )}
        <ErrorText error={preflight.error ?? comparison.error} />
        {preflight.data && (
          <div
            className={`flex flex-col gap-4 rounded-lg border p-4 ${preflight.data.allowed ? "border-success/35 bg-success/10" : "border-danger/35 bg-danger/10"}`}
            role="status"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-foreground">
                {preflight.data.allowed ? (
                  <CheckCircle2
                    size={18}
                    className="text-success"
                    aria-hidden="true"
                  />
                ) : (
                  <ShieldAlert
                    size={18}
                    className="text-danger"
                    aria-hidden="true"
                  />
                )}
                <strong>
                  {preflight.data.allowed
                    ? preflight.data.performance_comparable
                      ? "Comparable performance scope"
                      : "Diagnostic comparison only"
                    : "Comparison blocked"}
                </strong>
              </div>
              {preflight.data.allowed && (
                <button
                  type="button"
                  onClick={() => comparison.mutate()}
                  disabled={comparison.isPending}
                  className="rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white transition hover:bg-brand/90 disabled:opacity-50"
                >
                  {comparison.isPending
                    ? "Building comparison…"
                    : "Compare selected runs"}
                </button>
              )}
            </div>
            {[...preflight.data.issues, ...preflight.data.warnings].map(
              (issue) => (
                <p key={issue.code} className="m-0 text-xs text-muted">
                  <code className="font-mono text-foreground">
                    {issue.code}
                  </code>{" "}
                  · {issue.message}
                </p>
              ),
            )}
          </div>
        )}
      </section>
      {comparison.data && <ComparisonResults comparison={comparison.data} />}
      <div className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
        <BacktestCatalog
          selectable
          selectedRunIds={selectedRunIds}
          onSelectionChange={changeSelection}
          initialCompletedOnly
        />
      </div>
    </section>
  );
}
