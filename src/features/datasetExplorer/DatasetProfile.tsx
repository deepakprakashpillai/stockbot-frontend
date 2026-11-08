import type { DatasetProfile as DatasetProfileData } from "../../api/datasets";

export function DatasetProfile({ profile }: { profile?: DatasetProfileData }) {
  if (!profile) return null;
  const columns = (profile.profile.columns ?? []) as Array<{
    name: string;
    type: string;
    non_empty_count: number;
    minimum?: string | null;
    maximum?: string | null;
  }>;
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="m-0 text-sm font-semibold text-foreground">
        Immutable profile
      </h2>
      <p className="m-0 mt-1 text-xs text-muted">
        {profile.schema_profile} · validated coverage{" "}
        {profile.coverage_start?.slice(0, 10)} to{" "}
        {profile.coverage_end?.slice(0, 10)}
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-xs">
          <thead className="text-muted">
            <tr>
              <th className="p-2">Column</th>
              <th className="p-2">Type</th>
              <th className="p-2">Present</th>
              <th className="p-2">Observed range</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((column) => (
              <tr key={column.name} className="border-t border-border">
                <td className="p-2 font-mono text-foreground">{column.name}</td>
                <td className="p-2 text-muted">{column.type}</td>
                <td className="p-2 tabular-nums text-foreground">
                  {column.non_empty_count}
                </td>
                <td className="p-2 font-mono text-muted">
                  {column.minimum ?? "—"} → {column.maximum ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {Object.entries(profile.capabilities).map(([name, enabled]) => (
          <span
            key={name}
            className={`rounded-full px-2 py-1 text-[10px] font-bold ${enabled ? "bg-success/10 text-success" : "bg-surface-subtle text-muted"}`}
          >
            {name.replaceAll("_", " ")} ·{" "}
            {enabled ? "available" : "unavailable"}
          </span>
        ))}
      </div>
    </section>
  );
}
