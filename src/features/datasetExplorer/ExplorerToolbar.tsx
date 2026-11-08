import type { ExplorerGranularity } from "./explorerSearchParams";
import { AppSelect } from "../../components/ui/app-select";

export function ExplorerToolbar({
  state,
  onChange,
}: {
  state: {
    start?: string;
    end?: string;
    granularity: ExplorerGranularity;
    view: "chart" | "table";
  };
  onChange: (
    change: Partial<{
      start: string;
      end: string;
      granularity: ExplorerGranularity;
      view: "chart" | "table";
    }>,
  ) => void;
}) {
  return (
    <section className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4">
      <label className="text-xs text-muted">
        Start
        <input
          type="date"
          value={state.start ?? ""}
          onChange={(event) => onChange({ start: event.target.value })}
          className="mt-1 block rounded border border-border bg-surface px-2 py-1.5 text-foreground"
        />
      </label>
      <label className="text-xs text-muted">
        End
        <input
          type="date"
          value={state.end ?? ""}
          onChange={(event) => onChange({ end: event.target.value })}
          className="mt-1 block rounded border border-border bg-surface px-2 py-1.5 text-foreground"
        />
      </label>
      <label className="text-xs text-muted">
        Granularity
        <AppSelect
          value={state.granularity}
          onValueChange={(value) =>
            onChange({ granularity: value as ExplorerGranularity })
          }
          options={(["5m", "15m", "30m", "1h", "1d"] as const).map((value) => ({
            value,
            label: value,
          }))}
          placeholder="Choose granularity…"
          ariaLabel="Granularity"
          className="mt-1 h-9 min-w-24"
        />
      </label>
      <div
        className="ml-auto flex gap-2"
        role="group"
        aria-label="Explorer view"
      >
        <button
          type="button"
          onClick={() => onChange({ view: "chart" })}
          className={`rounded px-3 py-2 text-xs font-bold ${state.view === "chart" ? "bg-brand text-white" : "border border-border text-foreground"}`}
        >
          Chart
        </button>
        <button
          type="button"
          onClick={() => onChange({ view: "table" })}
          className={`rounded px-3 py-2 text-xs font-bold ${state.view === "table" ? "bg-brand text-white" : "border border-border text-foreground"}`}
        >
          Table
        </button>
      </div>
    </section>
  );
}
