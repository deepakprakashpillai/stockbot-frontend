import { useEffect, useMemo } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { ArrowLeft, AlertTriangle, XCircle } from "lucide-react";

import {
  downloadBacktestExport,
  getBacktest,
  getEquityPoint,
  getRunEvent,
  getSignal,
  getTrade,
  listEquity,
  listRunEvents,
  listSignalsInRange,
  listTrades,
  type BacktestRun,
  type ExportFormat,
  type ExportKind,
} from "../../api/backtests";
import { ApiError } from "../../api/system";
import { formatPlatformDateTime } from "../../lib/dateTime";
import { formatCurrency } from "../../lib/formatters";
import type { RealtimeEvent } from "../../realtime/types";
import { useRealtimeChannel } from "../../realtime/useRealtimeChannel";
import { DemoEquityChart } from "./DemoEquityChart";
import { RunAnalyticsWorkspace } from "./RunAnalyticsWorkspace";
import { RunResultOverview } from "./RunResultOverview";
import { RunSystemActivity } from "./RunSystemActivity";
import { RunSignalExplorer } from "./RunSignalExplorer";
import { TradeOutcomeList } from "./TradeOutcomeList";
import { SignalDecisionPanel } from "../signalExplorer/SignalDecisionPanel";
import {
  readRunExplorerState,
  writeRunExplorerState,
  type RunWorkspaceSelection,
} from "../runExplorer/runExplorerSearchParams";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AppSelect } from "@/components/ui/app-select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const terminal = new Set(["COMPLETED", "FAILED", "CANCELLED"]);

function ErrorText({ error }: { error: unknown }) {
  if (!(error instanceof ApiError)) return null;
  return (
    <div className="bg-destructive/10 text-destructive border border-destructive/20 p-4 rounded-lg flex items-start gap-3 my-4">
      <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
      <div>
        <p className="font-semibold text-sm">{error.message}</p>
        {error.requestId && (
          <p className="text-xs mt-1 opacity-80">
            Request ID: {error.requestId}
          </p>
        )}
      </div>
    </div>
  );
}

function statusFromEvent(event: RealtimeEvent) {
  if (event.type === "backtest.completed") return "COMPLETED";
  if (event.type === "backtest.failed") return "FAILED";
  if (event.type === "backtest.cancelled") return "CANCELLED";
  if (event.type === "backtest.started") return "RUNNING";
  return undefined;
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <ScrollArea className="h-[200px] w-full rounded-md border border-border bg-muted/30 p-4">
      <pre className="text-xs font-mono text-muted-foreground">
        {JSON.stringify(value ?? {}, null, 2)}
      </pre>
    </ScrollArea>
  );
}

function MetricCard({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex flex-col bg-surface/50 border border-border rounded-lg p-4">
      <span className="text-xs text-muted-foreground mb-1">{label}</span>
      <strong className="text-lg text-foreground tracking-tight">
        {String(value ?? "Unavailable")}
      </strong>
    </div>
  );
}

export function BacktestResultPage() {
  const { runId = "" } = useParams();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const comparisonReturn = searchParams.get("comparison_return");
  const backTarget = comparisonReturn?.startsWith("/comparisons")
    ? comparisonReturn
    : "/backtests/history";
  const explorer = readRunExplorerState(searchParams);
  const legacySelectedTradeId = searchParams.get("selected_trade");
  const selection = useMemo<RunWorkspaceSelection>(
    () =>
      explorer.selection.type !== "none"
        ? explorer.selection
        : legacySelectedTradeId
          ? { type: "trade", id: legacySelectedTradeId }
          : explorer.selection,
    [explorer.selection, legacySelectedTradeId],
  );
  const selectedTradeId = selection.type === "trade" ? selection.id : undefined;
  const selectRecord = (nextSelection: RunWorkspaceSelection) => {
    setSearchParams((current) =>
      writeRunExplorerState(current, { selection: nextSelection }),
    );
  };
  const rangeFilters = useMemo(
    () => ({ start: explorer.start, end: explorer.end }),
    [explorer.end, explorer.start],
  );
  const tradeFilters = useMemo(
    () => ({
      exitDateFrom: searchParams.get("trade_from") || undefined,
      exitDateTo: searchParams.get("trade_to") || undefined,
      outcome: (searchParams.get("trade_outcome") || undefined) as
        "WIN" | "LOSS" | "BREAKEVEN" | undefined,
      sort:
        searchParams.get("trade_sort") === "SEQUENCE_DESC" ||
        searchParams.get("trade_sort") === "EXIT_TIMESTAMP_ASC" ||
        searchParams.get("trade_sort") === "EXIT_TIMESTAMP_DESC"
          ? (searchParams.get("trade_sort") as
              "SEQUENCE_DESC" | "EXIT_TIMESTAMP_ASC" | "EXIT_TIMESTAMP_DESC")
          : undefined,
    }),
    [searchParams],
  );

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
          "backtest-journal",
          "backtest-days",
          "backtest-attempts",
          "backtest-diagnostics",
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
        void queryClient.refetchQueries({
          queryKey: ["backtest", runId],
          exact: true,
        });
        for (const key of [
          "backtest-metrics",
          "backtest-signals",
          "backtest-trades",
          "backtest-equity",
          "backtest-journal",
          "backtest-days",
          "backtest-attempts",
          "backtest-diagnostics",
        ]) {
          void queryClient.invalidateQueries({ queryKey: [key, runId] });
        }
      }
    },
  );

  const run = useQuery({
    queryKey: ["backtest", runId],
    queryFn: () => getBacktest(runId),
    enabled: Boolean(runId),
    refetchInterval: (query) =>
      query.state.data &&
      !terminal.has(query.state.data.status) &&
      connectionState !== "connected"
        ? 10_000
        : false,
  });

  const completed = run.data?.status === "COMPLETED";
  const signals = useInfiniteQuery({
    queryKey: [
      "backtest-signals",
      runId,
      rangeFilters,
      explorer.signalDecision,
      explorer.signalRejectionReason,
    ],
    queryFn: ({ pageParam }) =>
      listSignalsInRange(runId, pageParam, 100, {
        ...rangeFilters,
        decision: explorer.signalDecision,
        rejectionReason: explorer.signalRejectionReason,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled: completed,
  });

  const events = useInfiniteQuery({
    queryKey: ["backtest-events", runId, explorer.eventType],
    queryFn: ({ pageParam }) =>
      listRunEvents(runId, pageParam, 100, {
        eventType: explorer.eventType,
      }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled: Boolean(run.data),
  });

  const trades = useInfiniteQuery({
    queryKey: ["backtest-trades", runId, tradeFilters, rangeFilters],
    queryFn: ({ pageParam }) =>
      listTrades(runId, pageParam, { ...tradeFilters, ...rangeFilters }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled: completed,
  });

  const equity = useInfiniteQuery({
    queryKey: ["backtest-equity", runId, rangeFilters],
    queryFn: ({ pageParam }) => listEquity(runId, pageParam, rangeFilters),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled: completed,
  });

  const signalItems = useMemo(
    () => signals.data?.pages.flatMap((page) => page.items) ?? [],
    [signals.data?.pages],
  );
  const eventItems = useMemo(
    () => events.data?.pages.flatMap((page) => page.items) ?? [],
    [events.data?.pages],
  );
  const tradeItems = useMemo(
    () => trades.data?.pages.flatMap((page) => page.items) ?? [],
    [trades.data?.pages],
  );
  const equityItems = useMemo(
    () => equity.data?.pages.flatMap((page) => page.items) ?? [],
    [equity.data?.pages],
  );
  const selectedRecord = useQuery({
    queryKey: ["backtest-selection", runId, selection],
    queryFn: async () => {
      if (selection.type === "signal") await getSignal(runId, selection.id);
      else if (selection.type === "trade") await getTrade(runId, selection.id);
      else if (selection.type === "event")
        await getRunEvent(runId, selection.id);
      else if (selection.type === "equity")
        await getEquityPoint(runId, selection.id);
      return true;
    },
    enabled: selection.type !== "none" && Boolean(runId),
    retry: false,
  });
  const deepLinkedTrade = useQuery({
    queryKey: ["backtest-deep-linked-trade", runId, selectedTradeId],
    queryFn: () => getTrade(runId, selectedTradeId!),
    enabled: Boolean(selectedTradeId),
    retry: false,
  });
  const visibleTradeItems = useMemo(
    () =>
      deepLinkedTrade.data &&
      !tradeItems.some((item) => item.id === deepLinkedTrade.data?.id)
        ? [...tradeItems, deepLinkedTrade.data]
        : tradeItems,
    [deepLinkedTrade.data, tradeItems],
  );
  useEffect(() => {
    if (selection.type === "none" || selectedRecord.isLoading) return;
    const selectedElement = document.getElementById(
      `${selection.type}-${selection.id}`,
    );
    if (typeof selectedElement?.scrollIntoView === "function") {
      selectedElement.scrollIntoView({ block: "nearest" });
    }
  }, [selectedRecord.isLoading, selection]);

  const snapshot = run.data?.snapshot as Record<string, unknown> | undefined;
  const datasetSnapshot = snapshot?.dataset as
    Record<string, unknown> | undefined;
  const dataQuality = useMemo(
    () =>
      datasetSnapshot?.validation ??
      datasetSnapshot?.quality ??
      snapshot?.data_quality,
    [datasetSnapshot, snapshot],
  );

  const exporter = useMutation({
    mutationFn: ({
      kind,
      format,
    }: {
      kind: ExportKind;
      format: ExportFormat;
    }) => downloadBacktestExport(runId, kind, format),
    onSuccess: ({ blob, filename }) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    },
  });

  useEffect(() => {
    if (run.data && terminal.has(run.data.status)) {
      localStorage.removeItem("stockbot.activeBacktestRunId");
    }
  }, [run.data]);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          asChild
          className="rounded-full h-8 w-8 hover:bg-surface text-muted-foreground"
        >
          <Link to={backTarget}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <span className="text-sm font-medium text-muted-foreground">
          {comparisonReturn ? "Comparison" : "Run History"}
        </span>
      </div>

      {run.isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
        </div>
      )}

      <ErrorText error={run.error} />

      {run.data && (
        <>
          <RunResultOverview
            run={run.data}
            codeVersion={String(
              (snapshot?.algorithm as Record<string, unknown> | undefined)
                ?.code_version ?? "recorded snapshot",
            )}
            completed={completed}
            exportPending={exporter.isPending}
            exportError={<ErrorText error={exporter.error} />}
            onExport={(kind, format) => exporter.mutate({ kind, format })}
          />

          <section
            className="rounded-xl border border-border bg-surface/60 p-4"
            aria-label="Linked exploration controls"
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="m-0 text-sm font-semibold text-foreground">
                  Linked exploration range
                </h2>
                <p className="m-0 mt-1 text-xs text-muted-foreground">
                  One inclusive timezone-aware range filters equity, signals,
                  and trades. Trade intervals are included when they overlap the
                  range. Lifecycle events remain complete because they use
                  processing time.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setSearchParams((current) =>
                    writeRunExplorerState(current, { start: "", end: "" }),
                  )
                }
                disabled={!explorer.start && !explorer.end}
              >
                Reset range
              </Button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                Start (ISO timestamp with offset)
                <input
                  aria-label="Exploration range start"
                  value={explorer.start ?? ""}
                  onChange={(event) =>
                    setSearchParams((current) =>
                      writeRunExplorerState(current, {
                        start: event.target.value || "",
                      }),
                    )
                  }
                  placeholder="2026-01-02T09:15:00+05:30"
                  className="h-9 rounded-md border border-border bg-surface px-2 font-mono text-xs text-foreground"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                End (ISO timestamp with offset)
                <input
                  aria-label="Exploration range end"
                  value={explorer.end ?? ""}
                  onChange={(event) =>
                    setSearchParams((current) =>
                      writeRunExplorerState(current, {
                        end: event.target.value || "",
                      }),
                    )
                  }
                  placeholder="2026-01-02T15:30:00+05:30"
                  className="h-9 rounded-md border border-border bg-surface px-2 font-mono text-xs text-foreground"
                />
              </label>
            </div>
            {selection.type !== "none" && (
              <p className="mb-0 mt-3 text-xs text-brand" role="status">
                {selectedRecord.isLoading
                  ? `Loading selected ${selection.type}…`
                  : selectedRecord.isError
                    ? `The selected ${selection.type} is unavailable for this run.`
                    : `Selected ${selection.type} ${selection.id.slice(0, 8)}. Clear it to return to the full workspace.`}
                <button
                  type="button"
                  onClick={() => selectRecord({ type: "none" })}
                  className="ml-2 underline underline-offset-2"
                >
                  Clear selection
                </button>
              </p>
            )}
          </section>

          {/* Progress & Live Connection */}
          {!terminal.has(run.data.status) && (
            <Card className="glass-card">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-2 w-48 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand transition-all duration-500"
                      style={{ width: `${run.data.progress}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold">
                    {run.data.progress}%
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      connectionState === "connected"
                        ? "bg-success shadow-[0_0_8px_var(--success)] animate-pulse"
                        : "bg-warning",
                    )}
                  />
                  <span className="text-muted-foreground">
                    {connectionState === "connected"
                      ? "Live updates connected"
                      : "Live updates degraded; REST recovery active"}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {run.data.status === "FAILED" && (
            <div className="bg-destructive/10 border border-destructive/30 p-6 rounded-xl flex flex-col gap-2">
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-6 w-6" />
                <h3 className="font-bold text-lg m-0">
                  Run Failed: {run.data.error_code ?? "UNKNOWN_FAILURE"}
                </h3>
              </div>
              <p className="text-sm text-foreground/80 mt-2">
                {run.data.error_message ??
                  "No additional failure detail was stored."}
              </p>
              <p className="text-xs text-muted-foreground">
                Use the recorded inputs below to correct the data, then start a
                new immutable run.
              </p>
            </div>
          )}

          {/* Main Content Tabs */}
          <div className="space-y-12 mt-8">
            {/* TAB: OVERVIEW */}
            <div id="section-overview" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="text-lg">Immutable Inputs</CardTitle>
                    <CardDescription>
                      Snapshot parameters used for this run
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                      <div className="col-span-2">
                        <dt className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                          Run ID
                        </dt>
                        <dd className="font-mono text-foreground bg-muted/30 p-2 rounded">
                          {run.data.id}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                          Mode
                        </dt>
                        <dd className="font-semibold text-brand">
                          {run.data.mode}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                          Starting Capital
                        </dt>
                        <dd className="font-mono font-semibold">
                          {formatCurrency(
                            run.data.starting_capital,
                            run.data.mode === "OPTION_SPREAD_SIMULATION"
                              ? "INR"
                              : "DEMO",
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                          Dataset Version
                        </dt>
                        <dd
                          className="font-mono truncate"
                          title={run.data.dataset_version_id}
                        >
                          {run.data.dataset_version_id}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                          Algorithm Version
                        </dt>
                        <dd
                          className="font-mono truncate"
                          title={run.data.algorithm_version_id}
                        >
                          {run.data.algorithm_version_id}
                        </dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                          Date Range
                        </dt>
                        <dd className="font-medium">
                          {run.data.start_date}{" "}
                          <span className="text-muted-foreground mx-2">to</span>{" "}
                          {run.data.end_date}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                          Created
                        </dt>
                        <dd>{formatPlatformDateTime(run.data.created_at)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                          Completed
                        </dt>
                        <dd>
                          {run.data.completed_at
                            ? formatPlatformDateTime(run.data.completed_at)
                            : "—"}
                        </dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>

                <div className="flex flex-col gap-6">
                  {completed && run.data.outcome_summary && (
                    <Card className="glass-card">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-lg flex justify-between items-center">
                          Outcome Summary
                          <Badge
                            variant="outline"
                            className={
                              run.data.outcome_summary.unit === "INR" ||
                              run.data.mode === "OPTION_SPREAD_SIMULATION"
                                ? "bg-success/10 text-success border-success/30"
                                : "bg-brand/10 text-brand"
                            }
                          >
                            {run.data.outcome_summary.unit ||
                              (run.data.mode === "OPTION_SPREAD_SIMULATION"
                                ? "INR"
                                : "DEMO_UNITS")}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-3 mb-6">
                          <MetricCard
                            label="Net Profit / Loss"
                            value={formatCurrency(
                              run.data.outcome_summary.net_outcome,
                              run.data.outcome_summary.unit ||
                                (run.data.mode === "OPTION_SPREAD_SIMULATION"
                                  ? "INR"
                                  : "DEMO"),
                            )}
                          />
                          <MetricCard
                            label="Max Drawdown"
                            value={formatCurrency(
                              run.data.outcome_summary.max_drawdown_amount,
                              run.data.outcome_summary.unit ||
                                (run.data.mode === "OPTION_SPREAD_SIMULATION"
                                  ? "INR"
                                  : "DEMO"),
                            )}
                          />
                          <MetricCard
                            label="Total Trades"
                            value={run.data.outcome_summary.trade_count}
                          />
                          <MetricCard
                            label="Wins / Losses"
                            value={`${run.data.outcome_summary.wins} / ${run.data.outcome_summary.losses}`}
                          />
                        </div>
                        <div className="h-24 w-full flex items-center justify-between bg-surface/50 rounded-lg border border-border p-4">
                          <div className="w-1/3 text-center">
                            <span className="block text-3xl font-extrabold text-success">
                              {run.data.outcome_summary.wins}
                            </span>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mt-1">
                              Wins
                            </span>
                          </div>
                          <div className="w-1/3 h-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={[
                                    {
                                      value: run.data.outcome_summary.wins || 0,
                                      color: "var(--success)",
                                    },
                                    {
                                      value:
                                        run.data.outcome_summary.losses || 0,
                                      color: "var(--destructive)",
                                    },
                                  ]}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={25}
                                  outerRadius={35}
                                  dataKey="value"
                                  stroke="transparent"
                                >
                                  {run.data.outcome_summary.wins > 0 ||
                                  run.data.outcome_summary.losses > 0
                                    ? [
                                        <Cell key="w" fill="var(--success)" />,
                                        <Cell
                                          key="l"
                                          fill="var(--destructive)"
                                        />,
                                      ]
                                    : null}
                                </Pie>
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="w-1/3 text-center">
                            <span className="block text-3xl font-extrabold text-destructive">
                              {run.data.outcome_summary.losses}
                            </span>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mt-1">
                              Losses
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Card className="glass-card flex-1">
                    <CardHeader>
                      <CardTitle className="text-lg">Snapshots</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="params">
                          <AccordionTrigger className="text-sm font-semibold">
                            Saved Parameters
                          </AccordionTrigger>
                          <AccordionContent>
                            <JsonBlock
                              value={
                                (
                                  snapshot?.algorithm as
                                    Record<string, unknown> | undefined
                                )?.parameters
                              }
                            />
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="assumptions">
                          <AccordionTrigger className="text-sm font-semibold">
                            Assumptions
                          </AccordionTrigger>
                          <AccordionContent>
                            <JsonBlock value={snapshot?.assumptions} />
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="data">
                          <AccordionTrigger className="text-sm font-semibold">
                            Data Quality
                          </AccordionTrigger>
                          <AccordionContent>
                            {dataQuality ? (
                              <JsonBlock value={dataQuality} />
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                No additional data-quality warnings stored.
                              </p>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>

            {/* TAB: EQUITY CHART */}
            {completed && (
              <div id="section-performance" className="space-y-6">
                <RunAnalyticsWorkspace runId={runId} />
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>Equity & Drawdown Explorer</CardTitle>
                    <CardDescription>
                      {run.data.mode === "OPTION_SPREAD_SIMULATION"
                        ? "The first point is starting capital; each later point is one closed trade. The starting point is not a trade."
                        : "Professional Chart Workstation view for DEMO_UNITS"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ErrorText error={equity.error} />
                    <div className="mb-8 border border-border/50 rounded-xl bg-surface/30 p-2">
                      <DemoEquityChart
                        items={equityItems}
                        unit={
                          run.data.outcome_summary?.unit ||
                          (run.data.mode === "OPTION_SPREAD_SIMULATION"
                            ? "INR"
                            : "DEMO")
                        }
                        selectedPointId={
                          selection.type === "equity" ? selection.id : undefined
                        }
                        range={rangeFilters}
                        onSelectPoint={(point) =>
                          selectRecord({ type: "equity", id: point.id })
                        }
                        onVisibleRangeChange={(range) =>
                          setSearchParams((current) =>
                            writeRunExplorerState(current, range),
                          )
                        }
                      />
                    </div>

                    {equityItems.length > 0 && (
                      <div className="rounded-md border border-border">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="w-[100px]">Point</TableHead>
                              <TableHead>Timestamp</TableHead>
                              <TableHead className="text-right text-success">
                                Equity
                              </TableHead>
                              <TableHead className="text-right text-destructive">
                                Drawdown
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {equityItems.map((point) => (
                              <TableRow
                                key={point.id}
                                id={`equity-${point.id}`}
                                data-selected={
                                  selection.type === "equity" &&
                                  selection.id === point.id
                                    ? "true"
                                    : undefined
                                }
                                onClick={() =>
                                  selectRecord({ type: "equity", id: point.id })
                                }
                                onKeyDown={(event) => {
                                  if (
                                    event.key === "Enter" ||
                                    event.key === " "
                                  ) {
                                    event.preventDefault();
                                    selectRecord({
                                      type: "equity",
                                      id: point.id,
                                    });
                                  }
                                }}
                                role="button"
                                tabIndex={0}
                                className="cursor-pointer data-[selected=true]:bg-brand/10"
                              >
                                <TableCell className="font-mono text-xs">
                                  {point.sequence}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {point.timestamp}
                                </TableCell>
                                <TableCell className="text-right font-mono font-medium text-success">
                                  {formatCurrency(
                                    point.equity_demo_units,
                                    point.unit,
                                  )}
                                </TableCell>
                                <TableCell className="text-right font-mono font-medium text-destructive">
                                  {formatCurrency(
                                    point.drawdown_demo_units,
                                    point.unit,
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                    {equity.hasNextPage && (
                      <div className="flex justify-center mt-6">
                        <Button
                          variant="outline"
                          onClick={() => equity.fetchNextPage()}
                          disabled={equity.isFetchingNextPage}
                        >
                          {equity.isFetchingNextPage
                            ? "Loading…"
                            : "Load more equity points"}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* TAB: TRADES */}
            {completed && (
              <div id="section-trades" className="mt-6">
                <Card className="glass-card">
                  <CardHeader className="pb-0">
                    <CardTitle>
                      {run.data.mode === "OPTION_SPREAD_SIMULATION"
                        ? "Option Spread Trades"
                        : "Synthetic Trades Table"}
                    </CardTitle>
                    <CardDescription>
                      {run.data.mode === "OPTION_SPREAD_SIMULATION"
                        ? "Detailed estimated outcomes, contract legs, costs, and execution evidence"
                        : "Detailed synthetic outcome and leg execution logic"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <ErrorText error={trades.error} />

                    <div className="mb-5 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface/30 p-3">
                      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                        Exit from
                        <input
                          type="date"
                          value={tradeFilters.exitDateFrom ?? ""}
                          onChange={(event) =>
                            setSearchParams((current) => {
                              const next = new URLSearchParams(current);
                              if (event.target.value)
                                next.set("trade_from", event.target.value);
                              else next.delete("trade_from");
                              return next;
                            })
                          }
                          className="h-9 rounded-md border border-border bg-surface px-2 text-foreground"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                        Exit to
                        <input
                          type="date"
                          value={tradeFilters.exitDateTo ?? ""}
                          onChange={(event) =>
                            setSearchParams((current) => {
                              const next = new URLSearchParams(current);
                              if (event.target.value)
                                next.set("trade_to", event.target.value);
                              else next.delete("trade_to");
                              return next;
                            })
                          }
                          className="h-9 rounded-md border border-border bg-surface px-2 text-foreground"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                        Outcome
                        <AppSelect
                          value={tradeFilters.outcome ?? "__all__"}
                          ariaLabel="Trade outcome filter"
                          placeholder="All outcomes"
                          onValueChange={(value) =>
                            setSearchParams((current) => {
                              const next = new URLSearchParams(current);
                              if (value !== "__all__")
                                next.set("trade_outcome", value);
                              else next.delete("trade_outcome");
                              return next;
                            })
                          }
                          className="h-9"
                          options={[
                            { value: "__all__", label: "All outcomes" },
                            { value: "WIN", label: "Wins" },
                            { value: "LOSS", label: "Losses" },
                            { value: "BREAKEVEN", label: "Breakeven" },
                          ]}
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                        Order
                        <AppSelect
                          value={tradeFilters.sort ?? "SEQUENCE_ASC"}
                          ariaLabel="Trade order"
                          placeholder="Choose trade order"
                          onValueChange={(value) =>
                            setSearchParams((current) => {
                              const next = new URLSearchParams(current);
                              if (value === "SEQUENCE_ASC")
                                next.delete("trade_sort");
                              else next.set("trade_sort", value);
                              return next;
                            })
                          }
                          className="h-9"
                          options={[
                            { value: "SEQUENCE_ASC", label: "Sequence ↑" },
                            { value: "SEQUENCE_DESC", label: "Sequence ↓" },
                            {
                              value: "EXIT_TIMESTAMP_ASC",
                              label: "Exit time ↑",
                            },
                            {
                              value: "EXIT_TIMESTAMP_DESC",
                              label: "Exit time ↓",
                            },
                          ]}
                        />
                      </label>
                    </div>

                    {tradeItems.length > 0 && (
                      <div className="mb-8 h-[160px] w-full border border-border/50 bg-surface/30 rounded-xl p-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={tradeItems.map((t) => ({
                              seq: `#${t.sequence}`,
                              net: Number(t.net_demo_units),
                            }))}
                            margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                          >
                            <XAxis
                              dataKey="seq"
                              tick={{
                                fontSize: 10,
                                fill: "var(--muted-foreground)",
                              }}
                              stroke="var(--border)"
                            />
                            <YAxis
                              tick={{
                                fontSize: 10,
                                fill: "var(--muted-foreground)",
                              }}
                              stroke="var(--border)"
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "var(--card)",
                                borderColor: "var(--border)",
                                borderRadius: "8px",
                                fontSize: "11px",
                                color: "var(--foreground)",
                              }}
                            />
                            <Bar dataKey="net" radius={[4, 4, 0, 0]}>
                              {tradeItems.map((t, idx) => (
                                <Cell
                                  key={`trade-${idx}`}
                                  fill={
                                    Number(t.net_demo_units) >= 0
                                      ? "var(--success)"
                                      : "var(--destructive)"
                                  }
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {trades.data && tradeItems.length === 0 && (
                      <div className="p-8 text-center text-muted-foreground border border-dashed border-border rounded-lg">
                        {run.data.mode === "OPTION_SPREAD_SIMULATION"
                          ? "No option-spread trades were generated."
                          : "No synthetic trades generated."}
                      </div>
                    )}

                    <TradeOutcomeList
                      runId={runId}
                      trades={visibleTradeItems}
                      selectedTradeId={selectedTradeId}
                      onSelectTrade={(trade) =>
                        selectRecord({ type: "trade", id: trade.id })
                      }
                    />

                    {trades.hasNextPage && (
                      <div className="flex justify-center mt-6">
                        <Button
                          variant="outline"
                          onClick={() => trades.fetchNextPage()}
                          disabled={trades.isFetchingNextPage}
                        >
                          {trades.isFetchingNextPage
                            ? "Loading…"
                            : run.data.mode === "OPTION_SPREAD_SIMULATION"
                              ? "Load more option-spread trades"
                              : "Load more synthetic trades"}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* TAB: SIGNALS */}
            {completed && (
              <RunSignalExplorer
                signals={signalItems}
                loaded={Boolean(signals.data)}
                error={signals.error}
                hasNextPage={Boolean(signals.hasNextPage)}
                loadingNextPage={signals.isFetchingNextPage}
                decision={explorer.signalDecision}
                rejectionReason={explorer.signalRejectionReason}
                selectedSignalId={
                  selection.type === "signal" ? selection.id : undefined
                }
                onDecisionChange={(value) =>
                  setSearchParams((current) =>
                    writeRunExplorerState(current, { signalDecision: value }),
                  )
                }
                onRejectionReasonChange={(value) =>
                  setSearchParams((current) =>
                    writeRunExplorerState(current, {
                      signalRejectionReason: value,
                    }),
                  )
                }
                onSelectSignal={(id) => selectRecord({ type: "signal", id })}
                onSelectTrade={(id) => selectRecord({ type: "trade", id })}
                onLoadMore={() => signals.fetchNextPage()}
              />
            )}

            <RunSystemActivity
              run={run.data}
              events={eventItems}
              loaded={Boolean(events.data)}
              error={events.error}
              hasNextPage={Boolean(events.hasNextPage)}
              loadingNextPage={events.isFetchingNextPage}
              filter={explorer.eventType ?? ""}
              selectedEventId={
                selection.type === "event" ? selection.id : undefined
              }
              onFilterChange={(value) =>
                setSearchParams((current) =>
                  writeRunExplorerState(current, {
                    eventType: value || undefined,
                  }),
                )
              }
              onSelectEvent={(id) => selectRecord({ type: "event", id })}
              onLoadMore={() => events.fetchNextPage()}
            />
          </div>
        </>
      )}
      <SignalDecisionPanel
        runId={runId}
        signalId={selection.type === "signal" ? selection.id : undefined}
        onClose={() => selectRecord({ type: "none" })}
        onSelectSignal={(id) => selectRecord({ type: "signal", id })}
        onSelectTrade={(id) => selectRecord({ type: "trade", id })}
      />
    </div>
  );
}
