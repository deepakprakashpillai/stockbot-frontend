import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { CandleChart } from "./CandleChart";
import { CandleTable } from "./CandleTable";
import { DatasetProfile } from "./DatasetProfile";
import { ExplorerToolbar } from "./ExplorerToolbar";
import { explorerState } from "./explorerSearchParams";
import { QualityTimeline } from "./QualityTimeline";
import { datasetExplorerQueries } from "./queries";

export function DatasetExplorerPage() {
  const [params, setParams] = useSearchParams();
  const state = explorerState(params);
  const profile = useQuery({
    ...datasetExplorerQueries.profile(state.versionId ?? ""),
    enabled: Boolean(state.versionId),
  });
  const candles = useQuery({
    ...datasetExplorerQueries.candles({
      versionId: state.versionId ?? "",
      start: state.rangeStart
        ? `${state.rangeStart}T00:00:00+05:30`
        : undefined,
      end: state.rangeEnd ? `${state.rangeEnd}T23:59:59+05:30` : undefined,
      granularity: state.granularity,
      purpose: state.view,
      cursor: state.cursor,
    }),
    enabled: Boolean(state.versionId),
  });
  const update = (change: Record<string, string | undefined>) =>
    setParams((current) => {
      current.set("explorer", "1");
      current.set("tab", "datasets");
      Object.entries(change).forEach(([key, value]) => {
        if (value) current.set(key, value);
        else current.delete(key);
      });
      return current;
    });
  if (!state.versionId)
    return (
      <p className="rounded-xl border border-dashed border-border p-8 text-sm text-muted">
        Choose an immutable dataset version from the Library to open its
        explorer.
      </p>
    );
  return (
    <section className="mx-auto flex w-full max-w-[1800px] flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="m-0 text-[11px] font-bold uppercase tracking-[0.16em] text-brand">
            Dataset explorer
          </p>
          <h1 className="m-0 mt-1 text-2xl font-bold text-foreground">
            Inspect immutable candle evidence
          </h1>
          <p className="m-0 mt-1 text-sm text-muted">
            Server-bounded OHLC data; no client access to source files or
            storage paths.
          </p>
        </div>
        <button
          type="button"
          onClick={() => update({ explorer: undefined })}
          className="rounded border border-border px-3 py-2 text-xs font-bold text-foreground"
        >
          Back to Library
        </button>
      </header>
      <ExplorerToolbar
        state={{
          start: state.rangeStart,
          end: state.rangeEnd,
          granularity: state.granularity,
          view: state.view,
        }}
        onChange={(change) => update(change)}
      />
      {profile.isLoading || candles.isLoading ? (
        <p className="text-sm text-muted">Loading explorer data…</p>
      ) : (
        <>
          <DatasetProfile profile={profile.data} />
          {state.view === "chart" ? (
            <CandleChart data={candles.data} />
          ) : (
            <CandleTable
              data={candles.data}
              onNext={() =>
                update({ cursor: candles.data?.next_cursor ?? undefined })
              }
            />
          )}
          <QualityTimeline
            data={candles.data}
            onMarker={(date) =>
              update({ start: date, end: date, view: "table" })
            }
          />
        </>
      )}
    </section>
  );
}
