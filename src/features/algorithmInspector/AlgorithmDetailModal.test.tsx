import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { getAlgorithm, listAlgorithmVersions } from "../../api/algorithms";
import { AlgorithmDetailModal } from "./AlgorithmDetailModal";

vi.mock("../../api/algorithms", () => ({
  getAlgorithm: vi.fn(),
  listAlgorithmVersions: vi.fn(),
  getAlgorithmUsage: vi.fn(),
  getAlgorithmVersion: vi.fn(),
  checkCompatibility: vi.fn(),
}));

describe("AlgorithmDetailModal", () => {
  it("restores a synthetic algorithm inspector from its URL", async () => {
    vi.mocked(getAlgorithm).mockResolvedValue({
      key: "platform_demo",
      display_name: "Platform Demo",
      description: "fixture",
      code_version: "1",
      schema_version: 1,
      active: true,
      supported_modes: ["PLATFORM_DEMO"],
      required_capabilities: ["price_candles"],
      fixed_rules: { synthetic: true },
      templates: [],
      documentation: {
        purpose: "Synthetic fixture",
        lifecycle_status: "synthetic_fixture",
        safety_notice: "Not financial P&L",
        limitations: ["Not a strategy"],
        inputs: [],
        logic_steps: [],
        outputs: [],
        diagnostic_schema_version: "1",
        rule_register_version: "stockbot.rule-register.v1",
        rules: [],
      },
    });
    vi.mocked(listAlgorithmVersions).mockResolvedValue({ items: [] });
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <MemoryRouter
          initialEntries={[
            "/library?algorithm=platform_demo&algorithmInspector=1",
          ]}
        >
          <AlgorithmDetailModal />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(
      await screen.findByRole("dialog", { name: "Platform Demo inspector" }),
    ).toBeVisible();
    expect(screen.getByText("Not financial P&L")).toBeVisible();
    expect(screen.getByText("Synthetic fixture")).toBeVisible();
  });
});
