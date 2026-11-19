import type { components } from "./generated/schema";
import { apiClient } from "./client";
import { ApiError } from "./system";
import type { BacktestInputs } from "./backtests";

export type ResearchGroup =
  components["schemas"]["ResearchScenarioGroupResponse"];
export type OptionPosition = components["schemas"]["OptionPositionResponse"];

async function checked<T>(
  promise: Promise<{ data?: T; error?: unknown; response: Response }>,
) {
  const result = await promise;
  if (!result.data || !result.response.ok) {
    const body = result.error as { error?: { message?: string } } | undefined;
    throw new ApiError(
      body?.error?.message ?? "Could not load this research evidence.",
      result.response.headers.get("X-Request-ID") ?? undefined,
      result.response.status,
    );
  }
  return result.data;
}

export const preflightResearch = (body: BacktestInputs) =>
  checked(
    apiClient.POST("/api/v1/research-scenario-groups/preflight", { body }),
  );
export const startResearch = (body: BacktestInputs, key: string) =>
  checked(
    apiClient.POST("/api/v1/research-scenario-groups", {
      body,
      headers: { "Idempotency-Key": key },
    }),
  );
export const getResearchGroup = (groupId: string) =>
  checked(
    apiClient.GET("/api/v1/research-scenario-groups/{group_id}", {
      params: { path: { group_id: groupId } },
    }),
  );
export const cancelResearchGroup = (groupId: string) =>
  checked(
    apiClient.POST("/api/v1/research-scenario-groups/{group_id}/cancel", {
      params: { path: { group_id: groupId } },
    }),
  );
export const listCycles = (runId: string, cursor?: string) =>
  checked(
    apiClient.GET("/api/v1/backtests/{run_id}/cycles", {
      params: { path: { run_id: runId }, query: { cursor, limit: 100 } },
    }),
  );
export const getCycle = (runId: string, cycleId: string) =>
  checked(
    apiClient.GET("/api/v1/backtests/{run_id}/cycles/{cycle_id}", {
      params: { path: { run_id: runId, cycle_id: cycleId } },
    }),
  );
export const getOptionPosition = (runId: string, cycleId: string) =>
  checked(
    apiClient.GET("/api/v1/backtests/{run_id}/option-positions/{cycle_id}", {
      params: { path: { run_id: runId, cycle_id: cycleId } },
    }),
  );
export const listRiskEntries = (runId: string, cursor?: string) =>
  checked(
    apiClient.GET("/api/v1/backtests/{run_id}/risk-ledger", {
      params: { path: { run_id: runId }, query: { cursor, limit: 100 } },
    }),
  );
export const listPortfolioJournal = (
  runId: string,
  cursor?: string,
  limit = 50,
  attemptId?: string,
) =>
  checked(
    apiClient.GET("/api/v1/backtests/{run_id}/portfolio-journal", {
      params: {
        path: { run_id: runId },
        query: { cursor, limit, attempt_id: attemptId },
      },
    }),
  );
export const getAssessment = (runId: string) =>
  checked(
    apiClient.GET("/api/v1/backtests/{run_id}/assessment", {
      params: { path: { run_id: runId } },
    }),
  );
export const getScenarioComparison = (groupId: string, cursor?: string) =>
  checked(
    apiClient.GET("/api/v1/research-scenario-groups/{group_id}/comparison", {
      params: { path: { group_id: groupId }, query: { cursor, limit: 100 } },
    }),
  );
export const getModel2Manifest = (versionId: string) =>
  checked(
    apiClient.GET(
      "/api/v1/dataset-versions/{dataset_version_id}/model2-manifest",
      { params: { path: { dataset_version_id: versionId } } },
    ),
  );
