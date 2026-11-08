import type { components } from "./generated/schema";

import { apiClient } from "./client";
import { ApiError } from "./system";

export type ExperimentPlan = components["schemas"]["ExperimentPlanResponse"];
export type ExperimentBatch = components["schemas"]["ExperimentBatchResponse"];
export type ExperimentPlanInput =
  components["schemas"]["ExperimentPlanCreateRequest"];

async function checked<T>(
  promise: Promise<{ data?: T; response: Response }>,
  message: string,
) {
  const result = await promise;
  if (!result.data || !result.response.ok) {
    throw new ApiError(
      message,
      result.response.headers.get("X-Request-ID") ?? undefined,
      result.response.status,
    );
  }
  return result.data;
}

export function createExperiment(input: ExperimentPlanInput) {
  return checked(
    apiClient.POST("/api/v1/experiments", { body: input }),
    "Could not create the immutable experiment plan.",
  );
}

export function getExperiment(planId: string) {
  return checked(
    apiClient.GET("/api/v1/experiments/{plan_id}", {
      params: { path: { plan_id: planId } },
    }),
    "Could not load this experiment.",
  );
}

export function startExperiment(planId: string) {
  return checked(
    apiClient.POST("/api/v1/experiments/{plan_id}/start", {
      params: { path: { plan_id: planId } },
    }),
    "Could not start the sequential development batch.",
  );
}

export function unlockExperimentValidation(
  planId: string,
  selectedAlgorithmVersionId: string,
  acceptedCoverageDigest: string,
) {
  return checked(
    apiClient.POST("/api/v1/experiments/{plan_id}/unlock-validation", {
      params: { path: { plan_id: planId } },
      body: {
        selected_algorithm_version_id: selectedAlgorithmVersionId,
        accepted_coverage_digest: acceptedCoverageDigest,
      },
    }),
    "Could not unlock the reserved validation run.",
  );
}

export function preflightExperiment(input: ExperimentPlanInput) {
  return checked(
    apiClient.POST("/api/v1/experiments/preflight", { body: input }),
    "Could not review experiment coverage.",
  );
}
