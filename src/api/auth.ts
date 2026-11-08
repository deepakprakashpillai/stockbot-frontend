import { getRuntimeConfig } from "../lib/config";
import { announceSessionState, authenticatedFetch } from "./client";
import { ApiError } from "./system";

function requestId(response: Response) {
  return response.headers.get("X-Request-ID") ?? undefined;
}

export async function getAuthSession() {
  const response = await authenticatedFetch(
    `${getRuntimeConfig().apiBaseUrl}/api/v1/auth/session`,
    {
      credentials: "include",
      headers: { Accept: "application/json" },
    },
  );
  if (response.status === 401) return { authenticated: false };
  if (!response.ok) {
    throw new ApiError(
      "Could not check the platform session.",
      requestId(response),
      response.status,
    );
  }
  const body = (await response.json()) as { authenticated?: unknown };
  return { authenticated: body.authenticated === true };
}

export async function createAuthSession(accessKey: string) {
  const response = await authenticatedFetch(
    `${getRuntimeConfig().apiBaseUrl}/api/v1/auth/session`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ access_key: accessKey }),
    },
  );
  if (!response.ok) {
    throw new ApiError(
      response.status === 401
        ? "That local access key was not accepted."
        : "Could not unlock the platform.",
      requestId(response),
      response.status,
    );
  }
  return { authenticated: true };
}

export async function deleteAuthSession() {
  const response = await authenticatedFetch(
    `${getRuntimeConfig().apiBaseUrl}/api/v1/auth/session`,
    {
      method: "DELETE",
      credentials: "include",
      headers: { Accept: "application/json" },
    },
  );
  if (!response.ok) {
    throw new ApiError(
      "Could not close the platform session.",
      requestId(response),
      response.status,
    );
  }
  announceSessionState("signed-out");
}
