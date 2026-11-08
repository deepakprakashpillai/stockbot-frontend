import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  createMemoryRouter,
  MemoryRouter,
  Route,
  RouterProvider,
  Routes,
} from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  downloadBacktestExport,
  getBacktest,
  getAnalyticsDefinitions,
  getRunAnalyticsSummary,
  getMetrics,
  getTrade,
  listEquity,
  listAnalyticsPeriods,
  listRunEvents,
  listSignalsInRange,
  listTrades,
} from "../../api/backtests";
import { BacktestResultPage } from "./BacktestResultPage";

vi.mock("../../api/backtests", () => ({
  getBacktest: vi.fn(),
  getEquityPoint: vi.fn(),
  getAnalyticsDefinitions: vi.fn(),
  getRunAnalyticsSummary: vi.fn(),
  getMetrics: vi.fn(),
  getRunEvent: vi.fn(),
  getSignal: vi.fn(),
  getTrade: vi.fn(),
  listEquity: vi.fn(),
  listAnalyticsPeriods: vi.fn(),
  listRunEvents: vi.fn(),
  listSignalsInRange: vi.fn(),
  listTrades: vi.fn(),
  downloadBacktestExport: vi.fn(),
}));
vi.mock("../../api/system", () => ({
  ApiError: class ApiError extends Error {},
}));
vi.mock("../../realtime/useRealtimeChannel", () => ({
  useRealtimeChannel: () => ({ connectionState: "connected", lastEvent: null }),
}));

const runId = "11111111-1111-4111-8111-111111111111";

function renderPage(path = `/backtests/${runId}`) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/backtests/:runId" element={<BacktestResultPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function renderPageWithHistory(paths: string[]) {
  const router = createMemoryRouter(
    [{ path: "/backtests/:runId", element: <BacktestResultPage /> }],
    { initialEntries: paths },
  );
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe("BacktestResultPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getBacktest).mockResolvedValue({
      id: runId,
      algorithm_version_id: "22222222-2222-4222-8222-222222222222",
      cancellation_requested: false,
      completed_at: "2026-01-02T11:00:00+05:30",
      created_at: "2026-01-02T09:00:00+05:30",
      dataset_version_id: "33333333-3333-4333-8333-333333333333",
      end_date: "2026-01-02",
      error_code: null,
      error_message: null,
      mode: "PLATFORM_DEMO",
      progress: 100,
      snapshot: {
        algorithm: {
          parameters: { hold_candles: 4 },
          code_version: "1.0.0-platform-demo",
        },
        assumptions: { demo_cost: "0.25" },
        dataset: { validation: { warnings: ["missing volume"] } },
        synthetic: true,
        unit: "DEMO_UNITS",
      },
      start_date: "2026-01-02",
      started_at: "2026-01-02T09:01:00+05:30",
      starting_capital: "100000.00",
      status: "COMPLETED",
    });
    vi.mocked(getMetrics).mockResolvedValue({
      run_id: runId,
      metrics: {
        total_trades: 1,
        net_demo_units: "2.50",
        synthetic: true,
        unit: "DEMO_UNITS",
        financial_pnl_available: false,
      },
    });
    vi.mocked(getRunAnalyticsSummary).mockResolvedValue({
      run_id: runId,
      schema_version: "stockbot.run-analytics.v1",
      calculator_version: "1.0.0",
      source_fingerprint: "a".repeat(64),
      safeguards: {
        mode: "PLATFORM_DEMO",
        synthetic: true,
        unit: "DEMO_UNITS",
        financial_pnl_available: false,
        realized_only: true,
        attribution: "EXIT_TIMESTAMP",
        timezone: "Asia/Kolkata",
      },
      summary: {
        total_trades: 1,
        wins: 1,
        losses: 0,
        breakevens: 0,
        eligible_sessions: 1,
        active_sessions: 1,
        gross_outcome: "2.50",
        total_costs: "0",
        net_outcome: "2.50",
        cumulative_net_outcome: "2.50",
        win_rate: "1",
        loss_rate: "0",
        breakeven_rate: "0",
        average_trade: "2.50",
        median_trade: "2.50",
        average_win: "2.50",
        average_loss: "0",
        largest_win: "2.50",
        largest_loss: "0",
        expectancy: "2.50",
        profit_factor: {
          value: null,
          availability: "UNAVAILABLE",
          reason: "NO_LOSING_TRADES",
        },
        payoff_ratio: {
          value: null,
          availability: "UNAVAILABLE",
          reason: "MISSING_WIN_OR_LOSS_SAMPLE",
        },
        max_consecutive_wins: 1,
        max_consecutive_losses: 0,
        average_duration_seconds: "900",
        median_duration_seconds: "900",
        average_winning_duration_seconds: "900",
        average_losing_duration_seconds: "0",
        max_drawdown_amount: "0",
        drawdown_peak_date: "2026-01-02",
        drawdown_trough_date: "2026-01-02",
        drawdown_recovery_date: null,
        drawdown_peak_timestamp: "2026-01-02T09:35:00+05:30",
        drawdown_trough_timestamp: "2026-01-02T09:35:00+05:30",
        drawdown_recovery_timestamp: null,
      },
    });
    vi.mocked(listAnalyticsPeriods).mockResolvedValue({
      run_id: runId,
      granularity: "DAY",
      purpose: "chart",
      items: [
        {
          granularity: "DAY",
          period_start: "2026-01-02",
          period_end: "2026-01-02",
          partial: false,
          eligible_session_count: 1,
          trade_count: 1,
          wins: 1,
          losses: 0,
          breakevens: 0,
          gross_outcome: "2.50",
          costs: "0",
          net_outcome: "2.50",
          cumulative_net_outcome: "2.50",
          equity_end: "2.50",
          local_max_drawdown: "0",
          run_drawdown_end: "0",
        },
      ],
      next_cursor: null,
      original_count: 1,
      returned_count: 1,
      aggregated: false,
      resolution: "DAY",
      warnings: [],
      safeguards: {
        mode: "PLATFORM_DEMO",
        synthetic: true,
        unit: "DEMO_UNITS",
        financial_pnl_available: false,
        realized_only: true,
        attribution: "EXIT_TIMESTAMP",
        timezone: "Asia/Kolkata",
      },
    });
    vi.mocked(getAnalyticsDefinitions).mockResolvedValue({
      schema_version: "stockbot.run-analytics.v1",
      safeguards: {
        mode: "PLATFORM_DEMO",
        synthetic: true,
        unit: "DEMO_UNITS",
        financial_pnl_available: false,
        realized_only: true,
        attribution: "EXIT_TIMESTAMP",
        timezone: "Asia/Kolkata",
      },
      items: [],
    });
    vi.mocked(listEquity).mockResolvedValue({
      items: [
        {
          id: "e1",
          sequence: 1,
          timestamp: "2026-01-02T09:20:00+05:30",
          equity_demo_units: "2.50",
          drawdown_demo_units: "0.00",
          synthetic: true,
          unit: "DEMO_UNITS",
          financial_pnl_available: false,
        },
      ],
      next_cursor: null,
    });
    vi.mocked(listTrades).mockResolvedValue({
      items: [
        {
          id: "t1",
          sequence: 1,
          entry_timestamp: "2026-01-02T09:20:00+05:30",
          exit_timestamp: "2026-01-02T09:35:00+05:30",
          exit_reason: "DEMO_HOLD_COMPLETE",
          quantity: "1",
          entry_reference: "100",
          exit_reference: "102.5",
          gross_demo_units: "2.5",
          costs_demo_units: "0",
          net_demo_units: "2.5",
          synthetic: true,
          unit: "DEMO_UNITS",
          financial_pnl_available: false,
          assumptions: {},
          legs: [
            {
              id: "l1",
              leg_number: 1,
              name: "DEMO_LEG_A",
              entry_reference: "100",
              exit_reference: "102.5",
              demo_units: "1.25",
              synthetic: true,
              unit: "DEMO_UNITS",
              financial_pnl_available: false,
            },
            {
              id: "l2",
              leg_number: 2,
              name: "DEMO_LEG_B",
              entry_reference: "100",
              exit_reference: "102.5",
              demo_units: "1.25",
              synthetic: true,
              unit: "DEMO_UNITS",
              financial_pnl_available: false,
            },
          ],
        },
      ],
      next_cursor: null,
    });
    vi.mocked(listSignalsInRange).mockResolvedValue({
      items: [
        {
          id: "s1",
          sequence: 1,
          timestamp: "2026-01-02T09:20:00+05:30",
          session_date: "2026-01-02",
          decision: "REJECTED",
          rejection_reason: "DEMO_INTERVAL",
          window: null,
          score: 0,
          inputs: {},
        },
      ],
      next_cursor: null,
    });
    vi.mocked(getTrade).mockResolvedValue({
      id: "t1",
      sequence: 1,
      entry_timestamp: "2026-01-02T09:20:00+05:30",
      exit_timestamp: "2026-01-02T09:35:00+05:30",
      exit_reason: "DEMO_HOLD_COMPLETE",
      quantity: "1",
      entry_reference: "100",
      exit_reference: "102.5",
      gross_demo_units: "2.5",
      costs_demo_units: "0",
      net_demo_units: "2.5",
      synthetic: true,
      unit: "DEMO_UNITS",
      financial_pnl_available: false,
      assumptions: {},
      legs: [
        {
          id: "l1",
          leg_number: 1,
          name: "DEMO_LEG_A",
          entry_reference: "100",
          exit_reference: "102.5",
          demo_units: "1.25",
          synthetic: true,
          unit: "DEMO_UNITS",
          financial_pnl_available: false,
        },
        {
          id: "l2",
          leg_number: 2,
          name: "DEMO_LEG_B",
          entry_reference: "100",
          exit_reference: "102.5",
          demo_units: "1.25",
          synthetic: true,
          unit: "DEMO_UNITS",
          financial_pnl_available: false,
        },
      ],
    });
    vi.mocked(listRunEvents).mockResolvedValue({
      items: [
        {
          id: "r1",
          sequence: 1,
          event_type: "backtest.completed",
          payload: {},
          created_at: "2026-01-02T11:00:00+05:30",
        },
      ],
      next_cursor: null,
    });
  });

  it("reconstructs a completed synthetic run at its durable URL", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "Run 11111111" }),
    ).toBeVisible();
    expect(
      screen.getByText(/PLATFORM_DEMO · synthetic fixture/i),
    ).toBeVisible();
    expect(
      await screen.findByRole("heading", { name: "Closed-outcome analytics" }),
    ).toBeVisible();
    expect(await screen.findByText("Exact day ledger")).toBeVisible();
    expect(screen.queryByText(/₹/)).not.toBeInTheDocument();
  });

  it("formats option-simulation analytics in INR", async () => {
    const optionRun = await getBacktest(runId);
    const summary = await getRunAnalyticsSummary(runId);
    vi.mocked(getBacktest).mockResolvedValueOnce({
      ...optionRun,
      mode: "OPTION_SPREAD_SIMULATION",
      estimate_limitations: [
        "Results are unfiltered for market event days.",
        "Stops and targets are evaluated at five-minute closes; intrabar breaches are not detected.",
      ],
      snapshot: {
        ...optionRun.snapshot,
        synthetic: false,
        unit: "INR",
      },
    });
    vi.mocked(getRunAnalyticsSummary).mockResolvedValueOnce({
      ...summary,
      safeguards: {
        ...summary.safeguards,
        mode: "OPTION_SPREAD_SIMULATION",
        synthetic: false,
        unit: "INR",
        financial_pnl_available: true,
      },
    });

    renderPage();

    expect(
      await screen.findByText(
        /Exit-date realized option-simulation outcomes in Indian Rupees/i,
      ),
    ).toBeVisible();
    expect((await screen.findAllByText("+₹2.50")).length).toBeGreaterThan(0);
    expect(await screen.findByText("Option Spread Trades")).toBeVisible();
    expect(
      await screen.findByText("Results are unfiltered for market event days."),
    ).toBeVisible();
    fireEvent.click(
      screen.getByText(
        "Search signal decisions · filter and inspect individual checks",
      ),
    );
    expect(
      await screen.findByText(/persisted algorithm version/i),
    ).toBeVisible();
  });

  it("restores a shared Month view and opens the exact trade ledger", async () => {
    renderPage(
      `/backtests/${runId}?analytics_granularity=MONTH&analytics_period=2026-01-01`,
    );

    expect(await screen.findByText("Exact month ledger")).toBeVisible();
    expect(listAnalyticsPeriods).toHaveBeenCalledWith(
      runId,
      "MONTH",
      "chart",
      undefined,
      500,
      expect.objectContaining({ includeZeroPeriods: true }),
    );

    expect(await screen.findByText("Synthetic Trades Table")).toBeVisible();
    expect(listTrades).toHaveBeenCalledWith(
      runId,
      undefined,
      expect.objectContaining({}),
    );
  });

  it("restores research state through Back and Forward navigation", async () => {
    const router = renderPageWithHistory([`/backtests/${runId}`]);

    expect(await screen.findByText("Exact day ledger")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Month" }));
    expect(await screen.findByText("Exact month ledger")).toBeVisible();
    expect(router.state.location.search).toContain(
      "analytics_granularity=MONTH",
    );

    await act(async () => {
      await router.navigate(-1);
    });
    expect(await screen.findByText("Exact day ledger")).toBeVisible();
    await act(async () => {
      await router.navigate(1);
    });
    expect(await screen.findByText("Exact month ledger")).toBeVisible();
  });

  it("focuses the selected ledger row and opens immutable trade details", async () => {
    renderPage(
      `/backtests/${runId}?selected_trade=t1&analytics_period=2026-01-02`,
    );

    expect(await screen.findByText("Entry Ref")).toBeVisible();
    expect(screen.getByText("DEMO_LEG_A")).toBeVisible();

    const periodButton = await screen.findByRole("button", {
      name: "2026-01-02",
    });
    expect(periodButton.closest("tr")?.getAttribute("data-selected")).toBe(
      "true",
    );
  });

  it("keeps incomplete and failed runs in their safe, immutable views", async () => {
    vi.mocked(getBacktest).mockResolvedValueOnce({
      id: runId,
      algorithm_version_id: "22222222-2222-4222-8222-222222222222",
      cancellation_requested: false,
      completed_at: null,
      created_at: "2026-01-02T09:00:00+05:30",
      dataset_version_id: "33333333-3333-4333-8333-333333333333",
      end_date: "2026-01-02",
      error_code: null,
      error_message: null,
      mode: "PLATFORM_DEMO",
      progress: 42,
      snapshot: { algorithm: { code_version: "1.0.0-platform-demo" } },
      start_date: "2026-01-02",
      started_at: "2026-01-02T09:01:00+05:30",
      starting_capital: "100000.00",
      status: "RUNNING",
    });
    const incomplete = renderPage();
    expect(await screen.findByText("42%")).toBeVisible();
    expect(screen.queryByText("Closed-outcome analytics")).toBeNull();
    incomplete.unmount();

    vi.mocked(getBacktest).mockResolvedValueOnce({
      id: runId,
      algorithm_version_id: "22222222-2222-4222-8222-222222222222",
      cancellation_requested: false,
      completed_at: "2026-01-02T11:00:00+05:30",
      created_at: "2026-01-02T09:00:00+05:30",
      dataset_version_id: "33333333-3333-4333-8333-333333333333",
      end_date: "2026-01-02",
      error_code: "BACKTEST_EXECUTION_FAILED",
      error_message: "Synthetic fixture failed safely.",
      mode: "PLATFORM_DEMO",
      progress: 42,
      snapshot: { algorithm: { code_version: "1.0.0-platform-demo" } },
      start_date: "2026-01-02",
      started_at: "2026-01-02T09:01:00+05:30",
      starting_capital: "100000.00",
      status: "FAILED",
    });
    renderPage();
    expect(
      await screen.findByText(/Run Failed: BACKTEST_EXECUTION_FAILED/),
    ).toBeVisible();
    expect(screen.queryByText("Closed-outcome analytics")).toBeNull();
  });

  it("keeps zero-trade and analytics-backfill-error states explanatory", async () => {
    vi.mocked(listAnalyticsPeriods).mockResolvedValue({
      run_id: runId,
      granularity: "DAY",
      purpose: "chart",
      items: [],
      next_cursor: null,
      original_count: 0,
      returned_count: 0,
      aggregated: false,
      resolution: "DAY",
      warnings: [],
      safeguards: {
        mode: "PLATFORM_DEMO",
        synthetic: true,
        unit: "DEMO_UNITS",
        financial_pnl_available: false,
        realized_only: true,
        attribution: "EXIT_TIMESTAMP",
        timezone: "Asia/Kolkata",
      },
    });
    renderPage();
    expect(
      await screen.findByText(
        "No periods match the current research controls.",
      ),
    ).toBeVisible();
    cleanup();

    vi.mocked(getRunAnalyticsSummary).mockRejectedValueOnce(
      new Error("analytics backfill unavailable"),
    );
    renderPage();
    expect(
      await screen.findByText(
        "Completed-run analytics are being prepared or could not be loaded.",
      ),
    ).toBeVisible();
  });

  it("exports the exact Trade, Day, or Month research view with its URL filters", async () => {
    vi.mocked(downloadBacktestExport).mockResolvedValue({
      blob: new Blob(["synthetic"], { type: "text/csv" }),
      filename: "selected-view.csv",
    });
    renderPage(
      `/backtests/${runId}?analytics_granularity=MONTH&analytics_from=2026-01-01&analytics_to=2026-01-31&analytics_zero=hide&analytics_sort=PERIOD_DESC`,
    );

    expect(await screen.findByText("Exact month ledger")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    await waitFor(() =>
      expect(downloadBacktestExport).toHaveBeenCalledWith(
        runId,
        "analytics",
        "csv",
        expect.objectContaining({
          granularity: "MONTH",
          startDate: "2026-01-01",
          endDate: "2026-01-31",
          includeZeroPeriods: false,
          sort: "PERIOD_DESC",
        }),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Trade" }));
    expect(await screen.findByText("Exact trade ledger")).toBeVisible();
    expect(listAnalyticsPeriods).toHaveBeenCalledWith(
      runId,
      "TRADE",
      "chart",
      undefined,
      500,
      expect.objectContaining({ includeZeroPeriods: true }),
    );
  });
});
