import { useEffect, useMemo, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  cancelBacktest,
  getBacktest,
  getMetrics,
  listEquity,
  listRunEvents,
  listSignals,
  listTrades,
  preflightBacktest,
  startBacktest,
  type BacktestRun,
} from "../../api/backtests";
import { listAlgorithms, listAlgorithmVersions } from "../../api/algorithms";
import { listDatasets } from "../../api/datasets";
import { ApiError } from "../../api/system";
import { useRealtimeChannel } from "../../realtime/useRealtimeChannel";
import type { RealtimeEvent } from "../../realtime/types";
import { AppSelect } from "@/components/ui/app-select";

const terminal = new Set(["COMPLETED", "FAILED", "CANCELLED"]);
const activeRunStorageKey = "stockbot.activeBacktestRunId";

function statusFromEvent(event: RealtimeEvent) {
  if (event.type === "backtest.completed") return "COMPLETED";
  if (event.type === "backtest.failed") return "FAILED";
  if (event.type === "backtest.cancelled") return "CANCELLED";
  if (event.type === "backtest.started") return "RUNNING";
  return undefined;
}

function ErrorText({ error }: { error: unknown }) {
  if (!(error instanceof ApiError)) return null;
  return (
    <p className="error-text" role="alert">
      {error.message}
      {error.requestId ? ` Request ID: ${error.requestId}` : ""}
    </p>
  );
}

export function BacktestsPage() {
  const queryClient = useQueryClient();
  const datasets = useQuery({
    queryKey: ["datasets", "backtests"],
    queryFn: () => listDatasets(),
  });
  const datasetOptions = useMemo(
    () =>
      datasets.data?.items.flatMap((item) =>
        item.latest_version
          ? [{ datasetName: item.name, version: item.latest_version }]
          : [],
      ) ?? [],
    [datasets.data],
  );
  const algorithms = useQuery({
    queryKey: ["algorithms", "backtests"],
    queryFn: () => listAlgorithms(),
  });
  const [algorithmKey, setAlgorithmKey] = useState("platform_demo");
  const algorithmVersions = useQuery({
    queryKey: ["algorithm-versions", algorithmKey, "backtests"],
    queryFn: () => listAlgorithmVersions(algorithmKey),
    enabled: Boolean(algorithmKey),
  });
  const [datasetVersionId, setDatasetVersionId] = useState("");
  const [algorithmVersionId, setAlgorithmVersionId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [capital, setCapital] = useState("100000.00");
  const [acknowledged, setAcknowledged] = useState(false);
  const [runId, setRunId] = useState<string | null>(() =>
    localStorage.getItem(activeRunStorageKey),
  );
  const [reviewedInputKey, setReviewedInputKey] = useState<string | null>(null);
  const datasetVersion = datasetOptions.find(
    (item) => item.version.id === datasetVersionId,
  )?.version;
  const input = useMemo(
    () =>
      datasetVersion && algorithmVersionId && startDate && endDate
        ? {
            dataset_version_id: datasetVersion.id,
            algorithm_version_id: algorithmVersionId,
            start_date: startDate,
            end_date: endDate,
            starting_capital: capital,
            warning_acknowledged: acknowledged,
          }
        : null,
    [
      acknowledged,
      algorithmVersionId,
      capital,
      datasetVersion,
      endDate,
      startDate,
    ],
  );
  const inputKey = input ? JSON.stringify(input) : null;
  const preflight = useMutation({
    mutationFn: () => preflightBacktest(input!),
  });
  const start = useMutation({
    mutationFn: () => startBacktest(input!),
    onSuccess: (newRun) => {
      localStorage.setItem(activeRunStorageKey, newRun.id);
      setRunId(newRun.id);
    },
  });
  const { connectionState } = useRealtimeChannel(
    runId ? `backtest:${runId}` : null,
    (event) => {
      if ("latest_sequence" in event) {
        void queryClient.refetchQueries({
          queryKey: ["backtest", runId],
          exact: true,
        });
        for (const key of [
          "backtest-events",
          "backtest-metrics",
          "backtest-signals",
          "backtest-trades",
          "backtest-equity",
        ]) {
          void queryClient.invalidateQueries({ queryKey: [key, runId] });
        }
        return;
      }
      const status = statusFromEvent(event);
      const progress =
        typeof event.data.progress === "number"
          ? event.data.progress
          : typeof event.data.percent === "number"
            ? event.data.percent
            : undefined;
      queryClient.setQueryData<BacktestRun>(["backtest", runId], (current) =>
        current
          ? {
              ...current,
              ...(status ? { status } : {}),
              ...(progress === undefined ? {} : { progress }),
            }
          : current,
      );
      void queryClient.invalidateQueries({
        queryKey: ["backtest-events", runId],
      });
      if (status && terminal.has(status)) {
        localStorage.removeItem(activeRunStorageKey);
        void queryClient.refetchQueries({
          queryKey: ["backtest", runId],
          exact: true,
        });
        for (const key of [
          "backtest-metrics",
          "backtest-signals",
          "backtest-trades",
          "backtest-equity",
        ]) {
          void queryClient.invalidateQueries({ queryKey: [key, runId] });
        }
      }
    },
  );
  const run = useQuery({
    queryKey: ["backtest", runId],
    queryFn: () => getBacktest(runId!),
    enabled: Boolean(runId),
    refetchInterval: (query) =>
      query.state.data &&
      !terminal.has(query.state.data.status) &&
      connectionState !== "connected"
        ? 10_000
        : false,
  });
  useEffect(() => {
    if (run.data && terminal.has(run.data.status)) {
      localStorage.removeItem(activeRunStorageKey);
    }
  }, [run.data]);
  const metrics = useQuery({
    queryKey: ["backtest-metrics", runId],
    queryFn: () => getMetrics(runId!),
    enabled: Boolean(runId && terminal.has(run.data?.status ?? "")),
  });
  const signals = useQuery({
    queryKey: ["backtest-signals", runId],
    queryFn: () => listSignals(runId!),
    enabled: Boolean(runId && terminal.has(run.data?.status ?? "")),
  });
  const trades = useInfiniteQuery({
    queryKey: ["backtest-trades", runId],
    queryFn: ({ pageParam }) => listTrades(runId!, pageParam),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled: Boolean(runId && terminal.has(run.data?.status ?? "")),
  });
  const equity = useInfiniteQuery({
    queryKey: ["backtest-equity", runId],
    queryFn: ({ pageParam }) => listEquity(runId!, pageParam),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled: Boolean(runId && terminal.has(run.data?.status ?? "")),
  });
  const tradeItems = trades.data?.pages.flatMap((page) => page.items) ?? [];
  const equityItems = equity.data?.pages.flatMap((page) => page.items) ?? [];
  const events = useQuery({
    queryKey: ["backtest-events", runId],
    queryFn: () => listRunEvents(runId!),
    enabled: Boolean(runId),
  });
  const cancel = useMutation({ mutationFn: () => cancelBacktest(runId!) });

  return (
    <section className="backtests-page">
      <div className="page-card">
        <p className="eyebrow">Phase 4 · Platform demo</p>
        <h1>Backtests</h1>
        <div className="notice warning">
          <strong>Synthetic platform test.</strong> PLATFORM_DEMO verifies the
          data and worker pipeline. Its outputs are not trading signals or
          financial performance.
        </div>
        <form
          className="upload-form"
          onSubmit={(event) => {
            event.preventDefault();
            preflight.mutate(undefined, {
              onSuccess: () => setReviewedInputKey(inputKey),
            });
          }}
        >
          <label>
            Dataset version
            <AppSelect
              value={datasetVersionId}
              ariaLabel="Dataset version"
              placeholder="Choose a dataset…"
              onValueChange={(nextId) => {
                const nextVersion = datasetOptions.find(
                  (item) => item.version.id === nextId,
                )?.version;
                setDatasetVersionId(nextId);
                setStartDate(nextVersion?.coverage_start?.slice(0, 10) ?? "");
                setEndDate(nextVersion?.coverage_end?.slice(0, 10) ?? "");
                setAcknowledged(false);
              }}
              options={datasetOptions.map(({ datasetName, version }) => ({
                value: version.id,
                label: `${datasetName} · ${version.checksum.slice(0, 12)} · ${version.status}`,
              }))}
            />
          </label>
          <label>
            Algorithm
            <AppSelect
              value={algorithmKey}
              ariaLabel="Algorithm"
              placeholder="Choose an algorithm…"
              onValueChange={(value) => {
                setAlgorithmKey(value);
                setAlgorithmVersionId("");
              }}
              options={(algorithms.data?.items ?? []).map((algorithm) => ({
                value: algorithm.key,
                label: algorithm.display_name,
              }))}
            />
          </label>
          <label>
            Algorithm version
            <AppSelect
              value={algorithmVersionId}
              ariaLabel="Algorithm version"
              placeholder="Choose a saved version…"
              onValueChange={setAlgorithmVersionId}
              options={(algorithmVersions.data?.items ?? [])
                .filter((item) => !item.archived)
                .map((version) => ({
                  value: version.id,
                  label: version.name,
                }))}
            />
          </label>
          <label>
            Start date
            <input
              type="date"
              required
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>
          <label>
            End date
            <input
              type="date"
              required
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
          <label>
            Starting capital{" "}
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={capital}
              onChange={(event) => setCapital(event.target.value)}
            />
            <small>
              Saved for reproducibility only; never treated as financial capital
              in PLATFORM_DEMO.
            </small>
          </label>
          {datasetVersion?.status === "WARNING" && (
            <label className="acknowledgement">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
              />{" "}
              I acknowledge the dataset warnings.
            </label>
          )}
          <button disabled={!input || preflight.isPending}>
            {preflight.isPending ? "Checking…" : "Review preflight"}
          </button>
          <ErrorText error={preflight.error} />
        </form>
        {preflight.data && reviewedInputKey === inputKey && (
          <section
            className={
              preflight.data.allowed ? "notice success" : "notice warning"
            }
          >
            <h2>
              {preflight.data.allowed
                ? "Ready to start"
                : "Cannot start this run"}
            </h2>
            <p>
              {preflight.data.allowed
                ? `${preflight.data.usable_session_count} sessions are eligible.`
                : preflight.data.issues
                    .map((issue) => String(issue.message))
                    .join(" ")}
            </p>
            {!preflight.data.allowed &&
              preflight.data.missing_capabilities.length > 0 && (
                <p>
                  Missing capabilities:{" "}
                  {preflight.data.missing_capabilities.join(", ")}.
                </p>
              )}
            {preflight.data.allowed && (
              <button onClick={() => start.mutate()} disabled={start.isPending}>
                {start.isPending ? "Queueing…" : "Start platform-demo backtest"}
              </button>
            )}
            <ErrorText error={start.error} />
          </section>
        )}
      </div>
      {run.isLoading && runId && <p>Loading run…</p>}
      <ErrorText error={run.error} />
      {run.data && (
        <section className="dataset-detail result-workspace">
          <div className="dataset-detail-header">
            <h2>Run {run.data.id.slice(0, 8)}</h2>
            <span className={`badge status-${run.data.status.toLowerCase()}`}>
              {run.data.status}
            </span>
          </div>
          <p>
            Progress: {run.data.progress}% · {run.data.mode}
          </p>
          {!terminal.has(run.data.status) && (
            <p
              className={`realtime-status realtime-${connectionState}`}
              role="status"
            >
              {connectionState === "connected"
                ? "Live updates connected"
                : connectionState === "reconnecting"
                  ? "Live updates reconnecting; REST recovery remains active"
                  : "Live updates degraded; REST recovery remains active"}
            </p>
          )}
          {!terminal.has(run.data.status) && (
            <button onClick={() => cancel.mutate()} disabled={cancel.isPending}>
              Cancel run
            </button>
          )}
          <ErrorText error={cancel.error} />
          {terminal.has(run.data.status) && (
            <>
              <div className="notice warning result-warning">
                <strong>Synthetic demo outcome.</strong> These records only
                verify platform plumbing. Unit: DEMO_UNITS. Financial P&amp;L
                unavailable.
              </div>
              <section aria-labelledby="immutable-inputs-heading">
                <h3 id="immutable-inputs-heading">Immutable run inputs</h3>
                <dl className="result-inputs">
                  <div>
                    <dt>Mode</dt>
                    <dd>{run.data.mode}</dd>
                  </div>
                  <div>
                    <dt>Dataset version</dt>
                    <dd>{run.data.dataset_version_id}</dd>
                  </div>
                  <div>
                    <dt>Algorithm version</dt>
                    <dd>{run.data.algorithm_version_id}</dd>
                  </div>
                  <div>
                    <dt>Date range</dt>
                    <dd>
                      {run.data.start_date} to {run.data.end_date}
                    </dd>
                  </div>
                  <div>
                    <dt>Starting value</dt>
                    <dd>{run.data.starting_capital} (context only)</dd>
                  </div>
                  <div>
                    <dt>Saved parameters</dt>
                    <dd>
                      <code>
                        {JSON.stringify(
                          (
                            run.data.snapshot.algorithm as
                              { parameters?: unknown } | undefined
                          )?.parameters ?? {},
                        )}
                      </code>
                    </dd>
                  </div>
                  <div>
                    <dt>Demo assumptions</dt>
                    <dd>
                      <code>
                        {JSON.stringify(run.data.snapshot.assumptions ?? {})}
                      </code>
                    </dd>
                  </div>
                </dl>
              </section>

              <section aria-labelledby="demo-summary-heading">
                <h3 id="demo-summary-heading">Demo summary</h3>
                {metrics.isLoading && <p>Loading demo summary…</p>}
                <ErrorText error={metrics.error} />
                {metrics.data && (
                  <div className="metric-grid">
                    <article>
                      <span>Total trades</span>
                      <strong>
                        {String(metrics.data.metrics.total_trades ?? 0)}
                      </strong>
                    </article>
                    <article>
                      <span>Winning outcomes</span>
                      <strong>{String(metrics.data.metrics.wins ?? 0)}</strong>
                    </article>
                    <article>
                      <span>Losing outcomes</span>
                      <strong>
                        {String(metrics.data.metrics.losses ?? 0)}
                      </strong>
                    </article>
                    <article>
                      <span>Expectancy</span>
                      <strong>
                        {String(
                          metrics.data.metrics.expectancy_demo_units ?? 0,
                        )}{" "}
                        DEMO_UNITS
                      </strong>
                    </article>
                    <article>
                      <span>Maximum drawdown</span>
                      <strong>
                        {String(
                          metrics.data.metrics.max_drawdown_demo_units ?? 0,
                        )}{" "}
                        DEMO_UNITS
                      </strong>
                    </article>
                    <article>
                      <span>Processed candles</span>
                      <strong>
                        {String(metrics.data.metrics.processed_candles ?? 0)}
                      </strong>
                    </article>
                  </div>
                )}
              </section>

              <section aria-labelledby="equity-heading">
                <h3 id="equity-heading">Demo equity and drawdown</h3>
                {equity.isLoading && <p>Loading demo equity…</p>}
                <ErrorText error={equity.error} />
                {equity.data && equityItems.length === 0 && (
                  <p>No demo equity points were generated.</p>
                )}
                {equityItems.length > 0 && (
                  <div
                    className="table-scroll"
                    role="region"
                    aria-label="Scrollable equity and drawdown data"
                    tabIndex={0}
                  >
                    <table>
                      <caption>Ordered synthetic values in DEMO_UNITS</caption>
                      <thead>
                        <tr>
                          <th scope="col">Point</th>
                          <th scope="col">Time</th>
                          <th scope="col">Equity</th>
                          <th scope="col">Drawdown</th>
                        </tr>
                      </thead>
                      <tbody>
                        {equityItems.map((point) => (
                          <tr key={point.id}>
                            <th scope="row">{point.sequence}</th>
                            <td>{point.timestamp}</td>
                            <td>{point.equity_demo_units} DEMO_UNITS</td>
                            <td>{point.drawdown_demo_units} DEMO_UNITS</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {equity.hasNextPage && (
                  <button
                    onClick={() => equity.fetchNextPage()}
                    disabled={equity.isFetchingNextPage}
                  >
                    {equity.isFetchingNextPage
                      ? "Loading more points…"
                      : "Load more equity points"}
                  </button>
                )}
              </section>

              <section aria-labelledby="trades-heading">
                <h3 id="trades-heading">Synthetic trades</h3>
                {trades.isLoading && <p>Loading synthetic trades…</p>}
                <ErrorText error={trades.error} />
                {trades.data && tradeItems.length === 0 && (
                  <p>No synthetic trades were generated for this run.</p>
                )}
                {tradeItems.map((trade) => (
                  <details className="trade-card" key={trade.id}>
                    <summary>
                      Trade {trade.sequence} · {trade.net_demo_units} DEMO_UNITS
                    </summary>
                    <dl className="trade-facts">
                      <div>
                        <dt>Entry reference</dt>
                        <dd>
                          {trade.entry_reference} at {trade.entry_timestamp}
                        </dd>
                      </div>
                      <div>
                        <dt>Exit reference</dt>
                        <dd>
                          {trade.exit_reference} at {trade.exit_timestamp}
                        </dd>
                      </div>
                      <div>
                        <dt>Exit reason</dt>
                        <dd>{trade.exit_reason}</dd>
                      </div>
                      <div>
                        <dt>Gross demo outcome</dt>
                        <dd>{trade.gross_demo_units} DEMO_UNITS</dd>
                      </div>
                    </dl>
                    <h4>Two placeholder legs</h4>
                    {trade.legs.length !== 2 && (
                      <p className="error-text" role="alert">
                        This demo record does not contain exactly two
                        placeholder legs.
                      </p>
                    )}
                    <ol className="leg-list">
                      {trade.legs.map((leg) => (
                        <li key={leg.id}>
                          <strong>{leg.name}</strong>
                          <span>
                            Reference {leg.entry_reference} →{" "}
                            {leg.exit_reference}
                          </span>
                          <span>{leg.demo_units} DEMO_UNITS</span>
                        </li>
                      ))}
                    </ol>
                  </details>
                ))}
                {trades.hasNextPage && (
                  <button
                    onClick={() => trades.fetchNextPage()}
                    disabled={trades.isFetchingNextPage}
                  >
                    {trades.isFetchingNextPage
                      ? "Loading more trades…"
                      : "Load more synthetic trades"}
                  </button>
                )}
              </section>

              <section aria-labelledby="signals-heading">
                <h3 id="signals-heading">Signal decisions</h3>
                {signals.isLoading && <p>Loading signal decisions…</p>}
                <ErrorText error={signals.error} />
                {signals.data?.items.length === 0 && (
                  <p>No signal decisions were recorded.</p>
                )}
                {signals.data && signals.data.items.length > 0 && (
                  <ul>
                    {signals.data.items.slice(0, 20).map((signal) => (
                      <li key={signal.id}>
                        {signal.timestamp}: {signal.decision}
                        {signal.rejection_reason
                          ? ` · Rejection: ${signal.rejection_reason}`
                          : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-labelledby="events-heading">
                <h3 id="events-heading">Run events</h3>
                {events.isLoading && <p>Loading run events…</p>}
                <ErrorText error={events.error} />
                {events.data?.items.length === 0 && (
                  <p>No run events were recorded.</p>
                )}
                {events.data && events.data.items.length > 0 && (
                  <ol>
                    {events.data.items.map((event) => (
                      <li key={event.id}>
                        {event.sequence}. {event.event_type}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </>
          )}
        </section>
      )}
    </section>
  );
}
