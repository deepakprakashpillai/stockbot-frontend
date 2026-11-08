import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { getSystemStatus } from "../../api/system";
import { SystemStatusPage } from "./SystemStatusPage";

vi.mock("../../api/system", () => ({
  getSystemStatus: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SystemStatusPage />
    </QueryClientProvider>,
  );
}

describe("SystemStatusPage", () => {
  it("displays backend readiness details", async () => {
    vi.mocked(getSystemStatus).mockResolvedValue({
      health: { status: "ok" },
      readiness: {
        status: "ready",
        checks: { database: "ok", celery_broker: "ok", realtime_bus: "ok" },
      },
      system: {
        service: "stockbot-backend",
        api_version: "v1",
        environment: "development",
      },
      requestId: "request-1",
    });
    renderPage();

    expect(await screen.findByText("stockbot-backend")).toBeVisible();
    expect(screen.getByText("database")).toBeVisible();
  });

  it("displays backend errors", async () => {
    vi.mocked(getSystemStatus).mockRejectedValue(
      new Error("The API health check failed."),
    );
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The API health check failed.",
    );
  });
});
