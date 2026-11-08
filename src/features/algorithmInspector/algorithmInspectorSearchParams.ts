export const inspectorTabs = [
  "overview",
  "logic",
  "parameters",
  "versions",
  "compatibility",
  "usage",
] as const;
export type InspectorTab = (typeof inspectorTabs)[number];

export function inspectorState(params: URLSearchParams) {
  const requested = params.get("algorithmTab");
  return {
    open: params.get("algorithmInspector") === "1",
    tab: inspectorTabs.includes(requested as InspectorTab)
      ? (requested as InspectorTab)
      : "overview",
    leftVersionId: params.get("algorithmVersion") ?? undefined,
    rightVersionId: params.get("compareVersion") ?? undefined,
    datasetVersionId: params.get("compatibilityDataset") ?? undefined,
  };
}
