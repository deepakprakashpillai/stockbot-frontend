import {
  getAlgorithm,
  getAlgorithmUsage,
  getAlgorithmVersion,
  listAlgorithmVersions,
} from "../../api/algorithms";

export const algorithmInspectorQueries = {
  detail: (key: string) => ({
    queryKey: ["algorithm-inspector", key],
    queryFn: () => getAlgorithm(key),
  }),
  versions: (key: string) => ({
    queryKey: ["algorithm-inspector-versions", key],
    queryFn: () => listAlgorithmVersions(key),
  }),
  version: (id: string) => ({
    queryKey: ["algorithm-version", id],
    queryFn: () => getAlgorithmVersion(id),
  }),
  usage: (id: string) => ({
    queryKey: ["algorithm-usage", id],
    queryFn: () => getAlgorithmUsage(id),
  }),
};
