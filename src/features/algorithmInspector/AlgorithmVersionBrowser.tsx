import type { AlgorithmVersion } from "../../api/algorithms";
import { AppSelect } from "../../components/ui/app-select";
import { AlgorithmVersionDiff } from "./AlgorithmVersionDiff";

export function AlgorithmVersionBrowser({
  versions,
  leftId,
  rightId,
  onSelect,
  onClone,
}: {
  versions: AlgorithmVersion[];
  leftId?: string;
  rightId?: string;
  onSelect: (side: "left" | "right", id: string) => void;
  onClone: (id: string) => void;
}) {
  const left = versions.find((value) => value.id === leftId);
  const right = versions.find((value) => value.id === rightId);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {(["left", "right"] as const).map((side) => (
          <label key={side} className="text-xs text-muted">
            {side === "left" ? "First version" : "Second version"}
            <AppSelect
              value={(side === "left" ? leftId : rightId) ?? "__no_version__"}
              onValueChange={(value) =>
                onSelect(side, value === "__no_version__" ? "" : value)
              }
              options={[
                { value: "__no_version__", label: "Choose version…" },
                ...versions.map((version) => ({
                  value: version.id,
                  label: `v${version.version_number} · ${version.name}${version.archived ? " (archived)" : ""}`,
                })),
              ]}
              placeholder="Choose version…"
              ariaLabel={side === "left" ? "First version" : "Second version"}
              className="mt-1"
            />
          </label>
        ))}
      </div>
      <AlgorithmVersionDiff left={left} right={right} />
      <div className="space-y-2">
        {versions.map((version) => (
          <div
            key={version.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
          >
            <span>
              <strong>
                v{version.version_number} · {version.name}
              </strong>{" "}
              <span className="text-muted">
                {version.archived ? "Archived" : "Active"} · parent{" "}
                {version.parent_version_id ?? "none"}
              </span>
            </span>
            <button
              type="button"
              onClick={() => onClone(version.id)}
              className="rounded border border-brand/30 px-2 py-1 text-xs font-bold text-brand"
            >
              Clone this version
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
