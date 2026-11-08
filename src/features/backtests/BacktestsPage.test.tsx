import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listAlgorithms, listAlgorithmVersions } from "../../api/algorithms";
import {
  getBacktest,
  getMetrics,
  listEquity,
  listRunEvents,
  listSignals,
  listTrades,
  preflightBacktest,
  startBacktest,
} from "../../api/backtests";
import { listDatasets } from "../../api/datasets";
import { BacktestsPage } from "./BacktestsPage";

const realtimeMock = vi.hoisted(() => ({
  channel: null as string | null,
  handler: null as ((event: unknown) => void) | null,
  state: "connected",
}));

vi.mock("../../api/algorithms", () => ({
  listAlgorithms: vi.fn(),
  listAlgorithmVersions: vi.fn(),
}));
vi.mock("../../api/datasets", () => ({ listDatasets: vi.fn() }));
vi.mock("../../api/backtests", () => ({
  preflightBacktest: vi.fn(),
  startBacktest: vi.fn(),
  getBacktest: vi.fn(),
  getMetrics: vi.fn(),
  listSignals: vi.fn(),
  listRunEvents: vi.fn(),
  listTrades: vi.fn(),
  listEquity: vi.fn(),
  cancelBacktest: vi.fn(),
}));
vi.mock("../../api/system", () => ({
  ApiError: class ApiError extends Error {},
}));
vi.mock("../../realtime/useRealtimeChannel", () => ({
  useRealtimeChannel: (
    channel: string | null,
    handler: (event: unknown) => void,
  ) => {
    realtimeMock.channel = channel;
    realtimeMock.handler = handler;
    return { connectionState: realtimeMock.state, lastEvent: null };
  },
}));

function renderPage() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <BacktestsPage />
    </QueryClientProvider>,
  );
}

describe("BacktestsPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    localStorage.clear();
    realtimeMock.channel = null;
    realtimeMock.handler = null;
    realtimeMock.state = "connected";
    vi.mocked(listAlgorithms).mockResolvedValue({
      items: [
        {
          key: "platform_demo",
          display_name: "Platform Demo",
          description: "Synthetic platform fixture",
          code_version: "1.0.0-platform-demo",
          schema_version: 1,
          active: true,
          supported_modes: ["PLATFORM_DEMO"],
          required_capabilities: ["price_candles"],
          fixed_rules: { synthetic: true },
          documentation: {
            purpose: "Fixture",
            lifecycle_status: "synthetic_fixture",
            safety_notice: "Synthetic",
            limitations: [],
            inputs: [],
            logic_steps: [],
            outputs: [],
            diagnostic_schema_version: "1",
            rule_register_version: "stockbot.rule-register.v1",
            rules: [],
          },
          templates: [],
        },
      ],
    });
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
            id: "dataset-version",
            version_number: 1,
            status: "WARNING",
            checksum: "a".repeat(64),
            row_count: 18312,
            session_count: 245,
            coverage_start: "2025-07-21T09:15:00+05:30",
            coverage_end: "2026-07-17T15:25:00+05:30",
            created_at: "2026-08-02T00:00:00Z",
            original_filename: "nifty.csv",
            validation_progress: 100,
            warning_count: 1,
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
    vi.mocked(listAlgorithmVersions).mockResolvedValue({
      items: [
        {
          id: "algorithm-version",
          algorithm_key: "platform_demo",
          version_number: 1,
          name: "Default platform demo",
          notes: null,
          parent_version_id: null,
          code_version: "1.0.0-platform-demo",
          schema_version: 1,
          parameters: { signal_every_n_candles: 12, hold_candles: 6 },
          creator_context: {},
          archived: false,
          archived_at: null,
          created_at: "2026-08-02T00:00:00Z",
        },
      ],
    });
    vi.mocked(listSignals).mockResolvedValue({ items: [], next_cursor: null });
    vi.mocked(listRunEvents).mockResolvedValue({
      items: [],
      next_cursor: null,
    });
    vi.mocked(listTrades).mockResolvedValue({
      items: [],
      next_cursor: null,
    });
    vi.mocked(listEquity).mockResolvedValue({
      items: [],
      next_cursor: null,
    });
  });

  it("restores an active run after refresh and refetches REST truth on a terminal event", async () => {
    const activeRun = {
      id: "22222222-2222-4222-8222-222222222222",
      algorithm_version_id: "algorithm-version",
      cancellation_requested: false,
      completed_at: null,
      created_at: "2026-01-02T09:00:00+05:30",
      dataset_version_id: "dataset-version",
      end_date: "2026-01-02",
      error_code: null,
      error_message: null,
      mode: "PLATFORM_DEMO",
      progress: 40,
      snapshot: { synthetic: true, unit: "DEMO_UNITS" },
      start_date: "2026-01-02",
      started_at: "2026-01-02T09:01:00+05:30",
      starting_capital: "100000.00",
      status: "RUNNING",
    };
    localStorage.setItem("stockbot.activeBacktestRunId", activeRun.id);
    realtimeMock.state = "reconnecting";
    vi.mocked(getBacktest).mockResolvedValue(activeRun);
    vi.mocked(getMetrics).mockResolvedValue({
      run_id: activeRun.id,
      metrics: {},
    });

    renderPage();
    expect(await screen.findByText(/Progress: 40%/)).toBeVisible();
    expect(realtimeMock.channel).toBe(`backtest:${activeRun.id}`);
    expect(
      screen.getByText(
        "Live updates reconnecting; REST recovery remains active",
      ),
    ).toBeVisible();

    realtimeMock.handler?.({
      contract_version: "1.2.0",
      event_id: "event-terminal",
      sequence: 5,
      type: "backtest.completed",
      channel: `backtest:${activeRun.id}`,
      timestamp: "2026-01-02T11:00:00+05:30",
      data: {
        run_id: activeRun.id,
        mode: "PLATFORM_DEMO",
        synthetic: true,
      },
    });
    await waitFor(() => expect(getBacktest).toHaveBeenCalledTimes(2));
    expect(localStorage.getItem("stockbot.activeBacktestRunId")).toBeNull();
  });

  it("labels the screen platform-demo and keeps warning acknowledgement visible", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "Backtests" }),
    ).toBeVisible();
    expect(screen.getByText(/outputs are not trading signals/i)).toBeVisible();
    const datasetSelect = await screen.findByRole("combobox", {
      name: "Dataset version",
    });
    fireEvent.click(datasetSelect);
    const option = await screen.findByRole("option", {
      name: /NIFTY · aaaaaaaaaaaa · WARNING/,
    });
    fireEvent.click(option);
    expect(
      await screen.findByText(/I acknowledge the dataset warnings/i),
    ).toBeVisible();
  });

  it("shows immutable inputs before synthetic demo outcomes and expands two placeholder legs", async () => {
    vi.mocked(preflightBacktest).mockResolvedValue({
      allowed: true,
      acknowledgement_required: true,
      coverage_digest: "a".repeat(64),
      coverage_status: "COMPLETE",
      requested_session_count: 1,
      included_session_count: 1,
      excluded_session_count: 0,
      algorithm_version_id: "algorithm-version",
      dataset_version_id: "dataset-version",
      estimated_row_count: 10,
      issues: [],
      missing_capabilities: [],
      mode: "PLATFORM_DEMO",
      requested_end_date: "2026-01-02",
      requested_start_date: "2026-01-02",
      required_capabilities: ["price_candles"],
      usable_session_count: 1,
      warnings: [],
    });
    const completedRun = {
      id: "11111111-1111-4111-8111-111111111111",
      algorithm_version_id: "algorithm-version",
      cancellation_requested: false,
      completed_at: "2026-01-02T11:00:00+05:30",
      created_at: "2026-01-02T09:00:00+05:30",
      dataset_version_id: "dataset-version",
      end_date: "2026-01-02",
      error_code: null,
      error_message: null,
      mode: "PLATFORM_DEMO",
      progress: 100,
      snapshot: {
        assumptions: { demo_execution: { fixture: true } },
        algorithm: {
          parameters: { hold_candles: 3, signal_every_n_candles: 5 },
        },
        synthetic: true,
        unit: "DEMO_UNITS",
      },
      start_date: "2026-01-02",
      started_at: "2026-01-02T09:01:00+05:30",
      starting_capital: "100000.00",
      status: "COMPLETED",
    };
    vi.mocked(startBacktest).mockResolvedValue(completedRun);
    vi.mocked(getBacktest).mockResolvedValue(completedRun);
    vi.mocked(getMetrics).mockResolvedValue({
      run_id: completedRun.id,
      metrics: {
        total_trades: 1,
        wins: 1,
        losses: 0,
        expectancy_demo_units: "2.50",
        max_drawdown_demo_units: "-0.50",
        processed_candles: 10,
      },
    });
    vi.mocked(listTrades)
      .mockResolvedValueOnce({
        items: [
          {
            id: "trade-1",
            sequence: 1,
            entry_timestamp: "2026-01-02T09:20:00+05:30",
            exit_timestamp: "2026-01-02T09:35:00+05:30",
            exit_reason: "DEMO_HOLD_COMPLETE",
            quantity: "1",
            entry_reference: "100.00",
            exit_reference: "102.50",
            gross_demo_units: "2.50",
            costs_demo_units: "0",
            net_demo_units: "2.50",
            synthetic: true,
            unit: "DEMO_UNITS",
            financial_pnl_available: false,
            assumptions: {},
            legs: [
              {
                id: "leg-1",
                leg_number: 1,
                name: "DEMO_LEG_A",
                entry_reference: "100.00",
                exit_reference: "102.50",
                demo_units: "2.50",
                synthetic: true,
                unit: "DEMO_UNITS",
                financial_pnl_available: false,
              },
              {
                id: "leg-2",
                leg_number: 2,
                name: "DEMO_LEG_B",
                entry_reference: "100.00",
                exit_reference: "102.50",
                demo_units: "0.00",
                synthetic: true,
                unit: "DEMO_UNITS",
                financial_pnl_available: false,
              },
            ],
          },
        ],
        next_cursor: 1,
      })
      .mockResolvedValueOnce({ items: [], next_cursor: null });
    vi.mocked(listEquity).mockResolvedValue({
      items: [
        {
          id: "equity-1",
          sequence: 1,
          timestamp: "2026-01-02T09:35:00+05:30",
          equity_demo_units: "2.50",
          drawdown_demo_units: "0.00",
          synthetic: true,
          unit: "DEMO_UNITS",
          financial_pnl_available: false,
        },
      ],
      next_cursor: null,
    });

    renderPage();

    const datasetSelect = await screen.findByRole("combobox", {
      name: "Dataset version",
    });
    fireEvent.click(datasetSelect);
    const datasetOption = await screen.findByRole("option", {
      name: /NIFTY · aaaaaaaaaaaa · WARNING/,
    });
    fireEvent.click(datasetOption);

    fireEvent.click(
      await screen.findByRole("checkbox", {
        name: /I acknowledge the dataset warnings/i,
      }),
    );

    const algoSelect = screen.getByRole("combobox", {
      name: "Algorithm version",
    });
    fireEvent.click(algoSelect);
    const algoOption = await screen.findByRole("option", {
      name: "Default platform demo",
    });
    fireEvent.click(algoOption);
    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "2026-01-02" },
    });
    fireEvent.change(screen.getByLabelText("End date"), {
      target: { value: "2026-01-02" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review preflight" }));
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Start platform-demo backtest",
      }),
    );

    const immutableHeading = await screen.findByRole("heading", {
      name: "Immutable run inputs",
    });
    const summaryHeading = screen.getByRole("heading", {
      name: "Demo summary",
    });
    expect(
      immutableHeading.compareDocumentPosition(summaryHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText(/Financial P&L unavailable/i)).toBeVisible();
    expect(
      screen.getByText('{"hold_candles":3,"signal_every_n_candles":5}'),
    ).toBeVisible();
    expect(
      (await screen.findAllByText("2.50 DEMO_UNITS")).length,
    ).toBeGreaterThan(0);
    fireEvent.click(await screen.findByText(/Trade 1 · 2.50 DEMO_UNITS/i));
    expect(screen.getByText("DEMO_LEG_A")).toBeVisible();
    expect(screen.getByText("DEMO_LEG_B")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Two placeholder legs" }),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Load more synthetic trades" }),
    );
    await waitFor(() =>
      expect(listTrades).toHaveBeenCalledWith(completedRun.id, 1),
    );
  });
});
