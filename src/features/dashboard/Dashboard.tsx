import { useQuery } from "@tanstack/react-query";
import { NavLink } from "react-router-dom";
import {
  ArrowUpRight,
  TrendingUp,
  History,
  ShieldCheck,
  Zap,
  Play,
  BarChart2,
  Activity,
  AlertCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";

import {
  listBacktests,
  listEquity,
  getBacktestHistorySummary,
  type BacktestCatalogRun,
} from "../../api/backtests";
import { listAlgorithms } from "../../api/algorithms";
import { getSystemStatus } from "../../api/system";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency } from "../../lib/formatters";

export function Dashboard() {
  const algorithmsQuery = useQuery({
    queryKey: ["algorithms"],
    queryFn: listAlgorithms,
  });

  const backtestsQuery = useQuery({
    queryKey: ["backtests", "dashboard"],
    queryFn: () => listBacktests(),
    refetchInterval: 5000,
  });

  const summary = useQuery({
    queryKey: ["backtest-history-summary", "dashboard"],
    queryFn: () => getBacktestHistorySummary(),
    refetchInterval: 5000,
  });
  const health = useQuery({
    queryKey: ["system-status", "dashboard"],
    queryFn: getSystemStatus,
    refetchInterval: 15000,
  });
  const latest = useQuery({
    queryKey: ["backtests", "latest-completed"],
    queryFn: () => listBacktests({ status: "COMPLETED" }, undefined, 1),
    refetchInterval: 5000,
  });

  const runs = backtestsQuery.data?.items ?? [];
  const latestCompletedRun = latest.data?.items[0];

  const equityQuery = useQuery({
    queryKey: ["backtest-equity", latestCompletedRun?.id],
    queryFn: async () => {
      const first = await listEquity(latestCompletedRun!.id);
      const items = [...first.items];
      let cursor = first.next_cursor;
      while (cursor) {
        const page = await listEquity(latestCompletedRun!.id, cursor);
        items.push(...page.items);
        cursor = page.next_cursor;
      }
      return { ...first, items };
    },
    enabled: Boolean(latestCompletedRun?.id),
  });

  const completedCount = summary.data?.completed_runs ?? 0;
  const failedCount = summary.data?.failed_runs ?? 0;
  const runningCount = summary.data?.active_runs ?? 0;
  const totalCount = summary.data?.total_runs;

  const equityPoints = equityQuery.data?.items ?? [];
  const chartData = equityPoints.map((pt) => ({
    timestamp:
      pt.timestamp.length > 16 ? pt.timestamp.slice(5, 16) : pt.timestamp,
    equity: Number(pt.equity_demo_units),
    drawdown: Math.abs(Number(pt.drawdown_demo_units)),
  }));

  const pieData = [
    { name: "Completed", value: completedCount, color: "var(--success)" },
    { name: "Failed", value: failedCount, color: "var(--danger)" },
    { name: "Running", value: runningCount, color: "var(--brand)" },
    {
      name: "Cancelled",
      value: summary.data?.status_counts.CANCELLED ?? 0,
      color: "var(--muted-foreground)",
    },
  ].filter((d) => d.value > 0);

  return (
    <div className="flex max-w-7xl flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {(summary.isError ||
        backtestsQuery.isError ||
        latest.isError ||
        equityQuery.isError) && (
        <p role="alert">
          Some dashboard data could not be loaded. Counts and charts may be
          unavailable.
        </p>
      )}
      {latestCompletedRun?.mode === "OPTION_SPREAD_SIMULATION" && (
        <p role="note">
          Historical INR estimates use option candle closes and slippage;
          executable bid/ask prices are unavailable.
        </p>
      )}
      {/* Header Section */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground m-0 flex items-center gap-2">
            <Activity className="text-brand" /> System Overview
          </h1>
          <p className="text-sm text-muted-foreground m-0 mt-1.5 max-w-2xl">
            Real-time monitoring of backtest runs, strategy equity, and platform
            health.
          </p>
        </div>
        <Button
          asChild
          className="bg-brand hover:bg-brand/90 text-white shadow-[0_0_20px_rgba(140,82,255,0.4)] transition-all"
        >
          <NavLink to="/studio">
            <Play className="mr-2 h-4 w-4 fill-current" /> Start New Backtest
          </NavLink>
        </Button>
      </header>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Active Algorithms"
          value={String(algorithmsQuery.data?.items.length ?? 0)}
          trend="Registered strategies"
          icon={<TrendingUp className="h-5 w-5 text-brand" />}
        />
        <MetricCard
          title="Total Backtest Runs"
          value={totalCount === undefined ? "—" : String(totalCount)}
          trend={`${completedCount} completed successfully`}
          icon={<History className="h-5 w-5 text-success" />}
        />
        <MetricCard
          title="Run Success Rate"
          value={
            totalCount
              ? `${Math.round((completedCount / totalCount) * 100)}%`
              : "N/A"
          }
          trend={
            totalCount === undefined
              ? "Unavailable"
              : `${failedCount} run failures`
          }
          icon={<BarChart2 className="h-5 w-5 text-brand" />}
        />
        <MetricCard
          title="System Status"
          value={
            health.isPending
              ? "Checking…"
              : health.isError
                ? "Unavailable"
                : health.data?.readiness.status === "ready"
                  ? "Operational"
                  : "Degraded"
          }
          trend={
            health.isError
              ? "Health check failed"
              : health.data?.readiness.status === "ready"
                ? "Dependencies responding"
                : "Dependencies not confirmed ready"
          }
          icon={<ShieldCheck className="h-5 w-5 text-success" />}
          alert={failedCount > 0}
        />
      </div>

      {/* Main Charts Area (2 Columns) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Equity Curve Chart */}
        <Card className="lg:col-span-2 glass-card border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  Latest Completed Run Equity
                </CardTitle>
                <CardDescription>
                  {latestCompletedRun?.id
                    ? `Run #${latestCompletedRun.id.slice(0, 8)} • Chronological performance`
                    : "No completed runs yet"}
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className={
                  latestCompletedRun?.mode === "OPTION_SPREAD_SIMULATION"
                    ? "bg-success/10 text-success border-success/30"
                    : "bg-brand/10 text-brand border-brand/20"
                }
              >
                <span
                  className={`h-2 w-2 rounded-full mr-2 animate-pulse ${
                    latestCompletedRun?.mode === "OPTION_SPREAD_SIMULATION"
                      ? "bg-success"
                      : "bg-brand"
                  }`}
                />
                {latestCompletedRun?.mode === "OPTION_SPREAD_SIMULATION"
                  ? "INR (₹)"
                  : latestCompletedRun?.unit || "DEMO_UNITS"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full mt-4">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="equityGrad"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="var(--brand)"
                          stopOpacity={0.4}
                        />
                        <stop
                          offset="95%"
                          stopColor="var(--brand)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                      opacity={0.3}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="timestamp"
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      stroke="var(--border)"
                      tickMargin={10}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      stroke="var(--border)"
                      domain={["auto", "auto"]}
                      tickFormatter={(val) => `${val}`}
                      tickMargin={10}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="glass p-3 rounded-lg border border-border shadow-xl">
                              <p className="text-xs text-muted-foreground mb-1">
                                {label}
                              </p>
                              <p className="text-sm font-bold text-foreground">
                                <span className="text-brand mr-2">●</span>
                                {formatCurrency(
                                  payload[0].value,
                                  latestCompletedRun?.mode ===
                                    "OPTION_SPREAD_SIMULATION"
                                    ? "INR"
                                    : "DEMO",
                                )}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="equity"
                      stroke="var(--brand)"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#equityGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-sm text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-border/50">
                  <BarChart2 className="h-10 w-10 mb-3 opacity-20" />
                  <p>No backtest equity data yet.</p>
                  <Button variant="link" asChild className="mt-2 text-brand">
                    <NavLink to="/studio">
                      Start a backtest run to generate charts
                    </NavLink>
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Backtest Run Status Breakdown */}
        <Card className="glass-card border-border/50 flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Run Distribution</CardTitle>
            <CardDescription>Execution outcomes breakdown</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center">
            <div className="h-[220px] w-full flex items-center justify-center">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="transparent"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        borderColor: "var(--border)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      itemStyle={{ color: "var(--foreground)" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-sm text-muted-foreground flex flex-col items-center">
                  <Activity className="h-8 w-8 mb-2 opacity-20" />
                  No runs recorded
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 pt-4 mt-2 border-t border-border/50 text-xs">
              {pieData.map((d) => (
                <div
                  key={d.name}
                  className="flex flex-col items-center justify-center bg-muted/30 rounded-md py-2"
                >
                  <span className="text-muted-foreground mb-1">{d.name}</span>
                  <div className="flex items-center gap-1.5 font-bold text-foreground">
                    <span
                      className="h-2 w-2 rounded-full shadow-sm"
                      style={{
                        backgroundColor: d.color,
                        boxShadow: `0 0 8px ${d.color}`,
                      }}
                    />
                    {d.value}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-foreground m-0 flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" /> Recent
            Executions
          </h2>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-muted-foreground hover:text-foreground group"
          >
            <NavLink to="/backtests">
              View all history
              <ArrowUpRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </NavLink>
          </Button>
        </div>

        <Card className="glass-card border-border/50 overflow-hidden">
          {runs.length > 0 ? (
            <div className="divide-y divide-border/50">
              {runs.slice(0, 5).map((run) => (
                <ActivityRow key={run.id} run={run} />
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No backtests have been executed yet. Navigate to Backtest Studio
              to start your first run.
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

function MetricCard({
  title,
  value,
  trend,
  icon,
  alert = false,
}: {
  title: string;
  value: string;
  trend: string;
  icon: React.ReactNode;
  alert?: boolean;
}) {
  return (
    <Card
      className={cn(
        "glass-card border-border/50 transition-all duration-300 hover:shadow-lg hover:border-border",
        alert && "border-danger/30 bg-danger/5",
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <h3 className="m-0 text-sm font-medium text-muted-foreground">
            {title}
          </h3>
          <div
            className={cn(
              "p-2 rounded-lg bg-muted/50",
              alert && "bg-danger/10",
            )}
          >
            {alert ? (
              <AlertCircle className="h-5 w-5 text-danger animate-pulse" />
            ) : (
              icon
            )}
          </div>
        </div>
        <div className="mb-2 text-3xl font-extrabold text-foreground tracking-tight">
          {value}
        </div>
        <div
          className={cn(
            "flex items-center gap-1.5 text-xs",
            alert ? "text-danger" : "text-muted-foreground",
          )}
        >
          {!alert && <ArrowUpRight className="h-3.5 w-3.5 text-success" />}
          {trend}
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityRow({ run }: { run: BacktestCatalogRun }) {
  const isCompleted = run.status === "COMPLETED";
  const isFailed = run.status === "FAILED";

  return (
    <NavLink
      to={`/backtests/${run.id}`}
      className="flex items-center justify-between p-4 transition-colors hover:bg-muted/30 group"
    >
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl shadow-sm transition-transform group-hover:scale-105",
            isCompleted
              ? "bg-success/10 text-success"
              : isFailed
                ? "bg-danger/10 text-danger"
                : "bg-brand/10 text-brand",
          )}
        >
          <Zap className="h-5 w-5 fill-current opacity-20 absolute" />
          <Zap className="h-4 w-4 relative z-10" />
        </div>
        <div>
          <strong className="block text-sm font-bold text-foreground">
            Run {run.id.slice(0, 8)}
          </strong>
          <span className="text-xs text-muted-foreground font-medium">
            {run.start_date} to {run.end_date}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="hidden sm:flex flex-col items-end">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
            Mode
          </span>
          <span className="text-xs font-mono text-foreground font-medium">
            {run.mode}
          </span>
        </div>
        <Badge
          variant="secondary"
          className={cn(
            "font-semibold tracking-wide uppercase text-[10px]",
            isCompleted && "bg-success/10 text-success hover:bg-success/20",
            isFailed && "bg-danger/10 text-danger hover:bg-danger/20",
            !isCompleted &&
              !isFailed &&
              "bg-brand/10 text-brand hover:bg-brand/20 animate-pulse",
          )}
        >
          {run.status}
        </Badge>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 -ml-2 transition-all group-hover:opacity-100 group-hover:translate-x-1" />
      </div>
    </NavLink>
  );
}
