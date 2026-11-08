import { useEffect, useMemo, useRef, useState } from "react";

import type { DatasetCandles } from "../../api/datasets";
import { ChartFrame } from "../../components/charts/ChartFrame";
import type { ChartView } from "../../components/charts/chartTypes";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { formatNumber } from "../../lib/formatters";

type CandlePoint = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
  index: number;
};

function CandlestickSvgChart({ points }: { points: CandlePoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 360 });
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { minPrice, priceRange } = useMemo(() => {
    if (!points.length) return { minPrice: 0, priceRange: 100 };
    let min = Infinity;
    let max = -Infinity;
    for (const p of points) {
      if (p.low < min) min = p.low;
      if (p.high > max) max = p.high;
    }
    if (min === max) {
      min -= 1;
      max += 1;
    }
    // Add 4% padding top and bottom
    const range = max - min;
    const pad = range * 0.04;
    return {
      minPrice: min - pad,
      maxPrice: max + pad,
      priceRange: range + pad * 2,
    };
  }, [points]);

  const padding = { top: 16, right: 65, bottom: 28, left: 10 };
  const plotWidth = Math.max(
    10,
    dimensions.width - padding.left - padding.right,
  );
  const plotHeight = Math.max(
    10,
    dimensions.height - padding.top - padding.bottom,
  );

  const getY = (price: number) => {
    if (priceRange <= 0) return padding.top + plotHeight / 2;
    return padding.top + plotHeight * (1 - (price - minPrice) / priceRange);
  };

  const candleStep = points.length > 0 ? plotWidth / points.length : 0;
  const candleWidth = Math.max(2, Math.min(18, candleStep * 0.72));

  // Generate 5 grid price lines
  const gridLevels = 5;
  const priceGrid = useMemo(() => {
    const lines = [];
    for (let i = 0; i <= gridLevels; i++) {
      const price = minPrice + (priceRange * i) / gridLevels;
      lines.push(price);
    }
    return lines;
  }, [minPrice, priceRange]);

  // Generate time labels
  const timeLabels = useMemo(() => {
    if (!points.length) return [];
    const count = Math.min(6, points.length);
    const step = Math.max(1, Math.floor(points.length / count));
    const labels = [];
    for (let i = 0; i < points.length; i += step) {
      labels.push({ index: i, point: points[i] });
    }
    return labels;
  }, [points]);

  const hoveredPoint =
    hoverIndex !== null && hoverIndex >= 0 && hoverIndex < points.length
      ? points[hoverIndex]
      : null;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current || !points.length) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - padding.left;
    if (mouseX < 0 || mouseX > plotWidth) {
      setHoverIndex(null);
      return;
    }
    const idx = Math.min(
      points.length - 1,
      Math.max(0, Math.floor(mouseX / candleStep)),
    );
    setHoverIndex(idx);
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full select-none"
      role="img"
      aria-label="OHLC candlestick chart"
    >
      <svg
        width={dimensions.width}
        height={dimensions.height}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="overflow-visible"
      >
        {/* Background Grid Lines & Price Labels */}
        {priceGrid.map((price, idx) => {
          const y = getY(price);
          return (
            <g key={idx}>
              <line
                x1={padding.left}
                y1={y}
                x2={padding.left + plotWidth}
                y2={y}
                stroke="var(--color-border)"
                strokeDasharray="3 3"
                strokeOpacity={0.6}
              />
              <text
                x={padding.left + plotWidth + 8}
                y={y + 4}
                fill="var(--color-muted-foreground)"
                fontSize={10}
                fontFamily="monospace"
              >
                {formatNumber(price)}
              </text>
            </g>
          );
        })}

        {/* Time X-Axis Labels */}
        {timeLabels.map(({ index, point }) => {
          const x = padding.left + index * candleStep + candleStep / 2;
          const timeStr =
            point.timestamp.length >= 16
              ? point.timestamp.slice(11, 16)
              : point.timestamp;
          return (
            <g key={point.timestamp}>
              <line
                x1={x}
                y1={padding.top + plotHeight}
                x2={x}
                y2={padding.top + plotHeight + 4}
                stroke="var(--color-border)"
              />
              <text
                x={x}
                y={padding.top + plotHeight + 16}
                textAnchor="middle"
                fill="var(--color-muted-foreground)"
                fontSize={10}
                fontFamily="monospace"
              >
                {timeStr}
              </text>
            </g>
          );
        })}

        {/* Candlesticks */}
        {points.map((pt, idx) => {
          const x = padding.left + idx * candleStep + candleStep / 2;
          const isUp = pt.close >= pt.open;
          const color = isUp
            ? "var(--color-success)"
            : "var(--color-destructive)";

          const wickY1 = getY(pt.high);
          const wickY2 = getY(pt.low);

          const openY = getY(pt.open);
          const closeY = getY(pt.close);

          const bodyTop = Math.min(openY, closeY);
          const bodyHeight = Math.max(1.5, Math.abs(openY - closeY));

          return (
            <g key={pt.timestamp} className="transition-opacity duration-150">
              {/* Wick Line */}
              <line
                x1={x}
                y1={wickY1}
                x2={x}
                y2={wickY2}
                stroke={color}
                strokeWidth={1.5}
              />
              {/* Candle Body */}
              <rect
                x={x - candleWidth / 2}
                y={bodyTop}
                width={candleWidth}
                height={bodyHeight}
                fill={color}
                stroke={color}
                strokeWidth={1}
                rx={1}
              />
            </g>
          );
        })}

        {/* Hover Crosshair */}
        {hoveredPoint && hoverIndex !== null && (
          <g>
            <line
              x1={padding.left + hoverIndex * candleStep + candleStep / 2}
              y1={padding.top}
              x2={padding.left + hoverIndex * candleStep + candleStep / 2}
              y2={padding.top + plotHeight}
              stroke="var(--color-brand)"
              strokeDasharray="2 2"
              strokeWidth={1}
            />
            <line
              x1={padding.left}
              y1={getY(hoveredPoint.close)}
              x2={padding.left + plotWidth}
              y2={getY(hoveredPoint.close)}
              stroke="var(--color-brand)"
              strokeDasharray="2 2"
              strokeWidth={1}
            />
            <circle
              cx={padding.left + hoverIndex * candleStep + candleStep / 2}
              cy={getY(hoveredPoint.close)}
              r={3.5}
              fill="var(--color-brand)"
              stroke="var(--color-surface)"
              strokeWidth={1.5}
            />
          </g>
        )}
      </svg>

      {/* Floating Hover Tooltip */}
      {hoveredPoint && hoverIndex !== null && (
        <div
          className="pointer-events-none absolute z-30 rounded-lg border border-border bg-surface/95 p-2.5 text-xs shadow-lg backdrop-blur"
          style={{
            left: Math.min(
              dimensions.width - 170,
              Math.max(10, padding.left + hoverIndex * candleStep - 70),
            ),
            top: 10,
          }}
        >
          <div className="font-mono text-[11px] font-bold text-foreground">
            {hoveredPoint.timestamp}
          </div>
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[11px]">
            <span className="text-muted-foreground">Open:</span>
            <span className="text-right text-foreground font-semibold">
              {formatNumber(hoveredPoint.open)}
            </span>
            <span className="text-muted-foreground">High:</span>
            <span className="text-right text-foreground font-semibold">
              {formatNumber(hoveredPoint.high)}
            </span>
            <span className="text-muted-foreground">Low:</span>
            <span className="text-right text-foreground font-semibold">
              {formatNumber(hoveredPoint.low)}
            </span>
            <span className="text-muted-foreground">Close:</span>
            <span className="text-right text-foreground font-semibold">
              {formatNumber(hoveredPoint.close)}
            </span>
          </div>
          <div className="mt-1 border-t border-border pt-1 font-mono text-[11px]">
            <span
              className={`font-bold ${
                hoveredPoint.close >= hoveredPoint.open
                  ? "text-success"
                  : "text-destructive"
              }`}
            >
              {hoveredPoint.close >= hoveredPoint.open ? "+" : ""}
              {formatNumber(hoveredPoint.close - hoveredPoint.open)} (
              {hoveredPoint.open !== 0
                ? (
                    ((hoveredPoint.close - hoveredPoint.open) /
                      hoveredPoint.open) *
                    100
                  ).toFixed(2)
                : "0.00"}
              %)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function CandleChart({ data }: { data?: DatasetCandles }) {
  const [view, setView] = useState<ChartView>("chart");

  const points: CandlePoint[] = useMemo(() => {
    return (data?.candles ?? []).map((candle, index) => ({
      ...candle,
      index,
      open: Number(candle.open),
      high: Number(candle.high),
      low: Number(candle.low),
      close: Number(candle.close),
      volume: candle.volume != null ? Number(candle.volume) : null,
    }));
  }, [data]);

  const chart = <CandlestickSvgChart points={points} />;

  const table = (
    <div className="h-full overflow-auto rounded-lg border border-border bg-surface">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-44">Timestamp</TableHead>
            <TableHead className="text-right">Open</TableHead>
            <TableHead className="text-right">High</TableHead>
            <TableHead className="text-right">Low</TableHead>
            <TableHead className="text-right">Close</TableHead>
            <TableHead className="text-right">Change</TableHead>
            {points.some((p) => p.volume != null) && (
              <TableHead className="text-right">Volume</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {points.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                No candle data available.
              </TableCell>
            </TableRow>
          ) : (
            points.map((pt) => {
              const diff = pt.close - pt.open;
              const pct = pt.open !== 0 ? (diff / pt.open) * 100 : 0;
              const isUp = diff >= 0;
              return (
                <TableRow key={pt.timestamp}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {pt.timestamp}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatNumber(pt.open)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatNumber(pt.high)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatNumber(pt.low)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold text-foreground">
                    {formatNumber(pt.close)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono text-xs font-semibold ${
                      isUp ? "text-success" : "text-destructive"
                    }`}
                  >
                    {isUp ? "+" : ""}
                    {formatNumber(diff)} ({isUp ? "+" : ""}
                    {pct.toFixed(2)}%)
                  </TableCell>
                  {points.some((p) => p.volume != null) && (
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {pt.volume != null ? formatNumber(pt.volume) : "—"}
                    </TableCell>
                  )}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <ChartFrame
      title="OHLC candles"
      description={`${data?.granularity ?? "5m"} aggregation · open/close body plus high/low wick`}
      controls={
        <div
          className="inline-flex rounded-lg border border-border bg-surface-subtle p-0.5"
          role="group"
          aria-label="Chart view"
        >
          <button
            type="button"
            aria-pressed={view === "chart"}
            onClick={() => setView("chart")}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
              view === "chart"
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Candlestick
          </button>
          <button
            type="button"
            aria-pressed={view === "table"}
            onClick={() => setView("table")}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
              view === "table"
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            OHLC Table
          </button>
        </div>
      }
      legend={
        <span className="text-xs text-muted-foreground">
          Green: close ≥ open · red: close &lt; open
        </span>
      }
      view={view}
      chart={chart}
      table={table}
      onKeyDown={() => undefined}
      status={`${points.length} candles loaded`}
    />
  );
}
