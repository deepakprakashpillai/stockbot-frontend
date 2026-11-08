import type { AlgorithmVersion } from "../../api/algorithms";

function flatten(value: unknown, path = ""): Record<string, string> {
  if (value === null || typeof value !== "object")
    return { [path || "value"]: JSON.stringify(value) };
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, child]) =>
      Object.entries(flatten(child, path ? `${path}.${key}` : key)),
    )
    .reduce<Record<string, string>>(
      (result, [key, child]) => ({ ...result, [key]: child }),
      {},
    );
}

export function AlgorithmVersionDiff({
  left,
  right,
}: {
  left?: AlgorithmVersion;
  right?: AlgorithmVersion;
}) {
  if (!left || !right)
    return (
      <p className="text-sm text-muted">
        Select exactly two immutable versions to compare their stored
        parameters.
      </p>
    );
  const first = flatten(left.parameters);
  const second = flatten(right.parameters);
  const keys = [
    ...new Set([...Object.keys(first), ...Object.keys(second)]),
  ].sort();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-left text-xs">
        <thead className="text-muted">
          <tr>
            <th className="p-2">Parameter</th>
            <th className="p-2">v{left.version_number}</th>
            <th className="p-2">v{right.version_number}</th>
            <th className="p-2">Difference</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => {
            const changed = first[key] !== second[key];
            return (
              <tr key={key} className="border-t border-border">
                <td className="p-2 font-mono text-foreground">{key}</td>
                <td className="p-2 font-mono">{first[key] ?? "—"}</td>
                <td className="p-2 font-mono">{second[key] ?? "—"}</td>
                <td
                  className={`p-2 font-semibold ${changed ? "text-warning" : "text-muted"}`}
                >
                  {changed ? "Changed" : "Unchanged"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
