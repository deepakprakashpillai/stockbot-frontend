import { useQuery } from "@tanstack/react-query";

import { getDatasetCandles } from "../../../api/datasets";
import type {
  DemoTrade,
  LiveRunSnapshot,
  SignalEvaluation,
} from "../../../api/backtests";
import { CandleChart } from "../../datasetExplorer/CandleChart";

export function LiveRunContext({
  datasetVersionId,
  snapshot,
  signals,
  trades,
  onSelectSignal,
  onSelectTrade,
}: {
  datasetVersionId?: string;
  snapshot?: LiveRunSnapshot;
  signals: SignalEvaluation[];
  trades: DemoTrade[];
  onSelectSignal?: (id: string) => void;
  onSelectTrade?: (id: string) => void;
}) {
  const latestTimestamp =
    snapshot?.last_processed_candle_at ||
    (signals.length ? signals[signals.length - 1]?.timestamp : undefined);

  const candles = useQuery({
    queryKey: ["live-run-candles", datasetVersionId, latestTimestamp],
    queryFn: () =>
      getDatasetCandles({
        versionId: datasetVersionId!,
        start: latestTimestamp
          ? new Date(
              new Date(latestTimestamp).getTime() - 160 * 5 * 60 * 1000,
            ).toISOString()
          : undefined,
        end: latestTimestamp ?? undefined,
        purpose: "chart",
        limit: 160,
      }),
    enabled: Boolean(datasetVersionId && latestTimestamp),
  });

  return (
    <section className="rounded-xl border border-border bg-surface/70 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="m-0 text-sm font-semibold text-foreground">
            Candle context
          </h3>
          <p className="m-0 text-xs text-muted">
            Immutable dataset evidence through the latest durable checkpoint.
            Markers below are persisted records, never predictions.
          </p>
        </div>
        {latestTimestamp && (
          <span className="font-mono text-[11px] text-muted">
            through {latestTimestamp.slice(0, 16)}
          </span>
        )}
      </div>
      <div className="mt-3 min-h-56">
        {candles.isError ? (
          <p className="text-sm text-muted">
            Candle context is temporarily unavailable; durable run activity
            remains available below.
          </p>
        ) : candles.data && candles.data.candles.length > 0 ? (
          <CandleChart data={candles.data} />
        ) : candles.isLoading ? (
          <p className="text-sm text-muted">Loading candle context…</p>
        ) : (
          <p className="text-sm text-muted">
            Waiting for the first durable candle checkpoint…
          </p>
        )}
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <div className="rounded-lg bg-surface-subtle/60 p-3 text-xs">
          <span className="font-bold text-foreground">Signals</span>
          <ul className="mb-0 mt-2 space-y-1 text-muted">
            {signals
              .slice(-5)
              .reverse()
              .map((signal) => (
                <li key={signal.id}>
                  <button
                    type="button"
                    onClick={() => onSelectSignal?.(signal.id)}
                    className="text-left underline decoration-transparent underline-offset-2 hover:decoration-brand focus-visible:decoration-brand"
                  >
                    #{signal.sequence} ·{" "}
                    {signal.decision === "ACCEPTED"
                      ? "Accepted"
                      : (signal.rejection_reason ?? "Rejected")}{" "}
                    · {signal.timestamp.slice(0, 16)}
                  </button>
                </li>
              ))}
            {!signals.length && (
              <li>No persisted signal markers in this view.</li>
            )}
          </ul>
        </div>
        <div className="rounded-lg bg-surface-subtle/60 p-3 text-xs">
          <span className="font-bold text-foreground">Completed trades</span>
          <ul className="mb-0 mt-2 space-y-1 text-muted">
            {trades
              .slice(-5)
              .reverse()
              .map((trade) => (
                <li key={trade.id}>
                  <button
                    type="button"
                    onClick={() => onSelectTrade?.(trade.id)}
                    className="text-left underline decoration-transparent underline-offset-2 hover:decoration-brand focus-visible:decoration-brand"
                  >
                    #{trade.sequence} · {trade.entry_timestamp.slice(0, 16)} →{" "}
                    {trade.exit_timestamp.slice(0, 16)}
                  </button>
                </li>
              ))}
            {!trades.length && (
              <li>No persisted completed trade markers in this view.</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
