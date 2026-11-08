import type { DatasetCandles } from "../../api/datasets";

export function CandleTable({
  data,
  onNext,
}: {
  data?: DatasetCandles;
  onNext: () => void;
}) {
  const canShowActivity = Boolean(
    data?.capabilities.volume_data || data?.capabilities.open_interest_data,
  );
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <h2 className="m-0 text-sm font-semibold text-foreground">
            Raw candles
          </h2>
          <p className="m-0 text-xs text-muted">
            Exact stored decimal values for the selected bounded page.
          </p>
        </div>
        {data?.next_cursor && (
          <button
            type="button"
            onClick={onNext}
            className="rounded border border-border px-3 py-2 text-xs font-bold text-foreground"
          >
            Next page
          </button>
        )}
      </div>
      <div className="max-h-[440px] overflow-auto">
        <table className="w-full min-w-[780px] text-left text-xs">
          <thead className="sticky top-0 bg-surface-subtle text-muted">
            <tr>
              {[
                "Time",
                "Open",
                "High",
                "Low",
                "Close",
                ...(canShowActivity ? ["Volume", "OI"] : []),
              ].map((name) => (
                <th key={name} className="p-3">
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.candles.map((candle) => (
              <tr key={candle.timestamp} className="border-t border-border">
                <td className="p-3 font-mono text-foreground">
                  {candle.timestamp}
                </td>
                <td className="p-3">{candle.open}</td>
                <td className="p-3">{candle.high}</td>
                <td className="p-3">{candle.low}</td>
                <td className="p-3">{candle.close}</td>
                {canShowActivity && (
                  <>
                    <td className="p-3">{candle.volume}</td>
                    <td className="p-3">{candle.open_interest}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
