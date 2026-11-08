import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { getSignalDetail } from "../../api/backtests";
import { SignalDecisionPanel } from "./SignalDecisionPanel";

vi.mock("../../api/backtests", () => ({ getSignalDetail: vi.fn() }));
vi.mock("../../api/system", () => ({
  ApiError: class ApiError extends Error {},
}));

describe("SignalDecisionPanel", () => {
  it("renders backend-provided evidence and navigates without recalculating it", async () => {
    const nextId = "22222222-2222-4222-8222-222222222222";
    const tradeId = "66666666-6666-4666-8666-666666666666";
    const selectSignal = vi.fn();
    const selectTrade = vi.fn();
    vi.mocked(getSignalDetail).mockResolvedValue({
      signal: {
        id: "11111111-1111-4111-8111-111111111111",
        sequence: 4,
        timestamp: "2026-01-02T09:30:00+05:30",
        session_date: "2026-01-02",
        decision: "ACCEPTED",
        rejection_reason: null,
        window: "platform_demo",
        score: 1,
        inputs: {},
        entry_trade_ids: [],
      },
      run_identity: {
        run_id: "33333333-3333-4333-8333-333333333333",
        dataset_version_id: "44444444-4444-4444-8444-444444444444",
        algorithm_version_id: "55555555-5555-4555-8555-555555555555",
        algorithm_key: "platform_demo",
        code_version: "1.0.0-platform-demo",
        mode: "PLATFORM_DEMO",
        synthetic: true,
        unit: "DEMO_UNITS",
        financial_pnl_available: false,
      },
      diagnostic: {
        schema_version: "signal-diagnostic-v1",
        algorithm_key: "platform_demo",
        code_version: "1.0.0-platform-demo",
        parameter_version_id: "version-1",
        algorithm_logic_document_version: "1",
        decision: "ACCEPTED",
        primary_reason: "ACCEPTED",
        window: "platform_demo",
        score: 1,
        market_context: [
          {
            key: "close",
            label: "Completed candle close",
            exact_value: 101,
            display_unit: null,
            source: "dataset",
            available: true,
          },
        ],
        evaluation_steps: [
          {
            step_id: "fixture_decision:2",
            logic_step_id: "fixture_decision",
            order: 2,
            kind: "decision",
            label: "Apply deterministic interval",
            status: "passed",
            observed_value: 2,
            comparator: "every_n_candles",
            threshold_value: 2,
            unit: "candles",
            score_contribution: 1,
            reason_code: "ACCEPTED",
            evidence: { remaining_hold_candles_before_decision: 0 },
            experimental: true,
          },
        ],
        parameter_snapshot: { signal_every_n_candles: 2, hold_candles: 1 },
        related_trade_id: null,
        limitations: ["Synthetic fixture only."],
      },
      structured_explanation_available: true,
      raw_evidence: null,
      limitations: ["Synthetic fixture only."],
      previous_signal_id: null,
      next_signal_id: nextId,
      related_trade: {
        id: tradeId,
        sequence: 3,
        entry_timestamp: "2026-01-02T09:30:00+05:30",
        exit_timestamp: "2026-01-02T09:35:00+05:30",
        exit_reason: "DEMO_HOLD_COMPLETE",
        net_demo_units: "1",
        synthetic: true,
        unit: "DEMO_UNITS",
        financial_pnl_available: false,
      },
    });

    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <MemoryRouter
          initialEntries={["/backtests/run?selection=signal&record=111"]}
        >
          <SignalDecisionPanel
            runId="33333333-3333-4333-8333-333333333333"
            signalId="11111111-1111-4111-8111-111111111111"
            onClose={vi.fn()}
            onSelectSignal={selectSignal}
            onSelectTrade={selectTrade}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByText("Signal decision evidence"),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Apply deterministic interval"),
    ).toBeInTheDocument();
    expect(screen.getByText("Observed:", { exact: false })).toHaveTextContent(
      "2 every_n_candles 2 candles",
    );

    screen.getByRole("button", { name: /next signal/i }).click();
    await waitFor(() => expect(selectSignal).toHaveBeenCalledWith(nextId));

    screen.getByRole("button", { name: /inspect linked trade/i }).click();
    expect(selectTrade).toHaveBeenCalledWith(tradeId);
  });

  it("shows limited raw evidence rather than inventing an explanation for older signals", async () => {
    vi.mocked(getSignalDetail).mockResolvedValue({
      signal: {
        id: "11111111-1111-4111-8111-111111111111",
        sequence: 1,
        timestamp: "2026-01-02T09:30:00+05:30",
        session_date: "2026-01-02",
        decision: "REJECTED",
        rejection_reason: "FIXTURE_INTERVAL_NOT_MET",
        window: "platform_demo",
        score: 0,
        inputs: { session_candle_number: 1 },
        entry_trade_ids: [],
      },
      run_identity: {
        run_id: "33333333-3333-4333-8333-333333333333",
        dataset_version_id: "44444444-4444-4444-8444-444444444444",
        algorithm_version_id: "55555555-5555-4555-8555-555555555555",
        algorithm_key: "platform_demo",
        code_version: "1.0.0-platform-demo",
        mode: "PLATFORM_DEMO",
        synthetic: true,
        unit: "DEMO_UNITS",
        financial_pnl_available: false,
      },
      diagnostic: null,
      structured_explanation_available: false,
      raw_evidence: { session_candle_number: 1 },
      limitations: ["No structured diagnostic was stored."],
      previous_signal_id: null,
      next_signal_id: null,
      related_trade: null,
    });

    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <MemoryRouter>
          <SignalDecisionPanel
            runId="33333333-3333-4333-8333-333333333333"
            signalId="11111111-1111-4111-8111-111111111111"
            onClose={vi.fn()}
            onSelectSignal={vi.fn()}
            onSelectTrade={vi.fn()}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByText("Limited historical evidence"),
    ).toBeInTheDocument();
    expect(screen.getByText(/session_candle_number/)).toHaveTextContent("1");
    expect(screen.queryByText("Evaluation flow")).not.toBeInTheDocument();
  });

  it("shows an accepted strategy signal with a separate option entry rejection", async () => {
    vi.mocked(getSignalDetail).mockResolvedValue({
      signal: {
        id: "11111111-1111-4111-8111-111111111111",
        sequence: 7,
        timestamp: "2026-01-02T10:00:00+05:30",
        session_date: "2026-01-02",
        decision: "ACCEPTED",
        rejection_reason: null,
        window: "window_1",
        score: 5,
        inputs: {},
        entry_trade_ids: [],
      },
      run_identity: {
        run_id: "33333333-3333-4333-8333-333333333333",
        dataset_version_id: "44444444-4444-4444-8444-444444444444",
        algorithm_version_id: "55555555-5555-4555-8555-555555555555",
        algorithm_key: "bull_call_spread",
        code_version: "1.2.0-bull-call-spread-v1",
        mode: "OPTION_SPREAD_SIMULATION",
        synthetic: false,
        unit: "INR",
        financial_pnl_available: true,
      },
      diagnostic: null,
      structured_explanation_available: false,
      raw_evidence: {},
      limitations: [],
      previous_signal_id: null,
      next_signal_id: null,
      related_trade: null,
      execution_rejection: {
        timestamp: "2026-01-02T10:00:00+05:30",
        reason: "NET_DEBIT_CAP_EXCEEDED",
        details: { attempted_widths: [200, 250] },
      },
    });

    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <MemoryRouter>
          <SignalDecisionPanel
            runId="33333333-3333-4333-8333-333333333333"
            signalId="11111111-1111-4111-8111-111111111111"
            onClose={vi.fn()}
            onSelectSignal={vi.fn()}
            onSelectTrade={vi.fn()}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Option entry rejected")).toBeVisible();
    expect(screen.getByText("NET_DEBIT_CAP_EXCEEDED")).toBeVisible();
    expect(screen.getByText(/Accepted signal/i)).toBeVisible();
  });
});
