import { Maximize2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

import type { ChartView } from "./chartTypes";

type ChartToolbarProps = {
  canZoom: boolean;
  view: ChartView;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onExpand: () => void;
  onViewChange: (view: ChartView) => void;
};

function ToolButton({
  label,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-transparent bg-transparent px-2 text-muted transition-all hover:border-border hover:bg-surface hover:text-foreground hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-45"
    >
      {children}
    </button>
  );
}

export function ChartToolbar({
  canZoom,
  view,
  onZoomIn,
  onZoomOut,
  onReset,
  onExpand,
  onViewChange,
}: ChartToolbarProps) {
  return (
    <div
      className="flex flex-wrap items-center justify-end gap-0.5"
      aria-label="Chart controls"
    >
      <div
        className="mr-1 inline-flex rounded-lg border border-border bg-surface-subtle p-0.5"
        role="group"
        aria-label="Chart view"
      >
        <button
          type="button"
          aria-pressed={view === "chart"}
          onClick={() => onViewChange("chart")}
          className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${view === "chart" ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
        >
          Chart
        </button>
        <button
          type="button"
          aria-pressed={view === "table"}
          onClick={() => onViewChange("table")}
          className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${view === "table" ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
        >
          Table
        </button>
      </div>
      <ToolButton label="Zoom in" disabled={!canZoom} onClick={onZoomIn}>
        <ZoomIn size={15} aria-hidden="true" />
      </ToolButton>
      <ToolButton label="Zoom out" disabled={!canZoom} onClick={onZoomOut}>
        <ZoomOut size={15} aria-hidden="true" />
      </ToolButton>
      <ToolButton
        label="Reset chart view"
        disabled={!canZoom}
        onClick={onReset}
      >
        <RotateCcw size={14} aria-hidden="true" />
      </ToolButton>
      <ToolButton label="Expand chart" onClick={onExpand}>
        <Maximize2 size={15} aria-hidden="true" />
      </ToolButton>
    </div>
  );
}
