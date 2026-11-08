import { apiClient } from "./client";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly requestId?: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

function requestId(response: Response): string | undefined {
  return response.headers.get("X-Request-ID") ?? undefined;
}

export async function getSystemStatus() {
  const [health, readiness, system] = await Promise.all([
    apiClient.GET("/health"),
    apiClient.GET("/ready"),
    apiClient.GET("/api/v1/system"),
  ]);
  if (!health.data || !health.response.ok) {
    throw new ApiError(
      "The API health check failed.",
      requestId(health.response),
      health.response.status,
    );
  }
  if (!system.data || !system.response.ok) {
    throw new ApiError(
      "The API system check failed.",
      requestId(system.response),
      system.response.status,
    );
  }
  if (!readiness.data) {
    throw new ApiError(
      "The API readiness check returned no details.",
      requestId(readiness.response),
      readiness.response.status,
    );
  }
  return {
    health: health.data,
    readiness: readiness.data,
    system: system.data,
    requestId: requestId(readiness.response),
  };
}
