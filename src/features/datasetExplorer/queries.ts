import { getDatasetCandles, getDatasetProfile } from "../../api/datasets";
import type { ExplorerGranularity } from "./explorerSearchParams";

export const datasetExplorerQueries = {
  profile: (versionId: string) => ({
    queryKey: ["dataset-profile", versionId],
    queryFn: () => getDatasetProfile(versionId),
  }),
  candles: (input: {
    versionId: string;
    start?: string;
    end?: string;
    granularity: ExplorerGranularity;
    purpose?: "chart" | "table";
    cursor?: string;
  }) => ({
    queryKey: ["dataset-candles", input],
    queryFn: () => getDatasetCandles({ ...input, limit: 500 }),
  }),
};
