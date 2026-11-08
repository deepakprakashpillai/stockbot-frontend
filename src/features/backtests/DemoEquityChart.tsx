import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartExpandedDialog,
  ChartFrame,
  ChartLegend,
  ChartToolbar,
  useChartViewport,
  type ChartView,
} from "../../components/charts";
import type { DemoEquityPoint } from "../../api/backtests";

import { formatCurrency } from "../../lib/formatters";

type EquityChartPoint = {
  id: string;
  sequence: number;
  timestamp: string;
  timestampValue: number;
  equity: number;
  drawdown: number;
  unit?: string;
};

const getSeries = (unit = "DEMO_UNITS") => [
  {
    id: "equity",
    label: unit === "INR" ? "Equity (₹)" : "Equity (DEMO)",
    color: "#8c52ff",
  },
  {
    id: "drawdown",
    label: unit === "INR" ? "Drawdown (₹)" : "Drawdown (DEMO)",
    color: "#ef746c",
  },
];

function formatOriginalTimestamp(timestamp: string) {
  return timestamp.slice(0, 16).replace("T", " ");
}

function formatAxisTimestamp(value: number, points: EquityChartPoint[]) {
  const nearest = points.reduce<EquityChartPoint | undefined>(
    (closest, point) => {
      if (
        !closest ||
        Math.abs(point.timestampValue - value) <
          Math.abs(closest.timestampValue - value)
      ) {
        return point;
      }
      return closest;
    },
    undefined,
  );

  return nearest ? formatOriginalTimestamp(nearest.timestamp).slice(5) : "";
}

function formatDemoValue(value: unknown, unit = "DEMO_UNITS") {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return "—";
  if (unit === "INR" || unit === "₹") {
    return formatCurrency(numeric, "INR");
  }
  return `${numeric.toFixed(2)} DEMO_UNITS`;
}

function EquityTooltip({
  active,
  payload,
  unit = "DEMO_UNITS",
}: {
  active?: boolean;
  payload?: Array<{ payload?: EquityChartPoint }>;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <div className="rounded-xl border border-border/80 bg-surface/95 p-3.5 text-xs shadow-xl backdrop-blur-md">
      <p className="m-0 mb-2 font-mono text-[11px] font-semibold text-muted-foreground">
        Sequence #{point.sequence} · {formatOriginalTimestamp(point.timestamp)}
      </p>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <span className="h-2 w-2 rounded-full bg-[#8c52ff]" />
            {unit === "INR" ? "Equity (₹)" : "Equity"}
          </span>
          <span className="font-mono font-bold text-foreground">
            {formatDemoValue(point.equity, unit)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <span className="h-2 w-2 rounded-full bg-[#ef746c]" />
            {unit === "INR" ? "Drawdown (₹)" : "Drawdown"}
          </span>
          <span className="font-mono font-bold text-danger">
            {formatDemoValue(point.drawdown, unit)}
          </span>
        </div>
      </div>
    </div>
  );
}

function EquityDataTable({
  items,
  selectedPointId,
  onSelectPoint,
  unit = "DEMO_UNITS",
}: {
  items: EquityChartPoint[];
  selectedPointId?: string;
  onSelectPoint?: (point: EquityChartPoint) => void;
  unit?: string;
}) {
  return (
    <div
      className="h-full overflow-auto rounded-lg border border-border"
      role="region"
      aria-label="Visible synthetic equity and drawdown data"
      tabIndex={0}
    >
      <table className="min-w-[620px] w-full text-left text-xs">
        <caption className="sr-only">
          Visible chronological synthetic equity and drawdown values in
          {unit}
        </caption>
        <thead className="sticky top-0 bg-surface-subtle text-muted">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              Point
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Timestamp
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Equity
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Drawdown
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((point) => (
            <tr
              key={point.id}
              id={`equity-${point.id}`}
              data-selected={point.id === selectedPointId || undefined}
              className={`cursor-pointer hover:bg-surface-subtle focus-within:bg-brand/10 ${point.id === selectedPointId ? "bg-brand/10 outline outline-1 outline-brand" : ""}`}
              onClick={() => onSelectPoint?.(point)}
            >
              <th
                scope="row"
                className="px-3 py-2 font-mono font-medium text-foreground"
              >
                {point.sequence}
              </th>
              <td className="px-3 py-2 text-muted">
                {formatOriginalTimestamp(point.timestamp)}
              </td>
              <td className="px-3 py-2 font-mono text-brand">
                {formatDemoValue(point.equity, unit)}
              </td>
              <td className="px-3 py-2 font-mono text-danger">
                {formatDemoValue(point.drawdown, unit)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DemoEquityChart({
  items,
  selectedPointId,
  onSelectPoint,
  onVisibleRangeChange,
  range,
  unit,
}: {
  items: DemoEquityPoint[];
  selectedPointId?: string;
  onSelectPoint?: (point: DemoEquityPoint) => void;
  onVisibleRangeChange?: (range: { start?: string; end?: string }) => void;
  range?: { start?: string; end?: string };
  unit?: string;
}) {
  const requestedUnit = unit || items[0]?.unit || "DEMO_UNITS";
  const activeUnit: "INR" | "DEMO_UNITS" =
    requestedUnit === "INR" ? "INR" : "DEMO_UNITS";
  const activeSeries = useMemo(() => getSeries(activeUnit), [activeUnit]);
  const [view, setView] = useState<ChartView>("chart");
  const [expanded, setExpanded] = useState(false);
  const pointerRef = useRef<{
    id: number;
    x: number;
    domainStart: number;
    domainEnd: number;
  } | null>(null);
  const touchPointsRef = useRef(new Map<number, number>());
  const pinchRef = useRef<{
    distance: number;
    anchor: number;
    domainStart: number;
    domainEnd: number;
  } | null>(null);
  const chartData = useMemo<EquityChartPoint[]>(
    () =>
      items.flatMap((item) => {
        const timestampValue = Date.parse(item.timestamp);
        const equity = Number(item.equity_demo_units);
        const drawdown = Number(item.drawdown_demo_units);
        if (
          !Number.isFinite(timestampValue) ||
          !Number.isFinite(equity) ||
          !Number.isFinite(drawdown)
        )
          return [];
        return [
          {
            id: item.id,
            sequence: item.sequence,
            timestamp: item.timestamp,
            timestampValue,
            equity,
            drawdown,
            unit: item.unit,
          },
        ];
      }),
    [items],
  );
  const timestamps = useMemo(
    () => chartData.map((item) => item.timestampValue),
    [chartData],
  );
  const viewport = useChartViewport(
    timestamps,
    activeSeries.map((item) => item.id),
  );
  const selectViewportDomain = viewport.selectDomain;
  const appliedRangeRef = useRef<string | null>(null);
  useEffect(() => {
    if (!range?.start || !range.end) return;
    const start = Date.parse(range.start);
    const end = Date.parse(range.end);
    const key = `${start}:${end}`;
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      appliedRangeRef.current === key
    )
      return;
    appliedRangeRef.current = key;
    selectViewportDomain({ start, end });
  }, [range?.end, range?.start, selectViewportDomain]);
  const visibleData = useMemo(
    () =>
      viewport.visibleDomain
        ? chartData.filter(
            (item) =>
              item.timestampValue >= viewport.visibleDomain!.start &&
              item.timestampValue <= viewport.visibleDomain!.end,
          )
        : [],
    [chartData, viewport.visibleDomain],
  );
  useEffect(() => {
    if (!viewport.visibleDomain || !onVisibleRangeChange) return;
    const timer = window.setTimeout(() => {
      const start = new Date(viewport.visibleDomain!.start).toISOString();
      const end = new Date(viewport.visibleDomain!.end).toISOString();
      onVisibleRangeChange({ start, end });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [onVisibleRangeChange, viewport.visibleDomain]);
  const selectedPoint = chartData.find((item) => item.id === selectedPointId);
  const { canZoom } = viewport;
  const allSeriesHidden = viewport.visibleSeries.length === 0;
  const latestPoint = visibleData.at(-1);
  const lowestDrawdown = visibleData.length
    ? Math.min(...visibleData.map((point) => point.drawdown))
    : null;

  if (!items?.length) return null;

  const handleKeyboard = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.target instanceof HTMLButtonElement) return;
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

  const renderPlot = (isExpanded: boolean) => (
    <div
      className="relative h-full select-none rounded-xl border border-border bg-surface-subtle p-2 sm:p-3"
      style={{ touchAction: "pan-y" }}
      onWheel={(event) => {
        if (!canZoom) return;
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        viewport.zoom(
          event.deltaY < 0 ? 1.4 : 1 / 1.4,
          (event.clientX - rect.left) / Math.max(rect.width, 1),
        );
      }}
      onPointerDown={(event) => {
        if (!viewport.visibleDomain) return;
        if (event.pointerType === "touch") {
          touchPointsRef.current.set(event.pointerId, event.clientX);
          if (touchPointsRef.current.size === 2) {
            const [first, second] = [...touchPointsRef.current.values()];
            const rect = event.currentTarget.getBoundingClientRect();
            pinchRef.current = {
              distance: Math.max(Math.abs(second - first), 1),
              anchor:
                ((first + second) / 2 - rect.left) / Math.max(rect.width, 1),
              domainStart: viewport.visibleDomain.start,
              domainEnd: viewport.visibleDomain.end,
            };
          }
          return;
        }
        const target = event.target as HTMLElement;
        if (target.closest("button")) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        pointerRef.current = {
          id: event.pointerId,
          x: event.clientX,
          domainStart: viewport.visibleDomain.start,
          domainEnd: viewport.visibleDomain.end,
        };
      }}
      onPointerMove={(event) => {
        if (event.pointerType === "touch") {
          touchPointsRef.current.set(event.pointerId, event.clientX);
          const pinch = pinchRef.current;
          if (!pinch || touchPointsRef.current.size !== 2) return;
          const [first, second] = [...touchPointsRef.current.values()];
          const distance = Math.max(Math.abs(second - first), 1);
          const scale = distance / pinch.distance;
          const span = (pinch.domainEnd - pinch.domainStart) / scale;
          const anchor = Math.min(Math.max(pinch.anchor, 0), 1);
          const anchorValue =
            pinch.domainStart + (pinch.domainEnd - pinch.domainStart) * anchor;
          viewport.selectDomain({
            start: anchorValue - span * anchor,
            end: anchorValue + span * (1 - anchor),
          });
          return;
        }
        const drag = pointerRef.current;
        if (!drag || drag.id !== event.pointerId || !viewport.fullDomain)
          return;
        const rect = event.currentTarget.getBoundingClientRect();
        const fraction = (drag.x - event.clientX) / Math.max(rect.width, 1);
        viewport.selectDomain({
          start:
            drag.domainStart + (drag.domainEnd - drag.domainStart) * fraction,
          end: drag.domainEnd + (drag.domainEnd - drag.domainStart) * fraction,
        });
      }}
      onPointerUp={(event) => {
        if (event.pointerType === "touch") {
          touchPointsRef.current.delete(event.pointerId);
          if (touchPointsRef.current.size < 2) pinchRef.current = null;
        }
        if (pointerRef.current?.id === event.pointerId)
          pointerRef.current = null;
      }}
      onPointerCancel={() => {
        pointerRef.current = null;
        touchPointsRef.current.clear();
        pinchRef.current = null;
      }}
    >
      {allSeriesHidden ? (
        <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface-subtle/40 p-6 text-center text-sm text-muted">
          <p className="m-0">All chart series are hidden.</p>
          <button
            type="button"
            onClick={viewport.showAllSeries}
            className="mt-3 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            Show all series
          </button>
        </div>
      ) : (
        <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_116px] gap-2 sm:grid-rows-[minmax(0,1fr)_128px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              syncId="demo-equity-inspection"
              data={visibleData}
              margin={{ top: 18, right: 26, left: 10, bottom: 4 }}
              onMouseMove={(state) => {
                const payload = state as unknown as {
                  activePayload?: Array<{ payload?: EquityChartPoint }>;
                };
                const timestamp =
                  payload.activePayload?.[0]?.payload?.timestampValue;
                if (typeof timestamp === "number")
                  viewport.setActiveTimestamp(timestamp);
              }}
              onMouseLeave={() => viewport.setActiveTimestamp(null)}
              onClick={(state) => {
                const payload = state as unknown as {
                  activePayload?: Array<{ payload?: EquityChartPoint }>;
                };
                const point = payload.activePayload?.[0]?.payload;
                if (point) {
                  onSelectPoint?.({
                    id: point.id,
                    sequence: point.sequence,
                    timestamp: point.timestamp,
                    equity_demo_units: String(point.equity),
                    drawdown_demo_units: String(point.drawdown),
                    synthetic: true,
                    unit: "DEMO_UNITS",
                    financial_pnl_available: false,
                  });
                }
              }}
            >
              <defs>
                <linearGradient
                  id={`equityGrad-${isExpanded ? "expanded" : "inline"}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#8c52ff" stopOpacity={0.32} />
                  <stop offset="95%" stopColor="#8c52ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="2 5"
                stroke="var(--border)"
                opacity={0.42}
                vertical={false}
              />
              <XAxis
                hide
                dataKey="timestampValue"
                type="number"
                scale="time"
                domain={
                  viewport.visibleDomain
                    ? [viewport.visibleDomain.start, viewport.visibleDomain.end]
                    : ["auto", "auto"]
                }
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: "var(--muted)" }}
                tickLine={false}
                axisLine={false}
                domain={["auto", "auto"]}
                width={66}
              />
              <Tooltip content={<EquityTooltip />} />
              {viewport.activeTimestamp !== null && (
                <ReferenceLine
                  x={viewport.activeTimestamp}
                  stroke="var(--border-strong)"
                  strokeDasharray="3 3"
                />
              )}
              {selectedPoint && (
                <ReferenceLine
                  x={selectedPoint.timestampValue}
                  stroke="#8c52ff"
                  strokeWidth={2}
                  label="Selected equity point"
                />
              )}
              {viewport.visibleSeries.includes("equity") && (
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="equity"
                  name={activeUnit === "INR" ? "Equity (₹)" : "Equity (DEMO)"}
                  stroke="#8c52ff"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fillOpacity={1}
                  fill={`url(#equityGrad-${isExpanded ? "expanded" : "inline"})`}
                  isAnimationActive={false}
                  dot={false}
                  activeDot={{
                    r: 5,
                    fill: "#8c52ff",
                    stroke: "var(--surface)",
                    strokeWidth: 3,
                  }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
          <div className="min-h-0 rounded-lg border border-border/70 bg-surface/70 px-1 pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                syncId="demo-equity-inspection"
                data={visibleData}
                margin={{ top: 8, right: 26, left: 10, bottom: 12 }}
              >
                <CartesianGrid
                  strokeDasharray="2 5"
                  stroke="var(--border)"
                  opacity={0.36}
                  vertical={false}
                />
                <XAxis
                  dataKey="timestampValue"
                  type="number"
                  scale="time"
                  domain={
                    viewport.visibleDomain
                      ? [
                          viewport.visibleDomain.start,
                          viewport.visibleDomain.end,
                        ]
                      : ["auto", "auto"]
                  }
                  tickFormatter={(value) =>
                    formatAxisTimestamp(value, chartData)
                  }
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={56}
                />
                <YAxis
                  orientation="right"
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  tickLine={false}
                  axisLine={false}
                  domain={["auto", "auto"]}
                  width={66}
                />
                <ReferenceLine
                  y={0}
                  stroke="var(--border)"
                  strokeDasharray="3 4"
                />
                {viewport.visibleSeries.includes("drawdown") && (
                  <Line
                    type="monotone"
                    dataKey="drawdown"
                    name={
                      activeUnit === "INR" ? "Drawdown (₹)" : "Drawdown (DEMO)"
                    }
                    stroke="#ef746c"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    isAnimationActive={false}
                    dot={false}
                    activeDot={{
                      r: 4,
                      fill: "#ef746c",
                      stroke: "var(--surface)",
                      strokeWidth: 2,
                    }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );

  const renderFrame = (isExpanded: boolean) => (
    <ChartFrame
      title="Equity & Drawdown Curve"
      description={
        activeUnit === "INR"
          ? "Estimated historical INR outcomes from option candle closes and configured slippage · Scroll over the plot or use + / − to zoom; drag to pan and Reset to return to the full range."
          : "DEMO_UNITS · Synthetic evaluation values · Scroll over the plot or use + / − to zoom; drag to pan and Reset to return to the full range."
      }
      view={view}
      insight={
        <div className="grid grid-cols-3 divide-x divide-border overflow-hidden rounded-xl border border-border bg-surface text-xs shadow-sm">
          <div className="min-w-0 px-3 py-2">
            <p className="m-0 text-[10px] font-bold uppercase tracking-wide text-muted">
              Visible
            </p>
            <p className="m-0 mt-0.5 font-mono font-semibold text-foreground">
              {visibleData.length}{" "}
              <span className="font-sans text-[10px] font-medium text-muted">
                of {chartData.length} points
              </span>
            </p>
          </div>
          <div className="min-w-0 px-3 py-2">
            <p className="m-0 text-[10px] font-bold uppercase tracking-wide text-muted">
              Latest equity
            </p>
            <p className="m-0 mt-0.5 truncate font-mono font-semibold text-brand">
              {latestPoint
                ? formatDemoValue(latestPoint.equity, activeUnit)
                : "—"}
            </p>
          </div>
          <div className="min-w-0 px-3 py-2">
            <p className="m-0 text-[10px] font-bold uppercase tracking-wide text-muted">
              Lowest drawdown
            </p>
            <p className="m-0 mt-0.5 truncate font-mono font-semibold text-danger">
              {lowestDrawdown === null
                ? "—"
                : formatDemoValue(lowestDrawdown, activeUnit)}
            </p>
          </div>
        </div>
      }
      controls={
        <ChartToolbar
          canZoom={canZoom}
          view={view}
          onZoomIn={() => viewport.zoom(1.8)}
          onZoomOut={() => viewport.zoom(1 / 1.8)}
          onReset={viewport.reset}
          onExpand={() => setExpanded(true)}
          onViewChange={setView}
        />
      }
      legend={
        <ChartLegend
          series={activeSeries}
          visibleSeries={viewport.visibleSeries}
          onToggle={viewport.toggleSeries}
        />
      }
      chart={renderPlot(isExpanded)}
      table={
        <EquityDataTable
          items={visibleData}
          unit={activeUnit}
          selectedPointId={selectedPointId}
          onSelectPoint={(point) =>
            onSelectPoint?.({
              id: point.id,
              sequence: point.sequence,
              timestamp: point.timestamp,
              equity_demo_units: String(point.equity),
              drawdown_demo_units: String(point.drawdown),
              synthetic: activeUnit !== "INR",
              unit: activeUnit,
              financial_pnl_available: activeUnit === "INR",
            })
          }
        />
      }
      onKeyDown={handleKeyboard}
      status={(() => {
        if (!viewport.visibleDomain) return "No visible chart data.";
        const activePoint = chartData.find(
          (item) => item.timestampValue === viewport.activeTimestamp,
        );
        const activeSummary = activePoint
          ? ` Active point ${formatOriginalTimestamp(activePoint.timestamp)}: equity ${formatDemoValue(activePoint.equity, activeUnit)}, drawdown ${formatDemoValue(activePoint.drawdown, activeUnit)}.`
          : "";
        return `Visible range ${formatAxisTimestamp(viewport.visibleDomain.start, chartData)} to ${formatAxisTimestamp(viewport.visibleDomain.end, chartData)}. ${visibleData.length} loaded points.${activeSummary}`;
      })()}
      isExpanded={isExpanded}
    />
  );

  return (
    <>
      {renderFrame(false)}
      <ChartExpandedDialog
        isOpen={expanded}
        onClose={() => setExpanded(false)}
        title="Equity & Drawdown Curve"
      >
        {renderFrame(true)}
      </ChartExpandedDialog>
    </>
  );
}
