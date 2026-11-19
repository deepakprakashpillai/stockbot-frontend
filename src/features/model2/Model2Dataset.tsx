import { Link } from "react-router-dom";
import { humanize } from "./presentation";
import { useQuery } from "@tanstack/react-query";
import { getModel2Manifest } from "../../api/model2";
import { ResearchError } from "./ResearchGroupView";

export function Model2Dataset({ versionId }: { versionId: string }) {
  const manifest = useQuery({
    queryKey: ["model2-manifest", versionId],
    queryFn: () => getModel2Manifest(versionId),
  });
  return (
    <section className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <Link className="text-sm text-brand underline" to="/library?tab=datasets">
        Back to Library
      </Link>
      <h1 className="text-2xl font-semibold">Model 2 market-data bundle</h1>
      <ResearchError error={manifest.error} />
      {manifest.data ? (
        <>
          <p className="text-sm text-muted-foreground">
            Preserved spot, VIX, option prices, contract metadata and an expiry
            calendar. Futures are optional. Cycle-level entry readiness is
            checked in Studio.
          </p>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Calendar</dt>
              <dd>{manifest.data.calendar_version}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                Official settlement source
              </dt>
              <dd>
                {manifest.data.official_settlement_available
                  ? "Available; individual expiry coverage still applies"
                  : "Absent"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Halt evidence</dt>
              <dd>
                {manifest.data.halt_source_available ? "Available" : "Absent"}
              </dd>
            </div>
          </dl>
          <ul className="space-y-2 text-sm">
            {manifest.data.limitations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="p-2">Component</th>
                  <th className="p-2">Rows</th>
                  <th className="p-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {manifest.data.components.map((item, index) => (
                  <tr key={index} className="border-t border-border">
                    <td className="p-2">{humanize(item.kind)}</td>
                    <td className="p-2">{String(item.row_count ?? "—")}</td>
                    <td className="p-2 break-all">
                      {String(item.source_reference ?? "Preserved component")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer">
              Source identities and complete manifest
            </summary>
            <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-all text-xs">
              {JSON.stringify(manifest.data, null, 2)}
            </pre>
          </details>
        </>
      ) : (
        <p role="status">Loading bundle evidence…</p>
      )}
    </section>
  );
}
