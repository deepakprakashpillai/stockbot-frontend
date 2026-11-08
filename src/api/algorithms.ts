import type { components } from "./generated/schema";

import { apiClient } from "./client";
import { ApiError } from "./system";

export type Algorithm = components["schemas"]["AlgorithmResponse"];
export type AlgorithmVersion =
  components["schemas"]["AlgorithmVersionResponse"];
export type Compatibility = components["schemas"]["CompatibilityResponse"];
export type AlgorithmUsage =
  components["schemas"]["AlgorithmUsageSummaryResponse"];

function id(response: Response) {
  return response.headers.get("X-Request-ID") ?? undefined;
}

async function checked<T>(
  promise: Promise<{ data?: T; response: Response }>,
  message: string,
) {
  const result = await promise;
  if (!result.data || !result.response.ok)
    throw new ApiError(message, id(result.response), result.response.status);
  return result.data;
}

export function listAlgorithms() {
  return checked(
    apiClient.GET("/api/v1/algorithms"),
    "Could not load the algorithm catalog.",
  );
}

export function getAlgorithmSchema(key: string) {
  return checked(
    apiClient.GET("/api/v1/algorithms/{algorithm_key}/schema", {
      params: { path: { algorithm_key: key } },
    }),
    "Could not load the parameter schema.",
  );
}

export function getAlgorithm(key: string) {
  return checked(
    apiClient.GET("/api/v1/algorithms/{algorithm_key}", {
      params: { path: { algorithm_key: key } },
    }),
    "Could not load algorithm inspection details.",
  );
}

export function getAlgorithmVersion(versionId: string) {
  return checked(
    apiClient.GET("/api/v1/algorithm-versions/{version_id}", {
      params: { path: { version_id: versionId } },
    }),
    "Could not load this immutable algorithm version.",
  );
}

export function getAlgorithmUsage(versionId: string, cursor?: string) {
  return checked(
    apiClient.GET("/api/v1/algorithm-versions/{version_id}/usage-summary", {
      params: { path: { version_id: versionId }, query: { cursor, limit: 25 } },
    }),
    "Could not load this version's run usage.",
  );
}

export function listAlgorithmVersions(key: string, includeArchived = true) {
  return checked(
    apiClient.GET("/api/v1/algorithms/{algorithm_key}/versions", {
      params: {
        path: { algorithm_key: key },
        query: { include_archived: includeArchived },
      },
    }),
    "Could not load saved versions.",
  );
}

export function validateAlgorithm(
  key: string,
  parameters: Record<string, unknown>,
) {
  return checked(
    apiClient.POST("/api/v1/algorithms/{algorithm_key}/validate", {
      params: { path: { algorithm_key: key } },
      body: { parameters },
    }),
    "Could not validate the parameters.",
  );
}

export function saveAlgorithmVersion(
  key: string,
  input: {
    name: string;
    notes?: string;
    parent_version_id?: string | null;
    parameters: Record<string, unknown>;
  },
) {
  return checked(
    apiClient.POST("/api/v1/algorithms/{algorithm_key}/versions", {
      params: { path: { algorithm_key: key } },
      body: input,
    }),
    "Could not save the algorithm version.",
  );
}

export function archiveAlgorithmVersion(versionId: string) {
  return checked(
    apiClient.POST("/api/v1/algorithm-versions/{version_id}/archive", {
      params: { path: { version_id: versionId } },
    }),
    "Could not archive the algorithm version.",
  );
}

export function checkCompatibility(key: string, datasetVersionId: string) {
  return checked(
    apiClient.POST("/api/v1/algorithms/{algorithm_key}/compatibility", {
      params: { path: { algorithm_key: key } },
      body: { dataset_version_id: datasetVersionId },
    }),
    "Could not check dataset compatibility.",
  );
}
