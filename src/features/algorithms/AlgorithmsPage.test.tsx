import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkCompatibility,
  getAlgorithmSchema,
  listAlgorithms,
  listAlgorithmVersions,
} from "../../api/algorithms";
import { listDatasets } from "../../api/datasets";
import { AlgorithmsPage } from "./AlgorithmsPage";

vi.mock("../../api/algorithms", () => ({
  listAlgorithms: vi.fn(),
  getAlgorithmSchema: vi.fn(),
  listAlgorithmVersions: vi.fn(),
  checkCompatibility: vi.fn(),
  validateAlgorithm: vi.fn(),
  saveAlgorithmVersion: vi.fn(),
  archiveAlgorithmVersion: vi.fn(),
}));
vi.mock("../../api/datasets", () => ({ listDatasets: vi.fn() }));
vi.mock("../../api/system", () => ({
  ApiError: class ApiError extends Error {},
}));

const algorithm = {
  key: "bull_call_spread",
  display_name: "Bull Call Spread",
  description: "Signal research",
  code_version: "0.1.0-signal-research",
  schema_version: 1,
  active: true,
  supported_modes: ["signal_research"],
  required_capabilities: ["price_candles", "futures_vwap", "india_vix"],
  fixed_rules: { live_trading_approved: false },
  documentation: {
    purpose: "Research",
    lifecycle_status: "experimental_research",
    safety_notice: "Experimental",
    limitations: [],
    inputs: [],
    logic_steps: [],
    outputs: [],
    diagnostic_schema_version: "1",
    rule_register_version: "stockbot.rule-register.v1",
    rules: [],
  },
  templates: [
    {
      key: "hard_gates_confirmation_5",
      name: "Hard gates + confirmation (5)",
      description: "Experimental",
      experimental: true,
      parameters: {
        score_model: "hard_gates_confirmation_5",
        minimum_confirmation_score: 3,
      },
    },
  ],
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AlgorithmsPage />
    </QueryClientProvider>,
  );
}

describe("AlgorithmsPage", () => {
  beforeEach(() => {
    vi.mocked(listAlgorithms).mockResolvedValue({ items: [algorithm] });
    vi.mocked(getAlgorithmSchema).mockResolvedValue({
      algorithm_key: algorithm.key,
      code_version: algorithm.code_version,
      schema_version: 1,
      schema_hash: "a".repeat(64),
      schema: {
        properties: {
          score_model: { type: "string", enum: ["hard_gates_confirmation_5"] },
          minimum_confirmation_score: {
            type: "integer",
            minimum: 0,
            maximum: 5,
          },
        },
      },
    });
    vi.mocked(listAlgorithmVersions).mockResolvedValue({ items: [] });
    vi.mocked(listDatasets).mockResolvedValue({
      items: [
        {
          id: "dataset",
          name: "NIFTY",
          description: null,
          source: null,
          created_at: "2026-08-02T00:00:00Z",
          version_count: 1,
          latest_version: {
            id: "version",
            version_number: 1,
            status: "WARNING",
            checksum: "x",
            row_count: 18312,
            session_count: 245,
            coverage_start: null,
            coverage_end: null,
            created_at: "2026-08-02T00:00:00Z",
            original_filename: "nifty.csv",
            validation_progress: 100,
            warning_count: 0,
            error_count: 0,
            timezone: "Asia/Kolkata",
            resolution_minutes: 5,
            capabilities: { price_candles: true },
          },
        },
      ],
      next_cursor: null,
      total_count: 1,
    });
    vi.mocked(checkCompatibility).mockResolvedValue({
      algorithm_key: algorithm.key,
      dataset_version_id: "version",
      required_capabilities: algorithm.required_capabilities,
      available_capabilities: ["price_candles"],
      missing_capabilities: ["futures_vwap", "india_vix"],
      compatible: false,
    });
  });

  it("shows grouped immutable configuration and strict dataset incompatibility", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "Bull Call Spread" }),
    ).toBeVisible();
    expect(
      await screen.findByText(/Current NIFTY dataset is incompatible/),
    ).toHaveTextContent("futures_vwap, india_vix");
    const templateSelect = screen.getByRole("combobox", {
      name: "Starting defaults",
    });
    expect(templateSelect).toBeVisible();
    expect(
      await screen.findByRole("heading", { name: "Live rule summary" }),
    ).toBeVisible();
    expect(
      await screen.findByRole("heading", { name: "Deferred data rules" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Save New Version" }),
    ).toBeDisabled();
  });

  it.each([
    ["nifty_futures_close", "futures close"],
    ["nifty_spot_close", "spot close"],
  ])(
    "describes the catalog's VWAP comparison source %s",
    async (source, label) => {
      vi.mocked(listAlgorithms).mockResolvedValue({
        items: [
          {
            ...algorithm,
            fixed_rules: {
              ...algorithm.fixed_rules,
              vwap_comparison_price: source,
            },
          },
        ],
      });
      renderPage();
      expect(
        await screen.findByText(
          new RegExp(`Require spot above PDH and ${label} above futures VWAP`),
        ),
      ).toBeVisible();
    },
  );
});
