import type { components } from "./generated/schema";

import { apiClient, authenticatedFetch } from "./client";
import { getRuntimeConfig } from "../lib/config";
import { ApiError } from "./system";

export type DatasetSummary = components["schemas"]["DatasetSummaryResponse"];
export type DatasetVersion = components["schemas"]["DatasetVersionResponse"];
export type DatasetDetail = components["schemas"]["DatasetDetailResponse"];
export type RangePreflight = components["schemas"]["RangePreflightResponse"];
export type LibrarySummary = components["schemas"]["LibrarySummaryResponse"];
export type DatasetUploadSession =
  components["schemas"]["DatasetUploadSessionResponse"];
export type DatasetProfile = components["schemas"]["DatasetProfileResponse"];
export type DatasetCandles = components["schemas"]["DatasetCandlesResponse"];

function requestId(response: Response): string | undefined {
  return response.headers.get("X-Request-ID") ?? undefined;
}

async function checked<T>(
  promise: Promise<{ data?: T; response: Response }>,
  message: string,
): Promise<T> {
  const result = await promise;
  if (!result.data || !result.response.ok) {
    throw new ApiError(
      message,
      requestId(result.response),
      result.response.status,
    );
  }
  return result.data;
}

export function listDatasets(
  status?: string,
  search?: string,
  cursor?: string,
  limit = 25,
) {
  return checked(
    apiClient.GET("/api/v1/datasets", {
      params: {
        query: {
          status: status || undefined,
          search: search || undefined,
          cursor,
          limit,
        },
      },
    }),
    "Could not load the dataset catalog.",
  );
}

export function getLibrarySummary() {
  return checked(
    apiClient.GET("/api/v1/library/summary"),
    "Could not load library readiness.",
  );
}

export function getDataset(datasetId: string) {
  return checked(
    apiClient.GET("/api/v1/datasets/{dataset_id}", {
      params: { path: { dataset_id: datasetId } },
    }),
    "Could not load the dataset details.",
  );
}

export function getDatasetVersion(versionId: string) {
  return checked(
    apiClient.GET("/api/v1/dataset-versions/{version_id}", {
      params: { path: { version_id: versionId } },
    }),
    "Could not refresh this dataset version.",
  );
}

export function preflightRange(
  versionId: string,
  startDate: string,
  endDate: string,
) {
  return checked(
    apiClient.POST("/api/v1/dataset-versions/{version_id}/range-preflight", {
      params: { path: { version_id: versionId } },
      body: { start_date: startDate, end_date: endDate },
    }),
    "Could not check the selected date range.",
  );
}

export function getDatasetProfile(versionId: string) {
  return checked(
    apiClient.GET("/api/v1/dataset-versions/{version_id}/profile", {
      params: { path: { version_id: versionId } },
    }),
    "Could not load this dataset profile.",
  );
}

export function getDatasetCandles(input: {
  versionId: string;
  start?: string;
  end?: string;
  granularity?: "5m" | "15m" | "30m" | "1h" | "1d";
  purpose?: "chart" | "table";
  cursor?: string;
  limit?: number;
}) {
  return checked(
    apiClient.GET("/api/v1/dataset-versions/{version_id}/candles", {
      params: {
        path: { version_id: input.versionId },
        query: {
          start: input.start,
          end: input.end,
          granularity: input.granularity ?? "5m",
          purpose: input.purpose ?? "chart",
          cursor: input.cursor,
          limit: input.limit ?? 500,
        },
      },
    }),
    "Could not load bounded candle data.",
  );
}

export async function analyzeDatasetUpload(
  file: File,
): Promise<DatasetUploadSession> {
  const form = new FormData();
  form.append("file", file);
  const response = await authenticatedFetch(
    `${getRuntimeConfig().apiBaseUrl}/api/v1/dataset-upload-sessions`,
    { method: "POST", credentials: "include", body: form },
  );
  const body = (await response.json()) as
    | DatasetUploadSession
    | { error?: { message?: string }; request_id?: string };
  if (!response.ok || !("expires_at" in body)) {
    throw new ApiError(
      "error" in body
        ? (body.error?.message ?? "Dataset analysis failed.")
        : "Dataset analysis failed.",
      response.headers.get("X-Request-ID") ??
        ("request_id" in body ? body.request_id : undefined),
      response.status,
    );
  }
  return body;
}

export function getDatasetUploadSession(sessionId: string) {
  return checked(
    apiClient.GET("/api/v1/dataset-upload-sessions/{session_id}", {
      params: { path: { session_id: sessionId } },
    }),
    "Could not restore this upload preview.",
  );
}

export function commitDatasetUploadSession(input: {
  sessionId: string;
  name: string;
  description?: string;
  source?: string;
  datasetId?: string;
}) {
  return checked(
    apiClient.POST("/api/v1/dataset-upload-sessions/{session_id}/commit", {
      params: { path: { session_id: input.sessionId } },
      body: {
        name: input.name,
        description: input.description ?? null,
        source: input.source ?? null,
        dataset_id: input.datasetId ?? null,
      },
    }),
    "Could not commit the analyzed dataset upload.",
  );
}

export async function discardDatasetUploadSession(
  sessionId: string,
): Promise<void> {
  const response = await authenticatedFetch(
    `${getRuntimeConfig().apiBaseUrl}/api/v1/dataset-upload-sessions/${sessionId}`,
    { method: "DELETE", credentials: "include" },
  );
  if (!response.ok) {
    throw new ApiError(
      "Could not discard this upload preview.",
      requestId(response),
      response.status,
    );
  }
}

export async function uploadDataset(input: {
  name: string;
  description: string;
  source: string;
  file: File;
}): Promise<{ duplicate: boolean; dataset_version: DatasetVersion }> {
  const form = new FormData();
  form.append("name", input.name);
  form.append("description", input.description);
  form.append("source", input.source);
  form.append("file", input.file);
  const response = await authenticatedFetch(
    `${getRuntimeConfig().apiBaseUrl}/api/v1/datasets`,
    {
      method: "POST",
      credentials: "include",
      body: form,
    },
  );
  const body = (await response.json()) as
    | { duplicate: boolean; dataset_version: DatasetVersion }
    | { error?: { message?: string }; request_id?: string };
  if (!response.ok || !("dataset_version" in body)) {
    throw new ApiError(
      "error" in body
        ? (body.error?.message ?? "Dataset upload failed.")
        : "Dataset upload failed.",
      response.headers.get("X-Request-ID") ??
        ("request_id" in body ? body.request_id : undefined),
      response.status,
    );
  }
  return body;
}

export async function uploadDatasetVersion(input: {
  datasetId: string;
  name: string;
  description: string;
  source: string;
  file: File;
}): Promise<{ duplicate: boolean; dataset_version: DatasetVersion }> {
  const form = new FormData();
  form.append("name", input.name);
  form.append("description", input.description);
  form.append("source", input.source);
  form.append("file", input.file);
  const response = await authenticatedFetch(
    `${getRuntimeConfig().apiBaseUrl}/api/v1/datasets/${input.datasetId}/versions`,
    { method: "POST", credentials: "include", body: form },
  );
  const body = (await response.json()) as
    | { duplicate: boolean; dataset_version: DatasetVersion }
    | { error?: { message?: string }; request_id?: string };
  if (!response.ok || !("dataset_version" in body)) {
    throw new ApiError(
      "error" in body
        ? (body.error?.message ?? "Dataset version upload failed.")
        : "Dataset version upload failed.",
      response.headers.get("X-Request-ID") ??
        ("request_id" in body ? body.request_id : undefined),
      response.status,
    );
  }
  return body;
}
