import type { DatasetCandles } from "../../api/datasets";

export function QualityTimeline({
  data,
  onMarker,
}: {
  data?: DatasetCandles;
  onMarker: (date: string) => void;
}) {
  if (!data?.quality_markers.length)
    return (
      <p className="m-0 rounded-xl border border-border bg-surface p-4 text-xs text-muted">
        No gap or atypical-session markers intersect this range.
      </p>
    );
  return (
    <section className="rounded-xl border border-warning/30 bg-warning/5 p-4">
      <h2 className="m-0 text-sm font-semibold text-foreground">
        Quality markers
      </h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {data.quality_markers.map((marker) => {
          const date = String(marker.details?.date ?? "");
          return (
            <button
              key={`${marker.code}-${date}`}
              type="button"
              onClick={() => onMarker(date)}
              className="rounded-lg border border-warning/30 px-3 py-2 text-left text-xs text-foreground"
            >
              <strong>{marker.code.replaceAll("_", " ")}</strong>
              <br />
              {date || marker.message}
            </button>
          );
        })}
      </div>
    </section>
  );
}
