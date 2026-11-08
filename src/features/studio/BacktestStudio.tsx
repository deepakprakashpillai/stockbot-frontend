import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleStop,
  Database,
  Pause,
  Play,
  Radio,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { listAlgorithms, listAlgorithmVersions } from "../../api/algorithms";
import {
  cancelBacktest,
  getBacktest,
  getLiveRunSnapshot,
  getMetrics,
  listEquity,
  listJournalEvents,
  listRunEvents,
  listSignalsInRange,
  listTrades,
  preflightBacktest,
  startBacktest,
  type BacktestPreflight,
  type BacktestRun,
} from "../../api/backtests";
import { listDatasets } from "../../api/datasets";
import { ApiError } from "../../api/system";
import type { RealtimeEvent, RealtimeMessage } from "../../realtime/types";
import { useRealtimeChannel } from "../../realtime/useRealtimeChannel";
import { DemoEquityChart } from "../backtests/DemoEquityChart";
import { StudioConfigurationPanel } from "./StudioConfigurationPanel";
import { LiveRunContext } from "./live/LiveRunContext";
import { SignalDecisionPanel } from "../signalExplorer/SignalDecisionPanel";
import {
  readRunExplorerState,
  writeRunExplorerState,
} from "../runExplorer/runExplorerSearchParams";
import { formatCurrency } from "../../lib/formatters";

const terminal = new Set(["COMPLETED", "FAILED", "CANCELLED"]);
type PreflightIssue = {
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
};
type RecommendedRange = {
  startDate: string;
  endDate: string;
  sessionCount: number;
};

function recommendedRange(
  preflight: BacktestPreflight | undefined,
): RecommendedRange | null {
  if (!preflight) return null;
  if (preflight.allowed) {
    return {
      startDate: preflight.requested_start_date,
      endDate: preflight.requested_end_date,
      sessionCount: preflight.usable_session_count,
    };
  }
  const details = preflight.issues.find(
    (issue) =>
      (issue as PreflightIssue).code === "DERIVATIVES_BUNDLE_PREFLIGHT_FAILED",
  ) as PreflightIssue | undefined;
  const range = details?.details?.recommended_range;
  if (!range || typeof range !== "object") return null;
  const values = range as Record<string, unknown>;
  return typeof values.start_date === "string" &&
    typeof values.end_date === "string" &&
    typeof values.session_count === "number"
    ? {
        startDate: values.start_date,
        endDate: values.end_date,
        sessionCount: values.session_count,
      }
    : null;
}

function statusFromEvent(event: RealtimeEvent) {
  if (event.type === "backtest.completed") return "COMPLETED";
  if (event.type === "backtest.failed") return "FAILED";
  if (event.type === "backtest.cancelled") return "CANCELLED";
  if (event.type === "backtest.started") return "RUNNING";
  return undefined;
}

function MetricTile({
  label,
  value,
  detail,
  compactValue = false,
}: {
  label: string;
  value: unknown;
  detail?: string;
  compactValue?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-surface ${compactValue ? "p-2.5" : "p-3"}`}
    >
      <p className="m-0 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
        {label}
      </p>
      <p
        className={
          compactValue
            ? "mt-1 text-sm font-medium leading-6 text-foreground"
            : "mt-1 text-xl font-semibold tabular-nums text-foreground"
        }
      >
        {String(value ?? "—")}
      </p>
      {detail && <p className="m-0 text-xs text-muted">{detail}</p>}
    </div>
  );
}

function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p className="m-0 text-sm text-danger" role="alert">
      {error instanceof ApiError
        ? error.message
        : "Something went wrong. Please try again."}
    </p>
  );
}

export function BacktestStudio() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const runId = searchParams.get("run");
  const explorer = readRunExplorerState(searchParams);
  const selection = explorer.selection;
  const rangeFilters = useMemo(
    () => ({ start: explorer.start, end: explorer.end }),
    [explorer.end, explorer.start],
  );
  const selectRecord = (
    type: "signal" | "trade" | "event" | "equity",
    id: string,
  ) =>
    setSearchParams((current) =>
      writeRunExplorerState(current, { selection: { type, id } }),
    );
  const [datasetId, setDatasetId] = useState("");
  const [algorithmKey, setAlgorithmKey] = useState("platform_demo");
  const [algorithmVersionId, setAlgorithmVersionId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [capital, setCapital] = useState("100000.00");
  const [acknowledged, setAcknowledged] = useState(false);
  const [acceptedCoverageDigest, setAcceptedCoverageDigest] = useState<
    string | null
  >(null);
  const [reviewedKey, setReviewedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "activity" | "journal" | "technical"
  >("activity");
  const [inputsOpen, setInputsOpen] = useState(false);
  const [followingLiveRun, setFollowingLiveRun] = useState(
    explorer.liveFollow !== false,
  );
  const [inspectionSequences, setInspectionSequences] = useState<{
    signal: number;
    trade: number;
    equity: number;
    event: number;
  } | null>(null);
  const refreshTimer = useRef<number | null>(null);
  const appliedDefaultRangeKey = useRef<string | null>(null);

  const datasets = useQuery({
    queryKey: ["datasets", "studio"],
    queryFn: () => listDatasets(),
  });
  const algorithms = useQuery({
    queryKey: ["algorithms", "studio"],
    queryFn: listAlgorithms,
  });
  const versions = useQuery({
    queryKey: ["algorithm-versions", algorithmKey, "studio"],
    queryFn: () => listAlgorithmVersions(algorithmKey),
    enabled: Boolean(algorithmKey),
  });

  useEffect(() => {
    const first = datasets.data?.items[0];
    if (first && !datasetId && first.latest_version) {
      setDatasetId(first.id);
      setStartDate(first.latest_version.coverage_start?.slice(0, 10) ?? "");
      setEndDate(first.latest_version.coverage_end?.slice(0, 10) ?? "");
    }
  }, [datasetId, datasets.data]);

  useEffect(() => {
    const first = versions.data?.items.find((item) => !item.archived);
    if (first) setAlgorithmVersionId(first.id);
    else setAlgorithmVersionId("");
  }, [versions.data]);

  const selectedDataset = datasets.data?.items.find(
    (item) => item.id === datasetId,
  );
  const datasetVersion = selectedDataset?.latest_version;
  const selectedAlgorithm = algorithms.data?.items.find(
    (item) => item.key === algorithmKey,
  );
  const selectedVersion = versions.data?.items.find(
    (item) => item.id === algorithmVersionId,
  );
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
            accepted_coverage_digest: acceptedCoverageDigest,
          }
        : null,
    [
      acknowledged,
      acceptedCoverageDigest,
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
  const fullCoverageInput = useMemo(
    () =>
      datasetVersion && algorithmVersionId
        ? {
            dataset_version_id: datasetVersion.id,
            algorithm_version_id: algorithmVersionId,
            start_date: datasetVersion.coverage_start?.slice(0, 10) ?? "",
            end_date: datasetVersion.coverage_end?.slice(0, 10) ?? "",
            starting_capital: capital,
            warning_acknowledged: true,
          }
        : null,
    [algorithmVersionId, capital, datasetVersion],
  );
  const rangeDefault = useQuery({
    queryKey: ["bull-call-spread-range-default", fullCoverageInput],
    queryFn: () => preflightBacktest(fullCoverageInput!),
    enabled:
      algorithmKey === "bull_call_spread" &&
      Boolean(fullCoverageInput?.start_date && fullCoverageInput.end_date),
    staleTime: Infinity,
  });
  const suggestedRange = useMemo(
    () => recommendedRange(rangeDefault.data),
    [rangeDefault.data],
  );
  const reviewedRange = useMemo(
    () => recommendedRange(preflight.data),
    [preflight.data],
  );
  const defaultRangeKey = fullCoverageInput
    ? `${fullCoverageInput.dataset_version_id}:${fullCoverageInput.algorithm_version_id}`
    : null;

  useEffect(() => {
    if (
      !defaultRangeKey ||
      !suggestedRange ||
      appliedDefaultRangeKey.current === defaultRangeKey
    ) {
      return;
    }
    appliedDefaultRangeKey.current = defaultRangeKey;
    setStartDate(suggestedRange.startDate);
    setEndDate(suggestedRange.endDate);
    setReviewedKey(null);
  }, [defaultRangeKey, suggestedRange]);
  const start = useMutation({
    mutationFn: () => startBacktest(input!),
    onSuccess: (created) => {
      setSearchParams({ run: created.id });
      setReviewedKey(null);
    },
  });
  const cancel = useMutation({ mutationFn: () => cancelBacktest(runId!) });
  const run = useQuery({
    queryKey: ["backtest", runId],
    queryFn: () => getBacktest(runId!),
    enabled: Boolean(runId),
  });
  const metrics = useQuery({
    queryKey: ["backtest-metrics", runId],
    queryFn: () => getMetrics(runId!),
    enabled: Boolean(runId),
  });
  const liveSnapshot = useQuery({
    queryKey: ["backtest-live-snapshot", runId],
    queryFn: () => getLiveRunSnapshot(runId!),
    enabled: Boolean(runId),
    refetchInterval: (query) =>
      terminal.has(query.state.data?.status ?? "") ? false : 10_000,
  });
  const signals = useInfiniteQuery({
    queryKey: ["backtest-signals", runId, rangeFilters],
    queryFn: ({ pageParam }) =>
      listSignalsInRange(runId!, pageParam, 100, rangeFilters),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled: Boolean(runId),
  });
  const trades = useInfiniteQuery({
    queryKey: ["backtest-trades", runId, rangeFilters],
    queryFn: ({ pageParam }) => listTrades(runId!, pageParam, rangeFilters),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled: Boolean(runId),
  });
  const equity = useInfiniteQuery({
    queryKey: ["backtest-equity", runId, rangeFilters],
    queryFn: ({ pageParam }) => listEquity(runId!, pageParam, rangeFilters),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled: Boolean(runId),
  });
  const events = useInfiniteQuery({
    queryKey: ["backtest-events", runId],
    queryFn: ({ pageParam }) => listRunEvents(runId!, pageParam, 100),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled: Boolean(runId),
  });
  const journal = useInfiniteQuery({
    queryKey: ["backtest-journal", runId],
    queryFn: ({ pageParam }) => listJournalEvents(runId!, pageParam, 100),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled: Boolean(runId),
  });

  const refreshLiveData = useCallback(() => {
    if (!runId || refreshTimer.current) return;
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null;
      for (const key of [
        "backtest",
        "backtest-metrics",
        "backtest-live-snapshot",
        "backtest-signals",
        "backtest-trades",
        "backtest-equity",
        "backtest-events",
        "backtest-journal",
      ]) {
        void queryClient.invalidateQueries({ queryKey: [key, runId] });
      }
    }, 180);
  }, [queryClient, runId]);

  const onEvent = useCallback(
    (event: RealtimeMessage) => {
      if ("latest_sequence" in event) {
        refreshLiveData();
        return;
      }
      const status = statusFromEvent(event);
      const progress =
        typeof event.data.percent === "number" ? event.data.percent : undefined;
      queryClient.setQueryData<BacktestRun>(["backtest", runId], (current) =>
        current
          ? {
              ...current,
              ...(status ? { status } : {}),
              ...(progress === undefined ? {} : { progress }),
            }
          : current,
      );
      refreshLiveData();
    },
    [queryClient, refreshLiveData, runId],
  );

  const { connectionState } = useRealtimeChannel(
    runId ? `backtest:${runId}` : null,
    onEvent,
  );

  useEffect(
    () => () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!runId || connectionState === "connected") return;
    const timer = window.setInterval(refreshLiveData, 10_000);
    return () => window.clearInterval(timer);
  }, [connectionState, refreshLiveData, runId]);

  const liveRun = run.data;
  const checkpoint = liveSnapshot.data;
  const liveMetrics = metrics.data?.metrics ?? {};
  const signalItems = signals.data?.pages.flatMap((page) => page.items) ?? [];
  const tradeItems = trades.data?.pages.flatMap((page) => page.items) ?? [];
  const equityItems = equity.data?.pages.flatMap((page) => page.items) ?? [];
  const eventItems = events.data?.pages.flatMap((page) => page.items) ?? [];
  const journalItems = journal.data?.pages.flatMap((page) => page.items) ?? [];

  const inspectedSignalItems = inspectionSequences
    ? signalItems.filter((item) => item.sequence <= inspectionSequences.signal)
    : signalItems;
  const inspectedTradeItems = inspectionSequences
    ? tradeItems.filter((item) => item.sequence <= inspectionSequences.trade)
    : tradeItems;
  const inspectedEquityItems = inspectionSequences
    ? equityItems.filter((item) => item.sequence <= inspectionSequences.equity)
    : equityItems;
  const inspectedEventItems = inspectionSequences
    ? eventItems.filter((item) => item.sequence <= inspectionSequences.event)
    : eventItems;

  const isReviewed = Boolean(preflight.data && reviewedKey === inputKey);
  const running = liveRun && !terminal.has(liveRun.status);

  const setLiveFollowing = (following: boolean) => {
    setFollowingLiveRun(following);
    setSearchParams((current) =>
      writeRunExplorerState(current, { liveFollow: following }),
    );
    setInspectionSequences(
      following || !checkpoint
        ? null
        : {
            signal: checkpoint.latest_signal_sequence,
            trade: checkpoint.latest_trade_sequence,
            equity: checkpoint.latest_equity_sequence,
            event: checkpoint.latest_event_sequence,
          },
    );
  };

  const resetRun = () => {
    setSearchParams({});
    setReviewedKey(null);
  };

  const changeInput = (change: () => void) => {
    change();
    setAcceptedCoverageDigest(null);
    setReviewedKey(null);
  };

  return (
    <section className="mx-auto flex min-h-0 w-full max-w-[1800px] flex-col gap-4">
      {/* Top Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-5 py-4">
        <div>
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.12em] text-brand">
            Backtest Studio
          </p>
          <h1 className="m-0 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {runId ? "Live execution & monitoring" : "Configure & run backtest"}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 font-semibold ${
              (liveRun?.mode ||
                (algorithmKey === "bull_call_spread"
                  ? "OPTION_SPREAD_SIMULATION"
                  : "PLATFORM_DEMO")) === "OPTION_SPREAD_SIMULATION"
                ? "border-success/30 bg-success/10 text-success"
                : "border-brand/30 bg-brand/10 text-brand"
            }`}
          >
            <ShieldCheck size={14} />{" "}
            {liveRun?.mode ||
              (algorithmKey === "bull_call_spread"
                ? "OPTION_SPREAD_SIMULATION (₹)"
                : "PLATFORM_DEMO")}
          </span>
          {runId && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-semibold ${
                connectionState === "connected"
                  ? "bg-success/10 text-success"
                  : "bg-warning/10 text-warning"
              }`}
            >
              <Radio size={13} />{" "}
              {connectionState === "connected"
                ? "Live connected"
                : "Reconnecting"}
            </span>
          )}
          {runId && (
            <button
              type="button"
              onClick={resetRun}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 font-semibold text-foreground hover:bg-surface-subtle"
            >
              <RotateCcw size={13} /> New run
            </button>
          )}
        </div>
      </header>

      {/* STATE A: CONFIGURATION (When !runId) */}
      {!runId && (
        <div className="grid min-h-0 gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
          <StudioConfigurationPanel
            datasetId={datasetId}
            datasetOptions={(datasets.data?.items ?? [])
              .filter((item) => item.latest_version)
              .map((item) => ({
                value: item.id,
                label: `${item.name} · ${item.latest_version?.status}`,
              }))}
            onDatasetChange={(value) =>
              changeInput(() => {
                const item = datasets.data?.items.find(
                  (dataset) => dataset.id === value,
                );
                setDatasetId(value);
                setStartDate(
                  item?.latest_version?.coverage_start?.slice(0, 10) ?? "",
                );
                setEndDate(
                  item?.latest_version?.coverage_end?.slice(0, 10) ?? "",
                );
                setAcknowledged(false);
              })
            }
            startDate={startDate}
            endDate={endDate}
            coverageStart={datasetVersion?.coverage_start}
            coverageEnd={datasetVersion?.coverage_end}
            sessionCount={datasetVersion?.session_count}
            onStartDateChange={(value) =>
              changeInput(() => setStartDate(value))
            }
            onEndDateChange={(value) => changeInput(() => setEndDate(value))}
            algorithmKey={algorithmKey}
            algorithmOptions={(algorithms.data?.items ?? []).map((item) => ({
              value: item.key,
              label: item.display_name,
            }))}
            onAlgorithmChange={(value) =>
              changeInput(() => setAlgorithmKey(value))
            }
            algorithmVersionId={algorithmVersionId}
            versionOptions={(versions.data?.items ?? [])
              .filter((item) => !item.archived)
              .map((item) => ({
                value: item.id,
                label: `${item.name} · v${item.version_number}`,
              }))}
            onVersionChange={(value) =>
              changeInput(() => setAlgorithmVersionId(value))
            }
            algorithmDescription={selectedAlgorithm?.description}
            algorithmCodeVersion={selectedAlgorithm?.code_version}
            capital={capital}
            onCapitalChange={(value) => changeInput(() => setCapital(value))}
            showDatasetWarning={datasetVersion?.status === "WARNING"}
            acknowledged={acknowledged}
            onAcknowledgedChange={(value) =>
              changeInput(() => setAcknowledged(value))
            }
            reviewDisabled={!input || preflight.isPending}
            reviewPending={preflight.isPending}
            onReview={() =>
              preflight.mutate(undefined, {
                onSuccess: () => setReviewedKey(inputKey),
              })
            }
            errorContent={<ErrorText error={preflight.error} />}
          />

          {/* Main Area: Preflight Overview / Ready to start */}
          <main className="min-w-0 rounded-2xl border border-border bg-surface p-5">
            <div className="flex min-h-[560px] flex-col gap-5">
              <div className="rounded-xl border border-border bg-surface-subtle p-5">
                <div className="flex items-start gap-3">
                  <Database className="mt-0.5 text-brand" size={22} />
                  <div>
                    <h2 className="m-0 text-xl font-semibold text-foreground">
                      Run Readiness Workspace
                    </h2>
                    <p className="mb-0 mt-1 max-w-2xl text-sm text-muted-foreground">
                      Configure immutable inputs on the left. The preflight
                      check guarantees full data compatibility before launching
                      your deterministic backtest.
                    </p>
                  </div>
                </div>
              </div>

              {isReviewed ? (
                <section
                  className={`rounded-xl border p-6 ${
                    preflight.data?.allowed
                      ? "border-success/30 bg-success/5"
                      : "border-warning/30 bg-warning/5"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        {preflight.data?.allowed ? (
                          <CheckCircle2 className="text-success" size={20} />
                        ) : (
                          <AlertCircle className="text-warning" size={20} />
                        )}
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Preflight summary
                        </span>
                      </div>
                      <h3 className="mt-1 text-2xl font-bold text-foreground">
                        {preflight.data?.allowed
                          ? algorithmKey === "bull_call_spread"
                            ? "Ready for financial simulation"
                            : "Ready for a durable demo run"
                          : "Resolve run constraints"}
                      </h3>
                      <p className="mb-0 text-sm text-muted-foreground">
                        {preflight.data?.allowed
                          ? `${preflight.data.usable_session_count} eligible sessions · ${preflight.data.estimated_row_count} estimated candles`
                          : preflight.data?.issues
                              .map((issue) =>
                                String(issue.message ?? issue.code),
                              )
                              .join(" ")}
                      </p>
                    </div>
                    {preflight.data?.allowed && (
                      <button
                        type="button"
                        disabled={start.isPending}
                        onClick={() => start.mutate()}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                      >
                        <Play size={18} fill="currentColor" />
                        {start.isPending ? "Starting run…" : "Launch Backtest"}
                      </button>
                    )}
                  </div>

                  {preflight.data?.warnings &&
                    preflight.data.warnings.length > 0 && (
                      <div className="mt-4 rounded-lg bg-warning/10 p-3.5 text-sm text-warning">
                        <AlertTriangle className="mr-2 inline" size={16} />
                        {preflight.data.warnings
                          .map((warning) =>
                            String(warning.message ?? warning.code),
                          )
                          .join(" ")}
                      </div>
                    )}
                  {!preflight.data?.allowed && preflight.data?.issues.length ? (
                    <div className="mt-4 space-y-3 rounded-lg border border-warning/30 bg-surface p-3.5 text-sm text-foreground">
                      <p className="m-0 font-semibold">What needs changing</p>
                      {preflight.data.issues.map((issue, index) => {
                        const typedIssue = issue as PreflightIssue;
                        const reason =
                          typedIssue.details &&
                          typeof typedIssue.details.reason === "string"
                            ? typedIssue.details.reason
                            : null;
                        return (
                          <p
                            key={`${typedIssue.code ?? "issue"}-${index}`}
                            className="m-0 text-muted-foreground"
                          >
                            <span className="font-medium text-foreground">
                              {typedIssue.message ??
                                typedIssue.code ??
                                "Preflight issue"}
                            </span>
                            {reason ? ` ${reason}` : null}
                          </p>
                        );
                      })}
                      {preflight.data.coverage_status === "PARTIAL" &&
                      preflight.data.coverage_digest ? (
                        <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                          <p className="m-0 font-semibold text-foreground">
                            {preflight.data.included_session_count} sessions
                            included · {preflight.data.excluded_session_count}{" "}
                            sessions excluded
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            The excluded days will not trade and will not count
                            in performance totals. This acknowledgement is tied
                            to digest{" "}
                            <span className="font-mono">
                              {preflight.data.coverage_digest.slice(0, 12)}…
                            </span>
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setAcknowledged(true);
                              setAcceptedCoverageDigest(
                                preflight.data!.coverage_digest,
                              );
                              setReviewedKey(null);
                            }}
                            className="mt-2 inline-flex rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm font-semibold text-warning focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning"
                          >
                            Acknowledge these exact exclusions
                          </button>
                        </div>
                      ) : null}
                      {reviewedRange ? (
                        <button
                          type="button"
                          onClick={() =>
                            changeInput(() => {
                              setStartDate(reviewedRange.startDate);
                              setEndDate(reviewedRange.endDate);
                            })
                          }
                          className="inline-flex rounded-lg border border-brand/40 bg-brand/10 px-3 py-2 text-sm font-semibold text-brand transition hover:bg-brand/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                        >
                          Use longest supported range: {reviewedRange.startDate}{" "}
                          → {reviewedRange.endDate} (
                          {reviewedRange.sessionCount} sessions)
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  <ErrorText error={start.error} />
                </section>
              ) : (
                <section className="grid gap-3 sm:grid-cols-3">
                  <MetricTile
                    label="Dataset coverage"
                    compactValue
                    value={
                      datasetVersion
                        ? `${datasetVersion.coverage_start?.slice(0, 10)} → ${datasetVersion.coverage_end?.slice(0, 10)}`
                        : "Choose dataset"
                    }
                  />
                  <MetricTile
                    label="Algorithm"
                    compactValue
                    value={
                      selectedAlgorithm?.display_name ?? "Choose algorithm"
                    }
                    detail={
                      selectedVersion
                        ? `Version ${selectedVersion.version_number}`
                        : undefined
                    }
                  />
                  <MetricTile
                    label="Status"
                    compactValue
                    value={
                      input ? "Ready for review" : "Complete configuration"
                    }
                    detail="Click Review Preflight to proceed."
                  />
                </section>
              )}

              <section className="mt-auto rounded-xl border border-border bg-surface-subtle/50 p-4">
                <p className="m-0 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {algorithmKey === "bull_call_spread"
                    ? "Financial Simulation Fidelity"
                    : "Synthetic Platform Boundary"}
                </p>
                <p className="mb-0 mt-1 text-xs text-muted-foreground leading-relaxed">
                  {algorithmKey === "bull_call_spread"
                    ? "Bull Call Spread runs use OPTION_SPREAD_SIMULATION to estimate INR outcomes from historical weekly option candle closes, NIFTY Futures VWAP, India VIX, configured slippage, and a flat round-trip cost. They are not executable bid/ask fills."
                    : "Platform Demo runs execute in PLATFORM_DEMO mode using synthetic DEMO_UNITS for platform verification."}
                </p>
              </section>
            </div>
          </main>
        </div>
      )}

      {/* STATE B: LIVE RUN & MONITORING (When runId is present) */}
      {runId && (
        <div className="flex flex-col gap-4">
          {/* 1. Collapsed Immutable Inputs */}
          <div className="rounded-xl border border-border bg-surface p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                <div>
                  <span className="text-muted-foreground">Dataset: </span>
                  <span className="font-semibold text-foreground">
                    {selectedDataset?.name ?? "Dataset"} (v
                    {datasetVersion?.version_number ?? 1})
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Algorithm: </span>
                  <span className="font-semibold text-foreground">
                    {selectedAlgorithm?.display_name ?? algorithmKey} (v
                    {selectedVersion?.version_number ?? 1})
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Range: </span>
                  <span className="font-semibold text-foreground font-mono">
                    {liveRun
                      ? `${liveRun.start_date} → ${liveRun.end_date}`
                      : `${startDate} → ${endDate}`}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">
                    Starting capital:{" "}
                  </span>
                  <span className="font-semibold text-foreground font-mono">
                    {liveRun?.starting_capital ?? capital}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInputsOpen(!inputsOpen)}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
              >
                Inspect inputs{" "}
                <ChevronDown
                  size={14}
                  className={`transition-transform ${inputsOpen ? "rotate-180" : ""}`}
                />
              </button>
            </div>
            {inputsOpen && (
              <div className="mt-3 grid gap-3 border-t border-border pt-3 text-xs md:grid-cols-4">
                <MetricTile
                  label="Dataset Version ID"
                  compactValue
                  value={
                    liveRun?.dataset_version_id ?? datasetVersion?.id ?? "—"
                  }
                />
                <MetricTile
                  label="Algorithm Version ID"
                  compactValue
                  value={
                    liveRun?.algorithm_version_id ?? selectedVersion?.id ?? "—"
                  }
                />
                <MetricTile
                  label="Run Mode"
                  compactValue
                  value={liveRun?.mode ?? "PLATFORM_DEMO"}
                />
                <MetricTile label="Run ID" compactValue value={runId} />
              </div>
            )}
          </div>

          {/* 2. Unified Sticky Run Bar */}
          <div className="sticky top-2 z-20 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface/95 p-3.5 shadow-sm backdrop-blur">
            <div className="flex items-center gap-3">
              <span
                className={`rounded-md px-2.5 py-1 text-xs font-bold ${
                  liveRun?.status === "COMPLETED"
                    ? "bg-success/15 text-success"
                    : liveRun?.status === "FAILED"
                      ? "bg-destructive/15 text-destructive"
                      : liveRun?.status === "CANCELLED"
                        ? "bg-muted text-muted-foreground"
                        : "bg-brand/15 text-brand animate-pulse"
                }`}
              >
                {liveRun?.status ?? "RUNNING"}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                Run #{runId.slice(0, 8)}
              </span>
            </div>

            {/* Center progress and candle counter */}
            <div className="flex flex-1 items-center justify-center gap-4 min-w-[240px] max-w-md">
              <div className="w-full">
                <div className="flex justify-between text-xs font-medium text-muted-foreground mb-1">
                  <span>Progress</span>
                  <span>{liveRun?.progress ?? 0}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-subtle border border-border">
                  <div
                    className="h-full rounded-full bg-brand transition-all duration-500"
                    style={{ width: `${liveRun?.progress ?? 0}%` }}
                  />
                </div>
              </div>
              <div className="shrink-0 text-xs text-muted-foreground whitespace-nowrap font-mono">
                {checkpoint
                  ? `${checkpoint.processed_candles} / ${checkpoint.total_candles || "?"} candles`
                  : "Syncing..."}
              </div>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLiveFollowing(!followingLiveRun)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-subtle"
              >
                {followingLiveRun ? <Pause size={13} /> : <Play size={13} />}
                {followingLiveRun ? "Pause follow" : "Follow live"}
              </button>

              {running && (
                <button
                  type="button"
                  onClick={() => cancel.mutate()}
                  disabled={cancel.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  <CircleStop size={14} />
                  {cancel.isPending ? "Cancelling…" : "Cancel run"}
                </button>
              )}

              {liveRun?.status === "COMPLETED" && (
                <Link
                  to={`/backtests/${runId}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground transition hover:opacity-90"
                >
                  View full results <ArrowRight size={14} />
                </Link>
              )}
            </div>
          </div>

          {/* 3. State Transition / Outcome Banners */}
          {liveRun?.status === "COMPLETED" && (
            <div className="rounded-2xl border border-success/30 bg-success/5 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-success">
                    <CheckCircle2 size={20} />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Run Completed
                    </span>
                  </div>
                  <h3 className="mt-1 text-xl font-bold text-foreground">
                    Deterministic Backtest Finished Successfully
                  </h3>
                  <p className="mb-0 text-xs text-muted-foreground">
                    All{" "}
                    {checkpoint?.processed_candles ??
                      (typeof liveMetrics.processed_candles === "number" ||
                      typeof liveMetrics.processed_candles === "string"
                        ? String(liveMetrics.processed_candles)
                        : "?")}{" "}
                    candles processed. Synthetic trade outcomes and diagnostic
                    explanations are now available.
                  </p>
                </div>
                <Link
                  to={`/backtests/${runId}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow transition hover:opacity-90"
                >
                  View Full Results & Trade Breakdown <ChevronRight size={16} />
                </Link>
              </div>

              {/* Concise Outcome Metrics */}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-success/20 pt-4">
                <div>
                  <span className="text-xs text-muted-foreground block">
                    Net Profit / Loss
                  </span>
                  <span
                    className={`font-mono text-base font-bold ${
                      Number(
                        liveRun.outcome_summary?.net_outcome ??
                          (typeof liveMetrics.net_outcome === "number" ||
                          typeof liveMetrics.net_outcome === "string"
                            ? liveMetrics.net_outcome
                            : 0),
                      ) >= 0
                        ? "text-success"
                        : "text-destructive"
                    }`}
                  >
                    {formatCurrency(
                      liveRun.outcome_summary?.net_outcome ??
                        (typeof liveMetrics.net_outcome === "number" ||
                        typeof liveMetrics.net_outcome === "string"
                          ? liveMetrics.net_outcome
                          : 0),
                      liveRun.outcome_summary?.unit ||
                        (liveRun.mode === "OPTION_SPREAD_SIMULATION"
                          ? "INR"
                          : "DEMO"),
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">
                    Max Drawdown
                  </span>
                  <span className="font-mono text-base font-bold text-destructive">
                    {formatCurrency(
                      liveRun.outcome_summary?.max_drawdown_amount ??
                        (typeof liveMetrics.max_drawdown_demo_units ===
                          "number" ||
                        typeof liveMetrics.max_drawdown_demo_units === "string"
                          ? liveMetrics.max_drawdown_demo_units
                          : 0),
                      liveRun.outcome_summary?.unit ||
                        (liveRun.mode === "OPTION_SPREAD_SIMULATION"
                          ? "INR"
                          : "DEMO"),
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">
                    Trades (Wins / Losses)
                  </span>
                  <span className="font-mono text-base font-bold text-foreground">
                    {liveRun.outcome_summary?.trade_count ??
                      (typeof liveMetrics.total_trades === "number"
                        ? liveMetrics.total_trades
                        : 0)}{" "}
                    (
                    {liveRun.outcome_summary?.wins ??
                      (typeof liveMetrics.wins === "number"
                        ? liveMetrics.wins
                        : 0)}
                    W /{" "}
                    {liveRun.outcome_summary?.losses ??
                      (typeof liveMetrics.losses === "number"
                        ? liveMetrics.losses
                        : 0)}
                    L)
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">
                    Candles Evaluated
                  </span>
                  <span className="font-mono text-base font-bold text-foreground">
                    {checkpoint?.processed_candles ??
                      (typeof liveMetrics.processed_candles === "number"
                        ? liveMetrics.processed_candles
                        : 0)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {liveRun?.status === "FAILED" && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
              <div className="flex items-start gap-3">
                <XCircle
                  className="text-destructive mt-0.5 shrink-0"
                  size={22}
                />
                <div className="flex-1">
                  <h3 className="m-0 text-lg font-bold text-destructive">
                    Run Failed: {liveRun.error_code ?? "UNKNOWN_FAILURE"}
                  </h3>
                  <p className="mt-1 text-sm text-foreground/90">
                    {liveRun.error_message ??
                      "No additional failure details were stored."}
                  </p>
                  <div className="mt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={resetRun}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-4 py-2 text-xs font-bold text-foreground border border-border hover:bg-surface-subtle"
                    >
                      <RotateCcw size={13} /> Configure New Run
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {liveRun?.status === "CANCELLED" && (
            <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-warning">
                <AlertTriangle size={18} />
                <span className="text-sm font-semibold">
                  Backtest was cancelled. Stopped after processing{" "}
                  {checkpoint?.processed_candles ?? 0} candles.
                </span>
              </div>
              <button
                type="button"
                onClick={resetRun}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-bold text-foreground hover:bg-surface-subtle"
              >
                Start New Run
              </button>
            </div>
          )}

          {/* 4. Live Charts & Metrics */}
          <div className="grid gap-4">
            {/* Candle Context Chart */}
            <LiveRunContext
              datasetVersionId={liveRun?.dataset_version_id}
              snapshot={checkpoint}
              signals={inspectedSignalItems}
              trades={inspectedTradeItems}
              onSelectSignal={(id) => selectRecord("signal", id)}
              onSelectTrade={(id) => selectRecord("trade", id)}
            />

            {/* Live Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricTile
                label="Processed candles"
                value={
                  checkpoint?.processed_candles ??
                  liveMetrics.processed_candles ??
                  "0"
                }
              />
              <MetricTile
                label="Accepted signals"
                value={liveMetrics.accepted_signals ?? "0"}
              />
              <MetricTile
                label={
                  liveRun?.mode === "OPTION_SPREAD_SIMULATION"
                    ? "Estimated spread trades"
                    : "Demo trades"
                }
                value={liveMetrics.total_trades ?? "0"}
              />
              <MetricTile
                label="Max drawdown"
                value={
                  liveMetrics.max_drawdown_demo_units
                    ? formatCurrency(
                        liveMetrics.max_drawdown_demo_units,
                        liveRun?.mode === "OPTION_SPREAD_SIMULATION"
                          ? "INR"
                          : "DEMO",
                      )
                    : liveRun?.mode === "OPTION_SPREAD_SIMULATION"
                      ? "₹0.00"
                      : "0 DEMO"
                }
              />
            </div>

            {/* Live Equity Chart */}
            {inspectedEquityItems.length ? (
              <div className="rounded-2xl border border-border bg-surface p-4">
                <h3 className="m-0 mb-3 text-sm font-semibold text-foreground">
                  {liveRun?.mode === "OPTION_SPREAD_SIMULATION"
                    ? "Live Portfolio Equity & Drawdown (₹)"
                    : "Live Synthetic Equity & Drawdown"}
                </h3>
                {liveRun?.mode === "OPTION_SPREAD_SIMULATION" && (
                  <p className="mb-3 mt-0 text-xs text-muted-foreground">
                    The first equity point is starting capital. Each later point
                    is a closed trade.
                  </p>
                )}
                <DemoEquityChart
                  items={inspectedEquityItems.slice(-500)}
                  unit={
                    liveRun?.outcome_summary?.unit ||
                    (liveRun?.mode === "OPTION_SPREAD_SIMULATION"
                      ? "INR"
                      : "DEMO")
                  }
                  selectedPointId={
                    selection.type === "equity" ? selection.id : undefined
                  }
                  range={rangeFilters}
                  onSelectPoint={(point) => selectRecord("equity", point.id)}
                  onVisibleRangeChange={(range) =>
                    setSearchParams((current) =>
                      writeRunExplorerState(current, range),
                    )
                  }
                />
              </div>
            ) : (
              <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-border bg-surface-subtle/40 p-6 text-center text-sm text-muted-foreground">
                <Activity className="mr-2 text-brand" size={18} />
                {running
                  ? "Waiting for the first durable synthetic equity checkpoint…"
                  : "No synthetic equity points were generated for this run."}
              </div>
            )}

            {/* 5. Live Activity & Technical Details Tabs */}
            <div className="rounded-2xl border border-border bg-surface overflow-hidden">
              <div className="flex border-b border-border bg-surface-subtle/50 px-4">
                <button
                  type="button"
                  onClick={() => setActiveTab("activity")}
                  className={`px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                    activeTab === "activity"
                      ? "border-b-2 border-brand text-brand"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Live Activity (
                  {inspectedTradeItems.length + inspectedSignalItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("journal")}
                  className={`px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                    activeTab === "journal"
                      ? "border-b-2 border-brand text-brand"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Trade Journal ({journalItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("technical")}
                  className={`px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                    activeTab === "technical"
                      ? "border-b-2 border-brand text-brand"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Technical Details
                </button>
              </div>

              <div className="p-4">
                {activeTab === "activity" && (
                  <div className="space-y-2">
                    {inspectedTradeItems.length === 0 &&
                      inspectedSignalItems.length === 0 && (
                        <p className="m-0 py-8 text-center text-sm text-muted-foreground">
                          Live activity stream will populate at durable
                          checkpoints.
                        </p>
                      )}

                    {inspectedTradeItems
                      .slice(-8)
                      .reverse()
                      .map((trade) => (
                        <div
                          key={trade.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => selectRecord("trade", trade.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              selectRecord("trade", trade.id);
                            }
                          }}
                          className="flex items-center justify-between rounded-lg border border-border bg-surface-subtle/60 px-3.5 py-2.5 text-sm transition hover:bg-surface-subtle"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-muted-foreground">
                              Trade #{trade.sequence}
                            </span>
                            <span className="text-foreground capitalize font-medium">
                              {trade.exit_reason
                                .replace(/_/g, " ")
                                .toLowerCase()}
                            </span>
                          </div>
                          <span
                            className={`font-mono font-bold ${
                              Number(trade.net_demo_units) > 0
                                ? "text-success"
                                : Number(trade.net_demo_units) < 0
                                  ? "text-destructive"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {formatCurrency(
                              trade.net_demo_units,
                              trade.unit ||
                                (liveRun?.mode === "OPTION_SPREAD_SIMULATION"
                                  ? "INR"
                                  : "DEMO"),
                            )}
                          </span>
                        </div>
                      ))}

                    {inspectedSignalItems
                      .slice(-10)
                      .reverse()
                      .map((signal) => (
                        <div
                          key={signal.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => selectRecord("signal", signal.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              selectRecord("signal", signal.id);
                            }
                          }}
                          className="flex items-center justify-between rounded-lg border border-border/50 bg-surface-subtle/30 px-3.5 py-2 text-xs transition hover:bg-surface-subtle"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-muted-foreground">
                              Signal #{signal.sequence}
                            </span>
                            <span className="font-medium text-foreground">
                              {signal.decision === "ACCEPTED"
                                ? "Decision: Accepted"
                                : `Rejected: ${signal.rejection_reason ?? "Criteria not met"}`}
                            </span>
                          </div>
                          <span
                            className={
                              signal.decision === "ACCEPTED"
                                ? "text-success font-semibold"
                                : "text-muted-foreground"
                            }
                          >
                            {signal.timestamp.slice(0, 16)}
                          </span>
                        </div>
                      ))}
                  </div>
                )}

                {activeTab === "journal" && (
                  <div className="space-y-2">
                    {journalItems.length === 0 ? (
                      <p className="m-0 py-8 text-center text-sm text-muted-foreground">
                        Persisted entry and position checks will appear here as
                        the worker runs.
                      </p>
                    ) : (
                      journalItems.map((entry) => (
                        <div
                          key={entry.id}
                          className="grid gap-2 rounded-lg border border-border bg-surface-subtle/40 p-3 text-xs sm:grid-cols-[96px_150px_1fr]"
                        >
                          <span className="font-mono text-muted-foreground">
                            #{entry.sequence}
                          </span>
                          <span className="font-semibold text-foreground">
                            {entry.event_type.replaceAll("_", " ")}
                          </span>
                          <span className="text-muted-foreground">
                            {entry.timestamp.slice(0, 19)}
                            {entry.position_state
                              ? ` · ${entry.position_state}`
                              : ""}
                          </span>
                        </div>
                      ))
                    )}
                    {journal.hasNextPage && (
                      <button
                        type="button"
                        onClick={() => journal.fetchNextPage()}
                        disabled={journal.isFetchingNextPage}
                        className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground"
                      >
                        {journal.isFetchingNextPage
                          ? "Loading…"
                          : "Load more journal events"}
                      </button>
                    )}
                  </div>
                )}

                {activeTab === "technical" && (
                  <div className="space-y-6">
                    {/* Linked Range Controls */}
                    <div className="rounded-xl border border-border bg-surface-subtle/50 p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                        <p className="m-0 text-xs font-semibold text-foreground">
                          Linked Inspection Range
                        </p>
                        <button
                          type="button"
                          className="text-xs font-semibold text-brand underline underline-offset-2 disabled:text-muted"
                          disabled={!explorer.start && !explorer.end}
                          onClick={() =>
                            setSearchParams((current) =>
                              writeRunExplorerState(current, {
                                start: "",
                                end: "",
                              }),
                            )
                          }
                        >
                          Reset range
                        </button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                          Start ISO timestamp
                          <input
                            aria-label="Studio exploration range start"
                            value={explorer.start ?? ""}
                            onChange={(event) =>
                              setSearchParams((current) =>
                                writeRunExplorerState(current, {
                                  start: event.target.value || "",
                                }),
                              )
                            }
                            placeholder="2026-01-02T09:15:00+05:30"
                            className="rounded-lg border border-border bg-surface px-2.5 py-1.5 font-mono text-xs text-foreground"
                          />
                        </label>
                        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                          End ISO timestamp
                          <input
                            aria-label="Studio exploration range end"
                            value={explorer.end ?? ""}
                            onChange={(event) =>
                              setSearchParams((current) =>
                                writeRunExplorerState(current, {
                                  end: event.target.value || "",
                                }),
                              )
                            }
                            placeholder="2026-01-02T15:30:00+05:30"
                            className="rounded-lg border border-border bg-surface px-2.5 py-1.5 font-mono text-xs text-foreground"
                          />
                        </label>
                      </div>
                    </div>

                    {/* Checkpoint Sequences */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <MetricTile
                        label="Signal Sequence"
                        compactValue
                        value={checkpoint?.latest_signal_sequence ?? "—"}
                      />
                      <MetricTile
                        label="Trade Sequence"
                        compactValue
                        value={checkpoint?.latest_trade_sequence ?? "—"}
                      />
                      <MetricTile
                        label="Equity Sequence"
                        compactValue
                        value={checkpoint?.latest_equity_sequence ?? "—"}
                      />
                      <MetricTile
                        label="Event Sequence"
                        compactValue
                        value={checkpoint?.latest_event_sequence ?? "—"}
                      />
                    </div>

                    {/* Raw Event Logs */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                        Durable Telemetry Log
                      </h4>
                      <div className="space-y-2 font-mono text-xs max-h-60 overflow-auto">
                        {inspectedEventItems
                          .slice(-15)
                          .reverse()
                          .map((event) => (
                            <div
                              key={event.id}
                              className="rounded-lg bg-surface-subtle border border-border p-3"
                            >
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-brand">
                                  #{event.sequence} {event.event_type}
                                </span>
                                <span className="text-muted-foreground">
                                  {event.created_at}
                                </span>
                              </div>
                              <pre className="mt-2 overflow-auto text-[11px] text-muted-foreground">
                                {JSON.stringify(event.payload, null, 2)}
                              </pre>
                            </div>
                          ))}
                        {!inspectedEventItems.length && (
                          <p className="text-xs text-muted-foreground">
                            No durable events recorded yet.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <ErrorText
            error={
              run.error ??
              metrics.error ??
              signals.error ??
              trades.error ??
              equity.error ??
              events.error ??
              cancel.error
            }
          />
        </div>
      )}

      {/* Signal Decision Drawer (deep-linkable) */}
      <SignalDecisionPanel
        runId={runId ?? ""}
        signalId={selection.type === "signal" ? selection.id : undefined}
        onClose={() =>
          setSearchParams((current) =>
            writeRunExplorerState(current, { selection: { type: "none" } }),
          )
        }
        onSelectSignal={(id) => selectRecord("signal", id)}
        onSelectTrade={(id) => selectRecord("trade", id)}
      />
    </section>
  );
}
