import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  compareBacktests,
  getComparisonSeries,
  preflightComparison,
} from "../../api/backtests";
import { ComparisonsPage } from "./ComparisonsPage";

const runA = "11111111-1111-4111-8111-111111111111";
const runB = "22222222-2222-4222-8222-222222222222";

vi.mock("../../api/backtests", () => ({
  compareBacktests: vi.fn(),
  getComparisonSeries: vi.fn(),
  preflightComparison: vi.fn(),
}));
vi.mock("../../api/system", () => ({
  ApiError: class ApiError extends Error {},
}));
vi.mock("./BacktestCatalog", () => ({
  BacktestCatalog: ({
    onSelectionChange,
  }: {
    onSelectionChange: (ids: string[]) => void;
  }) => (
    <button onClick={() => onSelectionChange([runA, runB])}>
      Select compatible fixtures
    </button>
  ),
}));

describe("ComparisonsPage", () => {
  afterEach(cleanup);

  it("requires backend safety preflight and shows parameter differences without ranking a winner", async () => {
    vi.mocked(preflightComparison).mockResolvedValue({
      allowed: true,
      run_ids: [runA, runB],
      mode: "PLATFORM_DEMO",
      synthetic: true,
      unit: "DEMO_UNITS",
      financial_pnl_available: false,
      issues: [],
      warnings: [],
      performance_comparable: true,
      comparison_scope: "PERFORMANCE",
    });
    vi.mocked(compareBacktests).mockResolvedValue({
      run_ids: [runA, runB],
      mode: "PLATFORM_DEMO",
      synthetic: true,
      unit: "DEMO_UNITS",
      financial_pnl_available: false,
      notice: "Synthetic fixture; not strategy performance.",
      performance_comparable: true,
      comparison_scope: "PERFORMANCE",
      parameter_differences: { hold_candles: { [runA]: 4, [runB]: 6 } },
      assumption_differences: {},
      runs: [runA, runB].map((id, index) => ({
        run_id: id,
        dataset_version_id: "33333333-3333-4333-8333-333333333333",
        algorithm_version_id: id,
        start_date: "2026-01-02",
        end_date: "2026-01-02",
        status: "COMPLETED",
        code_version: "1.0.0",
        parameters: { hold_candles: index ? 6 : 4 },
        assumptions: {},
        metrics: {
          total_trades: 1,
          net_demo_units: index ? "3" : "2",
          rejections_by_reason: {
            DEMO_INTERVAL_NOT_REACHED: 4,
            DEMO_HOLD_ACTIVE: 2,
          },
        },
        synthetic: true as const,
        unit: "DEMO_UNITS" as const,
        financial_pnl_available: false as const,
      })),
    });
    vi.mocked(getComparisonSeries).mockResolvedValue({
      comparison_hash: "a".repeat(64),
      run_ids: [runA, runB],
      mode: "PLATFORM_DEMO",
      synthetic: true,
      unit: "DEMO_UNITS",
      financial_pnl_available: false,
      requested_series: ["equity"],
      effective_start: "2026-01-02T09:15:00Z",
      effective_end: "2026-01-02T09:20:00Z",
      resolution: "raw",
      max_points_per_run: 500,
      warnings: [],
      category_definitions: {
        signal_decisions: ["ACCEPTED", "REJECTED"],
        rejection_reasons: [],
      },
      runs: [runA, runB].map((runId, index) => ({
        run_id: runId,
        equity: [
          {
            timestamp: "2026-01-02T09:15:00Z",
            sequence: 1,
            value: String(index + 1),
          },
        ],
        drawdown: [],
        trade_outcomes: [],
        signal_decisions: [],
        rejection_reasons: [],
        original_point_counts: { equity: 1 },
        returned_point_counts: { equity: 1 },
      })),
    });
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <MemoryRouter>
          <ComparisonsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Select compatible fixtures" }),
    );
    expect(
      await screen.findByText("Comparable performance scope"),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Compare selected runs" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Parameter differences" }),
    ).toBeVisible();
    expect(screen.getByText("hold_candles")).toBeVisible();
    expect(
      screen.getAllByText(
        '{"DEMO_HOLD_ACTIVE":2,"DEMO_INTERVAL_NOT_REACHED":4}',
      ),
    ).toHaveLength(2);
    expect(screen.queryByText("[object Object]")).not.toBeInTheDocument();
    expect(screen.getByText(/not a single “best” result/i)).toBeVisible();
    expect(preflightComparison).toHaveBeenCalledWith([runA, runB]);
    fireEvent.click(
      screen.getByRole("button", { name: "Load visual evidence" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Synchronized comparison" }),
    ).toBeVisible();
    expect(getComparisonSeries).toHaveBeenCalledWith(
      expect.objectContaining({
        runIds: [runA, runB],
        series: ["equity"],
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Small multiples" }));
    expect(
      screen.getByRole("button", { name: "Small multiples" }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});
