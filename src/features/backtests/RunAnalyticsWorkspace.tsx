import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  downloadBacktestExport,
  getAnalyticsDefinitions,
  getRunAnalyticsSummary,
  listAnalyticsPeriods,
  type AnalyticsExportSelection,
  type AnalyticsPeriodList,
} from "../../api/backtests";
import { formatCurrency } from "../../lib/formatters";
import {
  ChartExpandedDialog,
  ChartFrame,
  ChartLegend,
  ChartToolbar,
  useChartViewport,
  type ChartView,
} from "../../components/charts";
import { Button } from "@/components/ui/button";
import { AppSelect } from "@/components/ui/app-select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Granularity = "TRADE" | "DAY" | "MONTH";
type Period = AnalyticsPeriodList["items"][number];
type PeriodMetric = "OUTCOME" | "CUMULATIVE" | "DRAWDOWN";

const metricSeries = {
  OUTCOME: [
    { id: "gross", label: "Gross", color: "#8c52ff" },
    { id: "costs", label: "Costs", color: "#d6a642" },
    { id: "net", label: "Net outcome", color: "#55c596" },
  ],
  CUMULATIVE: [
    { id: "cumulative", label: "Cumulative outcome", color: "#8c52ff" },
  ],
  DRAWDOWN: [
    { id: "drawdown", label: "Underwater drawdown", color: "#ef746c" },
  ],
} as const;

function demo(value: unknown, unit = "DEMO_UNITS") {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Unavailable";
  if (unit === "INR" || unit === "₹") {
    return formatCurrency(numeric, "INR");
  }
  return `${numeric.toFixed(2)} DEMO_UNITS`;
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface/40 p-3">
      <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="m-0 mt-1 font-mono text-base font-bold text-foreground">
        {value}
      </p>
      {detail ? (
        <p className="m-0 mt-1 text-[11px] text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  );
}

function PeriodLedger({
  items,
  selectedPeriod,
  granularity,
  unit,
  onSelect,
  selectedTradeId,
  onSelectTrade,
}: {
  items: Period[];
  selectedPeriod: string | null;
  granularity: Granularity;
  unit: string;
  onSelect: (period: string) => void;
  selectedTradeId?: string;
  onSelectTrade?: (tradeId: string) => void;
}) {
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedPeriod) return;
    const row = tableRef.current?.querySelector<HTMLElement>(
      `[data-period="${selectedPeriod}"]`,
    );
    row?.focus();
  }, [selectedPeriod, items]);

  return (
    <div
      ref={tableRef}
      className="h-full overflow-auto rounded-lg border border-border"
      role="region"
      aria-label={`Exact ${granularity.toLowerCase()} analytics ledger`}
      tabIndex={0}
    >
      <Table className="min-w-[820px]">
        <caption className="sr-only">
          Exact server-provided {granularity.toLowerCase()} analytics in
          {unit === "INR" ? " Indian Rupees" : " DEMO_UNITS"}
        </caption>
        <TableHeader className="sticky top-0 bg-surface">
          <TableRow>
            <TableHead>Period</TableHead>
            <TableHead>Sessions</TableHead>
            <TableHead>Trades</TableHead>
            <TableHead className="text-right">Gross</TableHead>
            <TableHead className="text-right">Costs</TableHead>
            <TableHead className="text-right">Net</TableHead>
            <TableHead className="text-right">Cumulative</TableHead>
            <TableHead className="text-right">Drawdown</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={8}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                No periods match the current research controls.
              </TableCell>
            </TableRow>
          ) : null}
          {items.map((item) => {
            const selected = selectedPeriod === item.period_start;
            const isSelectedTrade =
              granularity === "TRADE" &&
              selectedTradeId &&
              item.trade_id === selectedTradeId;
            return (
              <TableRow
                key={`${item.granularity}-${item.period_start}`}
                data-period={item.period_start}
                data-selected={selected || isSelectedTrade || undefined}
                tabIndex={-1}
                className={
                  selected || isSelectedTrade ? "bg-brand/10" : undefined
                }
                onClick={() => {
                  if (
                    granularity === "TRADE" &&
                    item.trade_id &&
                    onSelectTrade
                  ) {
                    onSelectTrade(item.trade_id);
                  }
                }}
                style={{
                  cursor:
                    granularity === "TRADE" && item.trade_id
                      ? "pointer"
                      : "default",
                }}
              >
                <TableCell>
                  <Button
                    variant="ghost"
                    className="h-auto p-0 font-mono text-left hover:bg-transparent"
                    onClick={() => onSelect(item.period_start)}
                    aria-current={selected ? "true" : undefined}
                  >
                    {item.period_start}
                    {item.partial ? " (partial)" : ""}
                  </Button>
                </TableCell>
                <TableCell>{item.eligible_session_count}</TableCell>
                <TableCell>{item.trade_count}</TableCell>
                <TableCell className="text-right font-mono">
                  {demo(item.gross_outcome, unit)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {demo(item.costs, unit)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {demo(item.net_outcome, unit)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {demo(item.cumulative_net_outcome, unit)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {demo(item.run_drawdown_end, unit)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function RunAnalyticsWorkspace({ runId }: { runId: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [expanded, setExpanded] = useState(false);
  const [definitionsOpen, setDefinitionsOpen] = useState(false);
  const granularity: Granularity =
    searchParams.get("analytics_granularity") === "MONTH"
      ? "MONTH"
      : searchParams.get("analytics_granularity") === "TRADE"
        ? "TRADE"
        : "DAY";
  const selectedPeriod = searchParams.get("analytics_period");
  const selectedTradeId = searchParams.get("selected_trade") ?? undefined;
  const metric = (searchParams.get("analytics_metric") ??
    "OUTCOME") as PeriodMetric;
  const safeMetric: PeriodMetric = metricSeries[metric] ? metric : "OUTCOME";
  const sort =
    searchParams.get("analytics_sort") === "PERIOD_DESC"
      ? "PERIOD_DESC"
      : "PERIOD_ASC";
  const includeZeroPeriods =
    granularity === "TRADE" || searchParams.get("analytics_zero") !== "hide";
  const startDate = searchParams.get("analytics_from") ?? "";
  const endDate = searchParams.get("analytics_to") ?? "";
  const cursor = searchParams.get("analytics_cursor") ?? undefined;
  const view: ChartView =
    searchParams.get("analytics_view") === "table" ? "table" : "chart";
  const currentSeries = metricSeries[safeMetric];
  const requestedSeries = searchParams
    .get("analytics_series")
    ?.split(",")
    .filter(Boolean);
  const initialSeries =
    requestedSeries?.filter((item) =>
      currentSeries.some((series) => series.id === item),
    ) ?? currentSeries.map((series) => series.id);

  const update = (changes: Record<string, string | null>) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      return next;
    });
  };
  const selectPeriod = (period: string) => update({ analytics_period: period });
  const selectTrade = (tradeId: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("selected_trade", tradeId);
      return next;
    });
  };
  const filters = {
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    includeZeroPeriods,
  };
  const effectiveSort = granularity === "TRADE" ? "PERIOD_ASC" : sort;
  const exportSelection: AnalyticsExportSelection = {
    granularity,
    ...filters,
    sort: effectiveSort,
  };
  const exporter = useMutation({
    mutationFn: (format: "csv" | "json") =>
      downloadBacktestExport(runId, "analytics", format, exportSelection),
    onSuccess: ({ blob, filename }) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    },
  });
  const summary = useQuery({
    queryKey: ["run-analytics-summary", runId],
    queryFn: () => getRunAnalyticsSummary(runId),
  });
  const chartPeriods = useQuery({
    queryKey: ["run-analytics-chart", runId, granularity, filters],
    queryFn: () =>
      listAnalyticsPeriods(
        runId,
        granularity,
        "chart",
        undefined,
        500,
        filters,
      ),
  });
  const tablePeriods = useQuery({
    queryKey: [
      "run-analytics-table",
      runId,
      granularity,
      cursor,
      filters,
      effectiveSort,
    ],
    queryFn: () =>
      listAnalyticsPeriods(runId, granularity, "table", cursor, 200, {
        ...filters,
        sort: effectiveSort,
      }),
  });
  const definitions = useQuery({
    queryKey: ["run-analytics-definitions", runId],
    queryFn: () => getAnalyticsDefinitions(runId),
    enabled: definitionsOpen,
  });
  const chartItems = useMemo(
    () => chartPeriods.data?.items ?? [],
    [chartPeriods.data],
  );
  const tableItems = useMemo(
    () => tablePeriods.data?.items ?? [],
    [tablePeriods.data],
  );
  const chartData = useMemo(
    () =>
      chartItems.flatMap((item) => {
        const timestamp = Date.parse(`${item.period_start}T00:00:00Z`);
        if (!Number.isFinite(timestamp)) return [];
        return [
          {
            item,
            timestamp,
            label: item.period_start,
            gross: Number(item.gross_outcome),
            costs: Number(item.costs),
            net: Number(item.net_outcome),
            cumulative: Number(item.cumulative_net_outcome),
            drawdown: Number(item.run_drawdown_end),
          },
        ];
      }),
    [chartItems],
  );
  const chartTimestamps = useMemo(
    () => chartData.map((item) => item.timestamp),
    [chartData],
  );
  const viewport = useChartViewport(chartTimestamps, initialSeries);
  const visibleData = useMemo(
    () =>
      viewport.visibleDomain
        ? chartData.filter(
            (item) =>
              item.timestamp >= viewport.visibleDomain!.start &&
              item.timestamp <= viewport.visibleDomain!.end,
          )
        : [],
    [chartData, viewport.visibleDomain],
  );

  useEffect(() => {
    const normalized = viewport.visibleSeries.join(",");
    const current = searchParams.get("analytics_series") ?? "";
    if (normalized === current) return;
    update({ analytics_series: normalized || null });
    // The URL is the persisted preference; this effect only mirrors a direct legend toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport.visibleSeries]);

  if (summary.isPending) {
    return (
      <div className="h-40 animate-pulse rounded-xl border border-border bg-surface/40" />
    );
  }
  if (summary.isError || !summary.data) {
    return (
      <p className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
        Completed-run analytics are being prepared or could not be loaded.
      </p>
    );
  }
  const data = summary.data.summary;
  const activeUnit = summary.data.safeguards.unit;
  const outcomeDistribution = [
    { label: "Wins", count: data.wins, color: "#55c596" },
    { label: "Losses", count: data.losses, color: "#ef746c" },
    { label: "Breakeven", count: data.breakevens, color: "#d6a642" },
  ];
  const renderChart = () => (
    <div className="h-full rounded-xl border border-border/70 bg-surface-subtle p-2 sm:p-3">
      <ResponsiveContainer width="100%" height="100%">
        {safeMetric === "OUTCOME" ? (
          <BarChart
            data={visibleData}
            onClick={(event) => {
              if (typeof event?.activeLabel === "string")
                selectPeriod(event.activeLabel);
            }}
          >
            <CartesianGrid strokeDasharray="2 5" vertical={false} />
            <XAxis dataKey="label" minTickGap={32} />
            <YAxis />
            <Tooltip formatter={(value) => demo(value, activeUnit)} />
            {viewport.visibleSeries.includes("gross") ? (
              <Bar
                dataKey="gross"
                name="Gross"
                fill="#8c52ff"
                isAnimationActive={false}
              />
            ) : null}
            {viewport.visibleSeries.includes("costs") ? (
              <Bar
                dataKey="costs"
                name="Costs"
                fill="#d6a642"
                isAnimationActive={false}
              />
            ) : null}
            {viewport.visibleSeries.includes("net") ? (
              <Bar
                dataKey="net"
                name="Net outcome"
                fill="#55c596"
                isAnimationActive={false}
              />
            ) : null}
          </BarChart>
        ) : (
          <LineChart
            data={visibleData}
            onClick={(event) => {
              if (typeof event?.activeLabel === "string")
                selectPeriod(event.activeLabel);
            }}
          >
            <CartesianGrid strokeDasharray="2 5" vertical={false} />
            <XAxis dataKey="label" minTickGap={32} />
            <YAxis />
            <Tooltip formatter={(value) => demo(value, activeUnit)} />
            <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 4" />
            {safeMetric === "CUMULATIVE" &&
            viewport.visibleSeries.includes("cumulative") ? (
              <Line
                type="monotone"
                dataKey="cumulative"
                name="Cumulative outcome"
                stroke="#8c52ff"
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={false}
              />
            ) : null}
            {safeMetric === "DRAWDOWN" &&
            viewport.visibleSeries.includes("drawdown") ? (
              <Line
                type="monotone"
                dataKey="drawdown"
                name="Underwater drawdown"
                stroke="#ef746c"
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={false}
              />
            ) : null}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
  const handleChartKeyboard = (event: React.KeyboardEvent<HTMLElement>) => {
    if (
      event.target instanceof HTMLButtonElement ||
      event.target instanceof HTMLInputElement
    )
      return;
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      viewport.zoom(1.8);
    } else if (event.key === "-") {
      event.preventDefault();
      viewport.zoom(1 / 1.8);
    } else if (event.key === "Home") {
      event.preventDefault();
      viewport.reset();
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      if (event.shiftKey)
        viewport.pan(event.key === "ArrowLeft" ? -0.25 : 0.25);
      else viewport.moveActive(event.key === "ArrowLeft" ? -1 : 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      setExpanded(true);
    }
  };
  const renderFrame = (isExpanded: boolean) => (
    <ChartFrame
      title={`${granularity === "TRADE" ? "Trade" : granularity === "DAY" ? "Daily" : "Monthly"} ${safeMetric.toLowerCase()} view`}
      description={
        activeUnit === "INR"
          ? "Closed financial simulation outcomes in Indian Rupees (₹). Scroll, use + / −, Shift + arrow keys, or the controls to inspect the exact server-provided range."
          : "Closed synthetic outcomes in DEMO_UNITS. Scroll, use + / −, Shift + arrow keys, or the controls to inspect the exact server-provided range."
      }
      view={view}
      controls={
        <ChartToolbar
          canZoom={viewport.canZoom}
          view={view}
          onZoomIn={() => viewport.zoom(1.8)}
          onZoomOut={() => viewport.zoom(1 / 1.8)}
          onReset={viewport.reset}
          onExpand={() => setExpanded(true)}
          onViewChange={(nextView) =>
            update({ analytics_view: nextView === "table" ? "table" : null })
          }
        />
      }
      legend={
        <ChartLegend
          series={[...currentSeries]}
          visibleSeries={viewport.visibleSeries}
          onToggle={viewport.toggleSeries}
        />
      }
      insight={
        <p className="m-0 text-xs text-muted-foreground">
          {visibleData.length} of {chartData.length} periods visible. Select a
          point to focus its ledger row.
        </p>
      }
      chart={renderChart()}
      table={
        <PeriodLedger
          items={tableItems}
          selectedPeriod={selectedPeriod}
          granularity={granularity}
          unit={activeUnit}
          onSelect={selectPeriod}
          selectedTradeId={selectedTradeId}
          onSelectTrade={selectTrade}
        />
      }
      onKeyDown={handleChartKeyboard}
      status={
        selectedPeriod
          ? `Selected ${granularity.toLowerCase()} period ${selectedPeriod}.`
          : `Visible ${granularity.toLowerCase()} periods: ${visibleData.length}.`
      }
      isExpanded={isExpanded}
    />
  );

  return (
    <section aria-labelledby="run-analytics-heading" className="space-y-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <p className="m-0 text-xs font-bold uppercase tracking-[0.16em] text-brand">
            Research workspace
          </p>
          <h2
            id="run-analytics-heading"
            className="m-0 mt-1 text-xl font-bold text-foreground"
          >
            Closed-outcome analytics
          </h2>
          <p className="m-0 mt-1 text-sm text-muted-foreground">
            {activeUnit === "INR"
              ? "Exit-date realized option-simulation outcomes in Indian Rupees. "
              : "Exit-date realized synthetic outcomes. "}
            {includeZeroPeriods
              ? "Zero-trade sessions remain visible."
              : "Zero-trade sessions are hidden for this view."}
          </p>
        </div>
        <div
          role="group"
          aria-label="Performance granularity"
          className="flex rounded-lg border border-border bg-surface/50 p-1"
        >
          {(["TRADE", "DAY", "MONTH"] as Granularity[]).map((value) => (
            <Button
              key={value}
              size="sm"
              variant={granularity === value ? "default" : "ghost"}
              onClick={() =>
                update({
                  analytics_granularity: value,
                  analytics_period: null,
                  analytics_cursor: null,
                })
              }
            >
              {value === "TRADE" ? "Trade" : value === "DAY" ? "Day" : "Month"}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Net outcome"
          value={demo(data.net_outcome, activeUnit)}
        />
        <Metric
          label="Gross outcome"
          value={demo(data.gross_outcome, activeUnit)}
          detail={`Costs ${demo(data.total_costs, activeUnit)}`}
        />
        <Metric
          label="Expectancy"
          value={demo(data.expectancy, activeUnit)}
          detail={`${data.total_trades} closed trades`}
        />
        <Metric
          label="Maximum drawdown"
          value={demo(data.max_drawdown_amount, activeUnit)}
          detail={`Peak ${data.drawdown_peak_timestamp ?? data.drawdown_peak_date ?? "—"} · trough ${data.drawdown_trough_timestamp ?? data.drawdown_trough_date ?? "—"}`}
        />
        <Metric
          label="Win rate"
          value={`${(Number(data.win_rate) * 100).toFixed(1)}%`}
          detail={`${data.wins} wins · ${data.losses} losses · ${data.breakevens} flat`}
        />
        <Metric
          label="Profit factor"
          value={
            data.profit_factor.value === null
              ? "Unavailable"
              : Number(data.profit_factor.value).toFixed(2)
          }
          detail={data.profit_factor.reason ?? "Positive outcomes ÷ losses"}
        />
        <Metric
          label="Payoff ratio"
          value={
            data.payoff_ratio.value === null
              ? "Unavailable"
              : Number(data.payoff_ratio.value).toFixed(2)
          }
          detail={data.payoff_ratio.reason ?? "Average win ÷ average loss"}
        />
        <Metric
          label="Streaks"
          value={`${data.max_consecutive_wins} W · ${data.max_consecutive_losses} L`}
          detail={`${data.active_sessions} active of ${data.eligible_sessions} sessions`}
        />
      </div>

      <Card className="glass-card">
        <CardHeader className="gap-3">
          <div>
            <CardTitle className="text-base">Research controls</CardTitle>
            <CardDescription>
              These filters are part of the shareable workspace URL.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              From
              <input
                type="date"
                value={startDate}
                onChange={(event) =>
                  update({
                    analytics_from: event.target.value || null,
                    analytics_cursor: null,
                  })
                }
                className="h-9 rounded-md border border-border bg-surface px-2 text-foreground"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              To
              <input
                type="date"
                value={endDate}
                onChange={(event) =>
                  update({
                    analytics_to: event.target.value || null,
                    analytics_cursor: null,
                  })
                }
                className="h-9 rounded-md border border-border bg-surface px-2 text-foreground"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Metric
              <AppSelect
                value={safeMetric}
                ariaLabel="Analytics metric"
                placeholder="Choose metric"
                onValueChange={(value) =>
                  update({
                    analytics_metric: value,
                    analytics_series: null,
                  })
                }
                className="h-9"
                options={[
                  { value: "OUTCOME", label: "Gross / cost / net" },
                  { value: "CUMULATIVE", label: "Cumulative outcome" },
                  { value: "DRAWDOWN", label: "Underwater drawdown" },
                ]}
              />
            </label>
            {granularity !== "TRADE" ? (
              <>
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  Ledger order
                  <AppSelect
                    value={sort}
                    ariaLabel="Ledger order"
                    placeholder="Choose ledger order"
                    onValueChange={(value) =>
                      update({
                        analytics_sort:
                          value === "PERIOD_DESC" ? "PERIOD_DESC" : null,
                        analytics_cursor: null,
                      })
                    }
                    className="h-9"
                    options={[
                      { value: "PERIOD_ASC", label: "Oldest first" },
                      { value: "PERIOD_DESC", label: "Newest first" },
                    ]}
                  />
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    update({
                      analytics_zero: includeZeroPeriods ? "hide" : null,
                      analytics_cursor: null,
                    })
                  }
                >
                  {includeZeroPeriods
                    ? "Hide zero-trade periods"
                    : "Show zero-trade periods"}
                </Button>
              </>
            ) : null}
            <div
              role="group"
              aria-label="Export selected research view"
              className="flex items-end gap-1"
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => exporter.mutate("csv")}
                disabled={exporter.isPending}
              >
                Export CSV
              </Button>
              <Button
                size="sm"
                onClick={() => exporter.mutate("json")}
                disabled={exporter.isPending}
              >
                Export JSON
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {chartPeriods.data?.warnings?.map((warning) => (
        <p
          key={warning}
          className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning"
        >
          {warning}
        </p>
      ))}
      {renderFrame(false)}
      <ChartExpandedDialog
        isOpen={expanded}
        onClose={() => setExpanded(false)}
        title="Completed-run analytics"
      >
        {renderFrame(true)}
      </ChartExpandedDialog>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">
            Trade-outcome distribution
          </CardTitle>
          <CardDescription>
            {activeUnit === "INR"
              ? "Counts of closed option-simulation outcomes in this historical run."
              : "Counts of closed synthetic trade outcomes; this is not financial performance."}
          </CardDescription>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={outcomeDistribution}>
              <CartesianGrid strokeDasharray="2 5" vertical={false} />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar
                dataKey="count"
                name="Closed trades"
                isAnimationActive={false}
              >
                {outcomeDistribution.map((item) => (
                  <Cell key={item.label} fill={item.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Outcome</TableHead>
                <TableHead className="text-right">Closed trades</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {outcomeDistribution.map((item) => (
                <TableRow key={item.label}>
                  <TableCell>{item.label}</TableCell>
                  <TableCell className="text-right font-mono">
                    {item.count}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">
            Exact {granularity.toLowerCase()} ledger
          </CardTitle>
          <CardDescription>
            Server-paginated records reconcile to the closed-outcome source.{" "}
            {tablePeriods.data?.original_count ?? 0} matching periods.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[420px]">
          <PeriodLedger
            items={tableItems}
            selectedPeriod={selectedPeriod}
            granularity={granularity}
            unit={activeUnit}
            onSelect={selectPeriod}
          />
        </CardContent>
        <CardContent className="flex items-center justify-between pt-0">
          <Button
            variant="outline"
            size="sm"
            disabled={!cursor}
            onClick={() => update({ analytics_cursor: null })}
          >
            First page
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!tablePeriods.data?.next_cursor}
            onClick={() =>
              update({
                analytics_cursor: String(tablePeriods.data?.next_cursor),
              })
            }
          >
            Next page
          </Button>
        </CardContent>
      </Card>

      <details
        className="rounded-lg border border-border bg-surface/30 p-4"
        onToggle={(event) =>
          setDefinitionsOpen((event.target as HTMLDetailsElement).open)
        }
      >
        <summary className="cursor-pointer text-sm font-semibold text-foreground">
          Metric definitions
        </summary>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          {definitions.data?.items.map((item) => (
            <li key={item.key}>
              <strong className="text-foreground">{item.label}:</strong>{" "}
              {item.definition} Formula: {item.formula}.
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
