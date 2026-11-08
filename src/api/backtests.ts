import type { components } from "./generated/schema";

import { getRuntimeConfig } from "../lib/config";
import { apiClient, authenticatedFetch } from "./client";
import { ApiError } from "./system";

export type BacktestPreflight =
  components["schemas"]["BacktestPreflightResponse"];
export type BacktestRun = components["schemas"]["BacktestRunResponse"];
export type LiveRunSnapshot = components["schemas"]["LiveRunSnapshotResponse"];
export type RunMetrics = components["schemas"]["RunMetricsResponse"];
export type RunAnalyticsSummary =
  components["schemas"]["RunAnalyticsSummaryResponse"];
export type AnalyticsPeriodList =
  components["schemas"]["AnalyticsPeriodListResponse"];
export type AnalyticsDefinitions =
  components["schemas"]["AnalyticsDefinitionsResponse"];
export type SignalEvaluation =
  components["schemas"]["SignalEvaluationResponse"];
export type SignalDecisionDetail =
  components["schemas"]["SignalDecisionDetailResponse"];
export type RunEvent = components["schemas"]["RunEventResponse"];
export type JournalEvent = components["schemas"]["JournalEventResponse"];
export type JournalEventList =
  components["schemas"]["JournalEventListResponse"];
export type RunDayClassification =
  components["schemas"]["RunDayClassificationResponse"];
export type RunDayClassificationList =
  components["schemas"]["RunDayClassificationListResponse"];
export type ExecutionAttemptList =
  components["schemas"]["ExecutionAttemptListResponse"];
export type ExportJob = components["schemas"]["ExportJobResponse"];
export type RunDiagnostics = components["schemas"]["RunDiagnosticsResponse"];

export type DemoTradeLeg = components["schemas"]["DemoTradeLegResponse"];
export type DemoTrade = components["schemas"]["DemoTradeResponse"];
export type DemoTradeList = components["schemas"]["DemoTradeListResponse"];
export type DemoEquityPoint = components["schemas"]["DemoEquityPointResponse"];
export type DemoEquityList =
  components["schemas"]["DemoEquityPointListResponse"];
export type BacktestRunList = components["schemas"]["BacktestRunListResponse"];
export type BacktestCatalogRun =
  components["schemas"]["BacktestCatalogRunResponse"];
export type BacktestHistorySummary =
  components["schemas"]["BacktestHistorySummaryResponse"];
export type ComparisonPreflight =
  components["schemas"]["ComparisonPreflightResponse"];
export type Comparison = components["schemas"]["ComparisonResponse"];
export type ComparisonSeries =
  components["schemas"]["ComparisonSeriesResponse"];
export type ComparisonSeriesName =
  | "equity"
  | "drawdown"
  | "trade_outcomes"
  | "signal_decisions"
  | "rejection_reasons";
export type ExportKind = "summary" | "trades" | "signals" | "analytics";
export type ExportFormat = "json" | "csv";

export type BacktestFilters = {
  runQuery?: string;
  status?: string;
  datasetId?: string;
  datasetVersionId?: string;
  algorithmKey?: string;
  algorithmVersionId?: string;
  mode?: string;
  startDate?: string;
  endDate?: string;
  createdFrom?: string;
  createdTo?: string;
};

export type BacktestInputs = {
  dataset_version_id: string;
  algorithm_version_id: string;
  start_date: string;
  end_date: string;
  starting_capital: string;
  warning_acknowledged: boolean;
  accepted_coverage_digest?: string | null;
};

function requestId(response: Response) {
  return response.headers.get("X-Request-ID") ?? undefined;
}

async function checked<T>(
  promise: Promise<{ data?: T; response: Response }>,
  message: string,
) {
  const result = await promise;
  if (!result.data || !result.response.ok) {
    throw new ApiError(
      message,
      requestId(result.response),
      result.response.status,
    );
  }
  return result.data;
}

export function preflightBacktest(input: BacktestInputs) {
  return checked(
    apiClient.POST("/api/v1/backtests/preflight", { body: input }),
    "Could not preflight this backtest.",
  );
}

export function startBacktest(input: BacktestInputs) {
  return checked(
    apiClient.POST("/api/v1/backtests", {
      body: input,
      headers: { "Idempotency-Key": crypto.randomUUID() },
    }),
    "Could not start this backtest.",
  );
}

export function getBacktest(runId: string) {
  return checked(
    apiClient.GET("/api/v1/backtests/{run_id}", {
      params: { path: { run_id: runId } },
    }),
    "Could not refresh this backtest.",
  );
}

export function getLiveRunSnapshot(runId: string) {
  return checked(
    apiClient.GET("/api/v1/backtests/{run_id}/live-snapshot", {
      params: { path: { run_id: runId } },
    }),
    "Could not recover the durable live checkpoint.",
  );
}

export function listBacktests(
  filters: BacktestFilters = {},
  cursor?: string,
  limit = 20,
) {
  return checked(
    apiClient.GET("/api/v1/backtests", {
      params: {
        query: {
          status: filters.status || undefined,
          run_query: filters.runQuery || undefined,
          dataset_id: filters.datasetId || undefined,
          dataset_version_id: filters.datasetVersionId || undefined,
          algorithm_key: filters.algorithmKey || undefined,
          algorithm_version_id: filters.algorithmVersionId || undefined,
          mode: filters.mode || undefined,
          start_date: filters.startDate || undefined,
          end_date: filters.endDate || undefined,
          created_from: filters.createdFrom || undefined,
          created_to: filters.createdTo || undefined,
          cursor,
          limit,
        },
      },
    }),
    "Could not load backtest history.",
  );
}

export function getBacktestHistorySummary(filters: BacktestFilters = {}) {
  return checked(
    apiClient.GET("/api/v1/backtests/history-summary", {
      params: {
        query: {
          run_query: filters.runQuery || undefined,
          status: filters.status || undefined,
          dataset_id: filters.datasetId || undefined,
          dataset_version_id: filters.datasetVersionId || undefined,
          algorithm_key: filters.algorithmKey || undefined,
          algorithm_version_id: filters.algorithmVersionId || undefined,
          mode: filters.mode || undefined,
          start_date: filters.startDate || undefined,
          end_date: filters.endDate || undefined,
          created_from: filters.createdFrom || undefined,
          created_to: filters.createdTo || undefined,
        },
      },
    }),
    "Could not load history analytics.",
  );
}

export function cancelBacktest(runId: string) {
  return checked(
    apiClient.POST("/api/v1/backtests/{run_id}/cancel", {
      params: { path: { run_id: runId } },
    }),
    "Could not request cancellation.",
  );
}

export function getMetrics(runId: string) {
  return checked(
    apiClient.GET("/api/v1/backtests/{run_id}/metrics", {
      params: { path: { run_id: runId } },
    }),
    "Could not load signal metrics.",
  );
}

export function getRunAnalyticsSummary(runId: string) {
  return checked(
    apiClient.GET("/api/v1/backtests/{run_id}/analytics/summary", {
      params: { path: { run_id: runId } },
    }),
    "Could not load completed-run analytics.",
  );
}

export type AnalyticsPeriodFilters = {
  startDate?: string;
  endDate?: string;
  includeZeroPeriods?: boolean;
  sort?: "PERIOD_ASC" | "PERIOD_DESC";
};

export type AnalyticsExportSelection = AnalyticsPeriodFilters & {
  granularity: "TRADE" | "DAY" | "MONTH";
};

export function listAnalyticsPeriods(
  runId: string,
  granularity: "TRADE" | "DAY" | "MONTH",
  purpose: "chart" | "table" = "chart",
  cursor?: string | number,
  limit = 500,
  filters: AnalyticsPeriodFilters = {},
) {
  return checked(
    apiClient.GET("/api/v1/backtests/{run_id}/analytics/periods", {
      params: {
        path: { run_id: runId },
        query: {
          granularity,
          purpose,
          cursor,
          limit,
          start_date: filters.startDate,
          end_date: filters.endDate,
          include_zero_periods: filters.includeZeroPeriods,
          sort: filters.sort,
        },
      },
    }),
    "Could not load period analytics.",
  );
}

export function getAnalyticsDefinitions(runId: string) {
  return checked(
    apiClient.GET("/api/v1/backtests/{run_id}/analytics/definitions", {
      params: { path: { run_id: runId } },
    }),
    "Could not load analytics definitions.",
  );
}

export function listSignals(runId: string, cursor?: string, limit = 100) {
  return listSignalsInRange(runId, cursor, limit);
}

export type RunTimeRangeFilters = {
  start?: string;
  end?: string;
};

export type SignalFilters = RunTimeRangeFilters & {
  decision?: "ACCEPTED" | "REJECTED";
  rejectionReason?: string;
  window?: string;
};

export function listSignalsInRange(
  runId: string,
  cursor?: string,
  limit = 100,
  filters: SignalFilters = {},
) {
  return checked(
    apiClient.GET("/api/v1/backtests/{run_id}/signals", {
      params: {
        path: { run_id: runId },
        query: {
          cursor,
          limit,
          start: filters.start,
          end: filters.end,
          decision: filters.decision,
          rejection_reason: filters.rejectionReason,
          window: filters.window,
        },
      },
    }),
    "Could not load signal decisions.",
  );
}

export function getSignal(runId: string, signalId: string) {
  return checked(
    apiClient.GET("/api/v1/backtests/{run_id}/signals/{signal_id}", {
      params: { path: { run_id: runId, signal_id: signalId } },
    }),
    "Could not load this signal decision.",
  );
}

export function getSignalDetail(runId: string, signalId: string) {
  return checked(
    apiClient.GET("/api/v1/backtests/{run_id}/signals/{signal_id}/detail", {
      params: { path: { run_id: runId, signal_id: signalId } },
    }),
    "Could not load this signal explanation.",
  );
}

export type EventFilters = RunTimeRangeFilters & { eventType?: string };

export function listRunEvents(
  runId: string,
  cursor?: number,
  limit = 100,
  filters: EventFilters = {},
) {
  return checked(
    apiClient.GET("/api/v1/backtests/{run_id}/events", {
      params: {
        path: { run_id: runId },
        query: {
          cursor,
          limit,
          start: filters.start,
          end: filters.end,
          event_type: filters.eventType,
        },
      },
    }),
    "Could not load run events.",
  );
}

export async function listLatestRunEvents(runId: string, keep = 12) {
  let cursor: number | undefined;
  let latest: RunEvent[] = [];
  do {
    const page = await listRunEvents(runId, cursor, 500);
    latest = [...latest, ...page.items].slice(-keep);
    cursor = page.next_cursor ?? undefined;
  } while (cursor !== undefined);
  return latest.slice().reverse();
}

export function listExecutionAttempts(runId: string) {
  return checked(
    apiClient.GET("/api/v1/backtests/{run_id}/attempts", {
      params: { path: { run_id: runId } },
    }),
    "Could not load execution attempts.",
  );
}

export async function listJournalEvents(
  runId: string,
  cursor?: string,
  limit = 100,
  attemptId?: string,
) {
  const result = await checked(
    apiClient.GET("/api/v1/backtests/{run_id}/journal", {
      params: {
        path: { run_id: runId },
        query: {
          attempt_id: attemptId,
          market_order: true,
          market_cursor: cursor,
          limit,
        },
      },
    }),
    "Could not load the chronological trade journal.",
  );
  return { ...result, next_cursor: result.next_market_cursor };
}

export function listDayClassifications(
  runId: string,
  cursor?: string,
  limit = 100,
  attemptId?: string,
) {
  return checked(
    apiClient.GET("/api/v1/backtests/{run_id}/days", {
      params: {
        path: { run_id: runId },
        query: { attempt_id: attemptId, cursor, limit },
      },
    }),
    "Could not load the day-by-day decision evidence.",
  );
}

export function getRunDiagnostics(runId: string) {
  return checked(
    apiClient.GET("/api/v1/backtests/{run_id}/analytics/diagnostics", {
      params: { path: { run_id: runId } },
    }),
    "Could not load run diagnostics.",
  );
}

export function getRunEvent(runId: string, eventId: string) {
  return checked(
    apiClient.GET("/api/v1/backtests/{run_id}/events/{event_id}", {
      params: { path: { run_id: runId, event_id: eventId } },
    }),
    "Could not load this durable event.",
  );
}

export type TradeFilters = RunTimeRangeFilters & {
  exitDateFrom?: string;
  exitDateTo?: string;
  outcome?: "WIN" | "LOSS" | "BREAKEVEN";
  exitReason?: string;
  sort?:
    | "SEQUENCE_ASC"
    | "SEQUENCE_DESC"
    | "EXIT_TIMESTAMP_ASC"
    | "EXIT_TIMESTAMP_DESC";
};

export function listTrades(
  runId: string,
  cursor?: number,
  filters: TradeFilters = {},
) {
  return checked(
    apiClient.GET("/api/v1/backtests/{run_id}/trades", {
      params: {
        path: { run_id: runId },
        query: {
          cursor,
          start: filters.start,
          end: filters.end,
          exit_date_from: filters.exitDateFrom,
          exit_date_to: filters.exitDateTo,
          exit_reason: filters.exitReason,
          outcome: filters.outcome,
          sort: filters.sort,
        },
      },
    }),
    "Could not load demo trades.",
  );
}

export function getTrade(runId: string, tradeId: string) {
  return checked(
    apiClient.GET("/api/v1/backtests/{run_id}/trades/{trade_id}", {
      params: { path: { run_id: runId, trade_id: tradeId } },
    }),
    "Could not load this synthetic trade.",
  );
}

export function listEquity(
  runId: string,
  cursor?: number,
  filters: RunTimeRangeFilters = {},
) {
  return checked(
    apiClient.GET("/api/v1/backtests/{run_id}/equity", {
      params: {
        path: { run_id: runId },
        query: { cursor, start: filters.start, end: filters.end },
      },
    }),
    "Could not load demo equity.",
  );
}

export function getEquityPoint(runId: string, pointId: string) {
  return checked(
    apiClient.GET("/api/v1/backtests/{run_id}/equity/{point_id}", {
      params: { path: { run_id: runId, point_id: pointId } },
    }),
    "Could not load this synthetic equity point.",
  );
}

export function preflightComparison(runIds: string[]) {
  return checked(
    apiClient.POST("/api/v1/backtests/comparisons/preflight", {
      body: { run_ids: runIds },
    }),
    "Could not check whether these runs are safe to compare.",
  );
}

export function compareBacktests(runIds: string[]) {
  return checked(
    apiClient.POST("/api/v1/backtests/comparisons", {
      body: { run_ids: runIds },
    }),
    "Could not compare these backtests.",
  );
}

export function getComparisonSeries(input: {
  runIds: string[];
  series: ComparisonSeriesName[];
  start?: string;
  end?: string;
  resolution?: "auto" | "raw";
  maxPointsPerRun?: number;
}) {
  return checked(
    apiClient.POST("/api/v1/backtests/comparisons/series", {
      body: {
        run_ids: input.runIds,
        series: input.series,
        start: input.start,
        end: input.end,
        resolution: input.resolution ?? "auto",
        max_points_per_run: input.maxPointsPerRun ?? 500,
      },
    }),
    "Could not load bounded comparison evidence.",
  );
}

export async function downloadBacktestExport(
  runId: string,
  kind: ExportKind,
  format: ExportFormat,
  analyticsSelection?: AnalyticsExportSelection,
) {
  const query = new URLSearchParams({ format });
  if (analyticsSelection) {
    query.set("granularity", analyticsSelection.granularity);
    if (analyticsSelection.startDate)
      query.set("start_date", analyticsSelection.startDate);
    if (analyticsSelection.endDate)
      query.set("end_date", analyticsSelection.endDate);
    if (analyticsSelection.includeZeroPeriods === false)
      query.set("include_zero_periods", "false");
    if (analyticsSelection.sort) query.set("sort", analyticsSelection.sort);
  }
  const response = await authenticatedFetch(
    `${getRuntimeConfig().apiBaseUrl}/api/v1/backtests/${runId}/exports/${kind}?${query.toString()}`,
    {
      credentials: "include",
      headers: { Accept: format === "csv" ? "text/csv" : "application/json" },
    },
  );
  if (!response.ok) {
    throw new ApiError(
      "Could not export this completed platform-demo run.",
      requestId(response),
      response.status,
    );
  }
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename =
    disposition.match(/filename="([^"]+)"/)?.[1] ??
    `stockbot-${runId}-${kind}.${format}`;
  return { blob: await response.blob(), filename };
}

export function createCompleteExport(
  runId: string,
  format: "ZIP" | "XLSX" = "ZIP",
) {
  return checked(
    apiClient.POST("/api/v1/backtests/{run_id}/export-jobs", {
      params: { path: { run_id: runId } },
      body: { format },
    }),
    "Could not start the complete evidence export.",
  );
}

export function getCompleteExport(jobId: string) {
  return checked(
    apiClient.GET("/api/v1/backtests/export-jobs/{job_id}", {
      params: { path: { job_id: jobId } },
    }),
    "Could not refresh the complete evidence export.",
  );
}

export async function downloadCompleteExport(
  jobId: string,
  format: "ZIP" | "XLSX" = "ZIP",
) {
  const response = await authenticatedFetch(
    `${getRuntimeConfig().apiBaseUrl}/api/v1/backtests/export-jobs/${jobId}/download`,
    {
      credentials: "include",
      headers: {
        Accept:
          format === "XLSX"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "application/zip",
      },
    },
  );
  if (!response.ok) {
    throw new ApiError(
      "Could not download the complete evidence export.",
      requestId(response),
      response.status,
    );
  }
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename =
    disposition.match(/filename="([^"]+)"/)?.[1] ??
    `stockbot-complete-export-${jobId}.${format.toLowerCase()}`;
  return { blob: await response.blob(), filename };
}
