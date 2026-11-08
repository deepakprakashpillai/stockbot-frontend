import createClient from "openapi-fetch";

import type { paths } from "./generated/schema";
import { getRuntimeConfig } from "../lib/config";

export const SESSION_STATE_EVENT = "stockbot:session-state";

export type SessionStateReason = "expired" | "signed-out";

export function announceSessionState(reason: SessionStateReason) {
  window.dispatchEvent(
    new CustomEvent(SESSION_STATE_EVENT, { detail: reason }),
  );
}

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const response = await fetch(input, { ...init, credentials: "include" });
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  if (response.status === 401 && !url.includes("/api/v1/auth/session")) {
    announceSessionState("expired");
  }
  return response;
}

export const apiClient = createClient<paths>({
  baseUrl: getRuntimeConfig().apiBaseUrl,
  credentials: "include",
  fetch: authenticatedFetch,
});
