export type ExplorerGranularity = "5m" | "15m" | "30m" | "1h" | "1d";

export function explorerState(params: URLSearchParams) {
  return {
    versionId: params.get("version") ?? undefined,
    rangeStart: params.get("start") ?? undefined,
    rangeEnd: params.get("end") ?? undefined,
    cursor: params.get("cursor") ?? undefined,
    granularity: (params.get("granularity") ?? "15m") as ExplorerGranularity,
    view: params.get("view") === "table" ? "table" : "chart",
  } as const;
}
