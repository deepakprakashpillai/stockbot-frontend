import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import { Slideover } from "../../components/Slideover";
import { AlgorithmCompatibility } from "./AlgorithmCompatibility";
import { AlgorithmLogicFlow } from "./AlgorithmLogicFlow";
import { AlgorithmOverview } from "./AlgorithmOverview";
import { AlgorithmParameterReference } from "./AlgorithmParameterReference";
import {
  inspectorState,
  inspectorTabs,
} from "./algorithmInspectorSearchParams";
import { AlgorithmUsage } from "./AlgorithmUsage";
import { AlgorithmVersionBrowser } from "./AlgorithmVersionBrowser";
import { algorithmInspectorQueries } from "./queries";

export function AlgorithmDetailModal({
  algorithmKey,
}: {
  algorithmKey?: string;
}) {
  const [params, setParams] = useSearchParams();
  const state = inspectorState(params);
  const key = algorithmKey ?? params.get("algorithm") ?? "";
  const detail = useQuery({
    ...algorithmInspectorQueries.detail(key),
    enabled: Boolean(key && state.open),
  });
  const versions = useQuery({
    ...algorithmInspectorQueries.versions(key),
    enabled: Boolean(key && state.open),
  });
  const selectedVersionId =
    state.leftVersionId ?? versions.data?.items.at(-1)?.id;
  const usage = useQuery({
    ...algorithmInspectorQueries.usage(selectedVersionId ?? ""),
    enabled: state.tab === "usage" && Boolean(selectedVersionId),
  });
  const update = (change: Record<string, string | undefined>) =>
    setParams((current) => {
      current.set("algorithm", key);
      current.set("algorithmInspector", "1");
      Object.entries(change).forEach(([name, value]) =>
        value ? current.set(name, value) : current.delete(name),
      );
      return current;
    });
  const close = () =>
    setParams((current) => {
      current.delete("algorithmInspector");
      current.delete("algorithmTab");
      current.delete("compareVersion");
      current.delete("compatibilityDataset");
      return current;
    });
  const tab = state.tab;
  return (
    <Slideover
      isOpen={state.open && Boolean(key)}
      onClose={close}
      title={
        detail.data
          ? `${detail.data.display_name} inspector`
          : "Algorithm inspector"
      }
      size="wide"
    >
      <div className="space-y-5">
        {detail.isLoading && (
          <p className="text-sm text-muted">Loading algorithm details…</p>
        )}
        {detail.data && (
          <>
            <nav
              className="-mx-1 flex gap-1 overflow-x-auto border-b border-border"
              aria-label="Algorithm inspector tabs"
            >
              {inspectorTabs.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={tab === item}
                  onClick={() => update({ algorithmTab: item })}
                  className={`shrink-0 border-b-2 px-3 py-2 text-xs font-bold capitalize ${tab === item ? "border-brand text-brand" : "border-transparent text-muted"}`}
                >
                  {item}
                </button>
              ))}
            </nav>
            {tab === "overview" && (
              <AlgorithmOverview algorithm={detail.data} />
            )}
            {tab === "logic" && <AlgorithmLogicFlow algorithm={detail.data} />}
            {tab === "parameters" && (
              <AlgorithmParameterReference algorithm={detail.data} />
            )}
            {tab === "versions" && (
              <AlgorithmVersionBrowser
                versions={versions.data?.items ?? []}
                leftId={state.leftVersionId}
                rightId={state.rightVersionId}
                onSelect={(side, id) =>
                  update({
                    [side === "left" ? "algorithmVersion" : "compareVersion"]:
                      id || undefined,
                  })
                }
                onClone={(id) =>
                  update({ algorithmVersion: id, newVersion: "1" })
                }
              />
            )}
            {tab === "compatibility" && (
              <AlgorithmCompatibility
                algorithmKey={key}
                datasetVersionId={state.datasetVersionId}
                onDataset={(id) =>
                  update({ compatibilityDataset: id || undefined })
                }
              />
            )}
            {tab === "usage" && <AlgorithmUsage usage={usage.data} />}
          </>
        )}
      </div>
    </Slideover>
  );
}
