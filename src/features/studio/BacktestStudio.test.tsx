import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  listAlgorithms,
  listAlgorithmVersions,
  type Algorithm,
  type AlgorithmVersion,
} from "../../api/algorithms";
import {
  getBacktest,
  getLiveRunSnapshot,
  getMetrics,
  listEquity,
  listRunEvents,
  listSignalsInRange,
  listTrades,
  preflightBacktest,
  type BacktestPreflight,
  type BacktestRun,
  type LiveRunSnapshot,
} from "../../api/backtests";
import { listDatasets, type DatasetSummary } from "../../api/datasets";
import { BacktestStudio } from "./BacktestStudio";

vi.mock("../../api/algorithms", () => ({
  listAlgorithms: vi.fn(),
  listAlgorithmVersions: vi.fn(),
}));

vi.mock("../../api/datasets", () => ({
  listDatasets: vi.fn(),
  getDatasetCandles: vi.fn().mockResolvedValue({
    candles: [],
    dataset_version_id: "ver-1",
    total_returned: 0,
  }),
}));

vi.mock("../../api/backtests", () => ({
  cancelBacktest: vi.fn(),
  getBacktest: vi.fn(),
  getLiveRunSnapshot: vi.fn(),
  getMetrics: vi.fn(),
  listEquity: vi.fn(),
  listRunEvents: vi.fn(),
  listSignalsInRange: vi.fn(),
  listTrades: vi.fn(),
  preflightBacktest: vi.fn(),
  startBacktest: vi.fn(),
}));

vi.mock("../../realtime/useRealtimeChannel", () => ({
  useRealtimeChannel: vi.fn(() => ({ connectionState: "connected" })),
}));

const mockDataset: DatasetSummary = {
  id: "ds-1",
  name: "NIFTY 50",
  description: "Test dataset",
  source: "TEST",
  created_at: "2026-01-01T00:00:00Z",
  version_count: 1,
  latest_version: {
    id: "dsv-1",
    version_number: 1,
    status: "VALID",
    checksum: "abc",
    row_count: 5000,
    session_count: 50,
    coverage_start: "2026-01-01T09:15:00+05:30",
    coverage_end: "2026-01-31T15:30:00+05:30",
    created_at: "2026-01-01T00:00:00Z",
    original_filename: "nifty.csv",
    validation_progress: 100,
    warning_count: 0,
    error_count: 0,
    timezone: "Asia/Kolkata",
    resolution_minutes: 5,
    capabilities: { price_candles: true },
  },
};

const mockAlgorithm: Algorithm = {
  key: "platform_demo",
  display_name: "Platform Demo",
  description: "Deterministic fixture",
  code_version: "1.0.0-demo",
  schema_version: 1,
  active: true,
  supported_modes: ["PLATFORM_DEMO"],
  required_capabilities: ["price_candles"],
  fixed_rules: { live_trading_approved: false },
  documentation: {
    purpose: "Demo",
    lifecycle_status: "active",
    safety_notice: "Notice",
    limitations: [],
    inputs: [],
    logic_steps: [],
    outputs: [],
    diagnostic_schema_version: "1",
    rule_register_version: "stockbot.rule-register.v1",
    rules: [],
  },
  templates: [],
};

const mockVersion: AlgorithmVersion = {
  id: "algv-1",
  algorithm_key: "platform_demo",
  version_number: 1,
  name: "Default Config",
  notes: "Test version",
  created_at: "2026-01-01T00:00:00Z",
  archived: false,
  archived_at: null,
  code_version: "1.0.0-demo",
  creator_context: {},
  parent_version_id: null,
  schema_version: 1,
  parameters: {},
};

function renderStudio(initialEntry = "/studio") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/studio" element={<BacktestStudio />} />
          <Route
            path="/backtests/:id"
            element={<div>Detailed Result Page</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("BacktestStudio (Phase 21 Guided Backtest Studio)", () => {
  beforeEach(() => {
    vi.mocked(listDatasets).mockResolvedValue({
      items: [mockDataset],
      next_cursor: null,
      total_count: 1,
    });
    vi.mocked(listAlgorithms).mockResolvedValue({ items: [mockAlgorithm] });
    vi.mocked(listAlgorithmVersions).mockResolvedValue({
      items: [mockVersion],
    });
    vi.mocked(listSignalsInRange).mockResolvedValue({
      items: [],
      next_cursor: null,
    });
    vi.mocked(listTrades).mockResolvedValue({ items: [], next_cursor: null });
    vi.mocked(listEquity).mockResolvedValue({ items: [], next_cursor: null });
    vi.mocked(listRunEvents).mockResolvedValue({
      items: [],
      next_cursor: null,
    });
    vi.mocked(getMetrics).mockResolvedValue({
      run_id: "run-1",
      metrics: {
        processed_candles: 100,
        accepted_signals: 5,
        total_trades: 2,
        wins: 1,
        losses: 1,
        net_outcome: 50.0,
        max_drawdown_demo_units: 10.0,
      },
    });
  });

  it("renders configuration mode when no runId is present and allows preflight", async () => {
    const preflightResult: BacktestPreflight = {
      allowed: true,
      acknowledgement_required: false,
      coverage_digest: "a".repeat(64),
      coverage_status: "COMPLETE",
      requested_session_count: 5,
      included_session_count: 5,
      excluded_session_count: 0,
      algorithm_version_id: "algv-1",
      dataset_version_id: "dsv-1",
      estimated_row_count: 500,
      usable_session_count: 5,
      issues: [],
      missing_capabilities: [],
      mode: "PLATFORM_DEMO",
      warnings: [],
      requested_end_date: "2026-01-31",
      requested_start_date: "2026-01-01",
      required_capabilities: ["price_candles"],
    };
    vi.mocked(preflightBacktest).mockResolvedValue(preflightResult);

    renderStudio("/studio");

    expect(
      await screen.findByRole("heading", { name: "Configure & run backtest" }),
    ).toBeVisible();
    expect(screen.getByText("01 · Dataset & Range")).toBeVisible();
    expect(screen.getByText("02 · Algorithm Version")).toBeVisible();
    expect(screen.getByText("03 · Run Context")).toBeVisible();

    const preflightBtn = screen.getByRole("button", {
      name: /Review Preflight/i,
    });
    await screen.findByDisplayValue("2026-01-01");
    expect(preflightBtn).toBeEnabled();

    fireEvent.click(preflightBtn);

    expect(
      await screen.findByText("Ready for a durable demo run"),
    ).toBeVisible();
    expect(
      screen.getByText(/5 eligible sessions · 500 estimated candles/i),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Launch Backtest/i }),
    ).toBeVisible();
  });

  it("explains an incompatible derivatives range and offers a supported session", async () => {
    vi.mocked(preflightBacktest).mockResolvedValue({
      allowed: false,
      acknowledgement_required: false,
      coverage_digest: "b".repeat(64),
      coverage_status: "BLOCKED",
      requested_session_count: 5,
      included_session_count: 0,
      excluded_session_count: 5,
      algorithm_version_id: "algv-1",
      dataset_version_id: "dsv-1",
      estimated_row_count: 500,
      usable_session_count: 5,
      issues: [
        {
          code: "DERIVATIVES_BUNDLE_PREFLIGHT_FAILED",
          message: "The derivatives bundle cannot support the selected range.",
          details: {
            reason:
              "Required CE strikes are missing for 2026-01-12 at ATM 25000.",
            recommended_range: {
              start_date: "2025-10-14",
              end_date: "2025-10-17",
              session_count: 4,
            },
          },
        },
      ],
      missing_capabilities: [],
      mode: "OPTION_SPREAD_SIMULATION",
      warnings: [],
      requested_end_date: "2026-01-31",
      requested_start_date: "2026-01-01",
      required_capabilities: ["option_ohlc"],
    });

    renderStudio("/studio");
    await screen.findByDisplayValue("2026-01-01");
    fireEvent.click(screen.getByRole("button", { name: /Review Preflight/i }));

    expect(
      await screen.findByText(
        /Required CE strikes are missing for 2026-01-12/i,
      ),
    ).toBeVisible();
    const suggestion = screen.getByRole("button", {
      name: /Use longest supported range: 2025-10-14 → 2025-10-17/i,
    });
    fireEvent.click(suggestion);
    expect(screen.getByDisplayValue("2025-10-14")).toBeVisible();
    expect(screen.getByDisplayValue("2025-10-17")).toBeVisible();
  });

  it("renders collapsed inputs, sticky run bar, and live monitoring when runId is present", async () => {
    const runResult: BacktestRun = {
      id: "run-12345678",
      algorithm_version_id: "algv-1",
      dataset_version_id: "dsv-1",
      cancellation_requested: false,
      completed_at: null,
      created_at: "2026-01-01T09:00:00+05:30",
      end_date: "2026-01-31",
      error_code: null,
      error_message: null,
      mode: "PLATFORM_DEMO",
      progress: 65,
      snapshot: { algorithm: { code_version: "1.0.0-demo" } },
      start_date: "2026-01-01",
      started_at: "2026-01-01T09:01:00+05:30",
      starting_capital: "100000.00",
      status: "RUNNING",
    };
    vi.mocked(getBacktest).mockResolvedValue(runResult);

    const snapshotResult: LiveRunSnapshot = {
      run_id: "run-12345678",
      processed_candles: 325,
      total_candles: 500,
      latest_signal_sequence: 12,
      latest_trade_sequence: 4,
      latest_equity_sequence: 50,
      latest_event_sequence: 80,
      last_processed_candle_at: "2026-01-15T15:30:00+05:30",
      status: "RUNNING",
      checkpointed_at: "2026-01-15T15:30:00+05:30",
      financial_pnl_available: false,
      progress: 65,
      synthetic: true,
      unit: "DEMO_UNITS",
    };
    vi.mocked(getLiveRunSnapshot).mockResolvedValue(snapshotResult);

    renderStudio("/studio?run=run-12345678");

    expect(
      await screen.findByRole("heading", {
        name: "Live execution & monitoring",
      }),
    ).toBeVisible();

    // Check collapsed inputs summary
    expect(screen.getByText("Inspect inputs")).toBeVisible();
    fireEvent.click(screen.getByText("Inspect inputs"));
    expect(screen.getByText("Dataset Version ID")).toBeVisible();

    // Check sticky run bar
    expect(screen.getByText("RUNNING")).toBeVisible();
    expect(screen.getByText("Run #run-1234")).toBeVisible();
    expect(screen.getByText("65%")).toBeVisible();
    expect(screen.getByText("325 / 500 candles")).toBeVisible();
    expect(screen.getByRole("button", { name: /Cancel run/i })).toBeVisible();

    // Check tabs
    expect(
      screen.getByRole("button", { name: /Live Activity/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Technical Details/i }),
    ).toBeVisible();

    // Switch to Technical Details tab
    fireEvent.click(screen.getByRole("button", { name: /Technical Details/i }));
    expect(screen.getByText("Linked Inspection Range")).toBeVisible();
    expect(screen.getByText("Signal Sequence")).toBeVisible();
    expect(screen.getByText("Durable Telemetry Log")).toBeVisible();
  });

  it("transitions cleanly to outcome summary and full results link on completion", async () => {
    const runComplete: BacktestRun = {
      id: "run-complete-99",
      algorithm_version_id: "algv-1",
      dataset_version_id: "dsv-1",
      cancellation_requested: false,
      completed_at: "2026-01-31T15:30:00+05:30",
      created_at: "2026-01-01T09:00:00+05:30",
      end_date: "2026-01-31",
      error_code: null,
      error_message: null,
      mode: "PLATFORM_DEMO",
      progress: 100,
      snapshot: { algorithm: { code_version: "1.0.0-demo" } },
      start_date: "2026-01-01",
      started_at: "2026-01-01T09:01:00+05:30",
      starting_capital: "100000.00",
      status: "COMPLETED",
      outcome_summary: {
        trade_count: 8,
        wins: 6,
        losses: 2,
        net_outcome: "1250.50",
        max_drawdown_amount: "120.00",
        mode: "PLATFORM_DEMO",
        unit: "DEMO_UNITS",
        synthetic: true,
        financial_pnl_available: false,
      },
    };
    vi.mocked(getBacktest).mockResolvedValue(runComplete);

    const snapshotComplete: LiveRunSnapshot = {
      run_id: "run-complete-99",
      processed_candles: 500,
      total_candles: 500,
      latest_signal_sequence: 20,
      latest_trade_sequence: 8,
      latest_equity_sequence: 100,
      latest_event_sequence: 150,
      last_processed_candle_at: "2026-01-31T15:30:00+05:30",
      status: "COMPLETED",
      checkpointed_at: "2026-01-31T15:30:00+05:30",
      financial_pnl_available: false,
      progress: 100,
      synthetic: true,
      unit: "DEMO_UNITS",
    };
    vi.mocked(getLiveRunSnapshot).mockResolvedValue(snapshotComplete);

    renderStudio("/studio?run=run-complete-99");

    expect(
      await screen.findByText("Deterministic Backtest Finished Successfully"),
    ).toBeVisible();
    expect(screen.getByText("+1250.50 DEMO")).toBeVisible();
    expect(screen.getByText("+120.00 DEMO")).toBeVisible();
    expect(screen.getByText("8 (6W / 2L)")).toBeVisible();

    const resultsLink = screen.getByRole("link", {
      name: /View Full Results & Trade Breakdown/i,
    });
    expect(resultsLink).toHaveAttribute("href", "/backtests/run-complete-99");
  });
});
