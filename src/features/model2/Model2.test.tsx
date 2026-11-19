import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as api from "../../api/model2";
import { listAlgorithms, listAlgorithmVersions } from "../../api/algorithms";
import { listDatasets } from "../../api/datasets";
import { listExecutionAttempts } from "../../api/backtests";
import { Model2Studio } from "./Model2Studio";
import { Model2Dataset } from "./Model2Dataset";
import { ResearchGroupView } from "./ResearchGroupView";
import type { RealtimeEventHandler } from "../../realtime/types";

vi.mock("../../api/model2", () => ({
  preflightResearch: vi.fn(),
  startResearch: vi.fn(),
  getResearchGroup: vi.fn(),
  cancelResearchGroup: vi.fn(),
  listCycles: vi.fn(),
  listRiskEntries: vi.fn(),
  listPortfolioJournal: vi.fn(),
  getAssessment: vi.fn(),
  getScenarioComparison: vi.fn(),
  getCycle: vi.fn(),
  getOptionPosition: vi.fn(),
  getModel2Manifest: vi.fn(),
}));
vi.mock("../../api/algorithms", () => ({
  listAlgorithms: vi.fn(),
  listAlgorithmVersions: vi.fn(),
}));
vi.mock("../../api/datasets", () => ({ listDatasets: vi.fn() }));
vi.mock("../../api/backtests", () => ({
  listExecutionAttempts: vi.fn(),
  listJournalEvents: vi.fn(),
}));
vi.mock("../backtests/ExportLogsButton", () => ({
  ExportLogsButton: () => <button>Export evidence</button>,
}));
const { handlers } = vi.hoisted(() => ({
  handlers: new Map<string, RealtimeEventHandler>(),
}));
vi.mock("../../realtime/useRealtimeChannel", () => ({
  useRealtimeChannel: (channel: string, handler: RealtimeEventHandler) => {
    handlers.set(channel, handler);
    return { connectionState: "degraded" };
  },
}));

function renderView(view: React.ReactNode, path = "/studio") {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <MemoryRouter initialEntries={[path]}>{view}</MemoryRouter>
    </QueryClientProvider>,
  );
}
const policies = [
  "MAX_LOSS_RISK",
  "ZERO_RISK",
  "HALT_AT_FIRST_EXCLUSION",
] as const;
const group = {
  id: "group",
  status: "COMPLETED",
  cancellation_requested: false,
  created_at: "2026-01-06T16:00:00Z",
  completed_at: "2026-01-06T16:00:00Z",
  request_digest: "a".repeat(64),
  snapshot: {},
  members: policies.map((policy, ordinal) => ({
    ordinal,
    policy,
    primary: ordinal === 0,
    scope: ordinal === 2 ? "HALTED_AT_EXCLUSION" : "FULL_REQUESTED_RANGE",
    reliability_status: "UNRELIABLE_DATA",
    priced_cycle_count: 0,
    excluded_cycle_count: 1,
    run: { id: `run${ordinal}`, progress: 100, status: "COMPLETED" },
  })),
} as api.ResearchGroup;
const preflight = {
  excluded_session_count: 0,
  included_session_count: 2,
  requested_session_count: 2,
  excluded_sessions: [],
  allowed: false,
  mode: "OPTION_PORTFOLIO_SIMULATION",
  dataset_version_id: "dataset-version",
  algorithm_version_id: "version",
  requested_start_date: "2026-01-05",
  requested_end_date: "2026-01-06",
  usable_session_count: 2,
  estimated_row_count: 0,
  required_capabilities: ["model2_bundle_v3"],
  missing_capabilities: [],
  acknowledgement_required: true,
  warnings: [{ message: "Assumed margin" }],
  issues: [],
  coverage_status: "PARTIAL",
  coverage_digest: "a".repeat(64),
  cycles: [],
  requested_cycle_count: 1,
  entry_ready_cycle_count: 1,
} as Awaited<ReturnType<typeof api.preflightResearch>>;
beforeEach(() => {
  vi.clearAllMocks();
  handlers.clear();
  vi.mocked(listAlgorithms).mockResolvedValue({ items: [] });
  vi.mocked(listAlgorithmVersions).mockResolvedValue({
    items: [
      {
        id: "version",
        name: "Primary 200",
        version_number: 1,
        archived: false,
      },
    ],
  } as Awaited<ReturnType<typeof listAlgorithmVersions>>);
  vi.mocked(listDatasets).mockResolvedValue({
    total_count: 1,
    items: [
      {
        created_at: "2026-01-01T00:00:00Z",
        description: null,
        source: null,
        version_count: 1,
        id: "dataset",
        name: "Native bundle",
        latest_version: {
          checksum: "a".repeat(64),
          created_at: "2026-01-01T00:00:00Z",
          error_count: 0,
          original_filename: "bundle_manifest.json",
          resolution_minutes: 5,
          row_count: 450,
          session_count: 2,
          status: "VALID",
          timezone: "Asia/Kolkata",
          validation_progress: 100,
          version_number: 1,
          warning_count: 1,
          id: "dataset-version",
          capabilities: { model2_bundle_v3: true },
          coverage_start: "2026-01-05",
          coverage_end: "2026-01-06",
        },
      },
    ],
    next_cursor: null,
  } as Awaited<ReturnType<typeof listDatasets>>);
  vi.mocked(api.preflightResearch).mockImplementation(async (input) => ({
    ...preflight,
    allowed:
      input.warning_acknowledged &&
      input.accepted_coverage_digest === preflight.coverage_digest,
  }));
  vi.mocked(api.startResearch).mockResolvedValue(group);
  vi.mocked(api.getResearchGroup).mockResolvedValue(group);
  vi.mocked(api.listCycles).mockResolvedValue({
    items: [
      {
        attempt_id: "attempt",
        run_id: "run0",
        last_sequence: 20,
        trade_id: null,
        id: "cycle",
        expiry: "2026-01-06",
        entry_date: "2026-01-05",
        state: "EXCLUDED",
        reason: "NO_OFFICIAL_SETTLEMENT",
        payload: { entry: {} },
      },
    ],
    next_cursor: null,
    active_attempt_id: "attempt",
  } as Awaited<ReturnType<typeof api.listCycles>>);
  vi.mocked(api.listRiskEntries).mockResolvedValue({
    items: [
      {
        cycle_id: "cycle",
        booking_date: "2026-01-06",
        source: "ASSUMED_MAX_LOSS",
        risk_amount: "-12620",
        priced_performance_amount: null,
        counters: {},
      },
    ],
    next_cursor: null,
    active_attempt_id: "attempt",
  });
  vi.mocked(api.getAssessment).mockResolvedValue({
    run_id: "run0",
    policy_version: "v1",
    run_status: "COMPLETED",
    scope: "FULL_REQUESTED_RANGE",
    reliability: { status: "UNRELIABLE_DATA" },
    overall_status: "UNRELIABLE_DATA",
    criteria: [],
    summary: {},
    priced_statistics: { net_pnl_inr: null, trade_count: 0 },
    limitations: [],
  });
  vi.mocked(api.getScenarioComparison).mockResolvedValue({
    scenario_populations_are_independent: true,
    group_id: "group",
    items: [
      {
        expiry: "2026-01-06",
        outcomes: policies.map((policy, index) => ({
          policy,
          run_id: `run${index}`,
          cycle_id: "cycle",
          state: index === 2 ? "NOT_VISITED_AFTER_HALT" : "EXCLUDED",
          reason: null,
          priced_net_pnl_inr: null,
          risk_contribution: null,
          scope: null,
        })),
      },
    ],
    next_cursor: null,
  });
  vi.mocked(listExecutionAttempts).mockResolvedValue({
    active_attempt_id: null,
    items: [],
  });
  vi.mocked(api.listPortfolioJournal).mockResolvedValue({
    run_id: "run0",
    attempt_id: "attempt",
    items: [],
    next_cursor: null,
  });
});
afterEach(cleanup);

it("loads the four-leg timeline with pending states and earlier attempt evidence", async () => {
  vi.mocked(listExecutionAttempts).mockResolvedValue({
    active_attempt_id: "current",
    items: [{ id: "earlier", attempt_number: 1, status: "INTERRUPTED" }],
  } as Awaited<ReturnType<typeof listExecutionAttempts>>);
  vi.mocked(api.listPortfolioJournal).mockResolvedValue({
    run_id: "run0",
    attempt_id: "current",
    next_cursor: null,
    items: [
      {
        id: "event",
        run_id: "run0",
        attempt_id: "current",
        created_at: "2026-11-19T10:00:00Z",
        sequence: 1,
        session_date: "2026-01-05",
        signal_sequence: null,
        trade_sequence: null,
        event_type: "OVERNIGHT_PENDING",
        position_state: "EXIT_PENDING",
        timestamp: "2026-01-05T15:30:00+05:30",
        payload: { state: "EXIT_PENDING" },
      },
    ],
  } as Awaited<ReturnType<typeof api.listPortfolioJournal>>);
  renderView(<ResearchGroupView groupId="group" />);
  fireEvent.click(await screen.findByRole("button", { name: "Show timeline" }));
  expect(await screen.findByText(/OVERNIGHT PENDING/)).toBeInTheDocument();
  expect(api.listPortfolioJournal).toHaveBeenCalledWith(
    "run0",
    undefined,
    50,
    undefined,
  );
  fireEvent.change(
    screen.getByRole("combobox", { name: /Execution attempt/ }),
    { target: { value: "earlier" } },
  );
  await waitFor(() =>
    expect(api.listPortfolioJournal).toHaveBeenCalledWith(
      "run0",
      undefined,
      50,
      "earlier",
    ),
  );
});

it("requires both acknowledgements, rechecks the server and invalidates review when capital changes", async () => {
  renderView(<Model2Studio algorithmKey="model2" />);
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Review Preflight" }),
    ).toBeEnabled(),
  );
  expect(screen.getByText(/2 sessions/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Review Preflight" }));
  const start = await screen.findByRole("button", {
    name: "Start all three scenarios",
  });
  expect(start).toBeDisabled();
  fireEvent.click(
    screen.getByLabelText(
      "I acknowledge the listed pricing, margin and data limitations.",
    ),
  );
  expect(start).toBeDisabled();
  fireEvent.click(
    screen.getByLabelText(
      "I accept the exact cycle coverage shown for these inputs.",
    ),
  );
  expect(start).toBeEnabled();
  fireEvent.change(screen.getByLabelText("Research capital (INR)"), {
    target: { value: "600000" },
  });
  expect(
    screen.queryByRole("button", { name: "Start all three scenarios" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Review Preflight" }));
  await screen.findByRole("button", { name: "Start all three scenarios" });
  fireEvent.click(
    screen.getByLabelText(
      "I acknowledge the listed pricing, margin and data limitations.",
    ),
  );
  fireEvent.click(
    screen.getByLabelText(
      "I accept the exact cycle coverage shown for these inputs.",
    ),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Start all three scenarios" }),
  );
  await waitFor(() =>
    expect(api.startResearch).toHaveBeenCalledWith(
      expect.objectContaining({
        starting_capital: "600000",
        warning_acknowledged: true,
        accepted_coverage_digest: preflight.coverage_digest,
      }),
      expect.any(String),
    ),
  );
  expect(api.preflightResearch).toHaveBeenCalledTimes(3);
});

it("keeps unknown P&L separate from assumed loss and shows the halted population", async () => {
  renderView(<ResearchGroupView groupId="group" />);
  expect(
    await screen.findByText("Separate risk-control ledger"),
  ).toBeInTheDocument();
  await screen.findByText("-₹12,620.00");
  expect(screen.getAllByText("Unknown").length).toBeGreaterThan(1);
  expect(screen.getByText("-₹12,620.00")).toBeInTheDocument();
  expect(
    await screen.findByRole("cell", { name: /NOT VISITED AFTER HALT/ }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /Halt at first exclusion/ }),
  ).toHaveTextContent("HALTED AT EXCLUSION");
  fireEvent.click(screen.getByRole("button", { name: /Zero-risk assumption/ }));
  await waitFor(() =>
    expect(api.listCycles).toHaveBeenCalledWith("run1", undefined),
  );
});

it("recovers durable evidence on reconnect and opens all four typed legs", async () => {
  vi.mocked(api.getCycle).mockResolvedValue({
    id: "cycle",
    attempt_id: "attempt",
    run_id: "run0",
    entry_date: "2026-01-05",
    last_sequence: 20,
    trade_id: null,
    payload: { entry: {} },
    expiry: "2026-01-06",
    state: "EXIT_PENDING",
    reason: "OVERNIGHT_PENDING",
  } as Awaited<ReturnType<typeof api.getCycle>>);
  vi.mocked(api.getOptionPosition).mockResolvedValue({
    id: "cycle",
    state: "EXCLUDED",
    expiry: "2026-01-06",
    entry_credit_points: "12",
    finalized_at: null,
    gross_pnl_inr: null,
    trade_id: null,
    margin_source: "ASSUMED",
    priced_performance_included: false,
    entry_at: "2026-01-05T15:20:00+05:30",
    exit_at: null,
    reason: "NO_OFFICIAL_SETTLEMENT",
    net_pnl_inr: null,
    charges_inr: "400",
    maximum_loss_inr: "12620",
    assumed_margin_inr: "18930",
    flags: ["DATA_INCOMPLETE"],
    original_trigger: { reason: "TARGET" },
    legs: ["SHORT_CALL", "LONG_CALL", "SHORT_PUT", "LONG_PUT"].map(
      (role, index) => ({
        role,
        contract_id: `contract-${index}`,
        symbol: `NIFTY-${index}`,
        strike: 25000 + index * 50,
        expiry: "2026-01-06",
        option_type: index < 2 ? "CE" : "PE",
        lot_size: 65,
        quantity: 65,
        tick_size: ".05",
        side: index % 2 ? "BUY" : "SELL",
        entry_reference_price: "50",
        entry_fill_price: "49",
        exit_fill_price: null,
        gross_pnl_inr: null,
      }),
    ),
  } as api.OptionPosition);
  renderView(<ResearchGroupView groupId="group" />);
  const cycleButton = await screen.findByRole("button", {
    name: "Open cycle 2026-01-06",
  });
  cycleButton.focus();
  fireEvent.click(cycleButton);
  expect(
    await screen.findByRole("cell", { name: /contract-3/ }),
  ).toBeInTheDocument();
  expect(screen.getByRole("cell", { name: /contract-0/ })).toBeInTheDocument();
  expect(screen.getByText(/LONG PUT/)).toBeInTheDocument();
  expect(
    screen.getByRole("region", { name: "Four-leg prices" }),
  ).toHaveAttribute("tabindex", "0");
  expect(screen.getByRole("dialog")).toHaveTextContent("No priced exit");
  handlers.get("backtest:run0")?.({
    type: "snapshot_required",
    channel: "backtest:run0",
    after_sequence: 1,
    latest_sequence: 50,
    reason: "reconnect",
  });
  await waitFor(() => expect(api.getResearchGroup).toHaveBeenCalledTimes(2), {
    timeout: 2000,
  });
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  await waitFor(() => expect(cycleButton).toHaveFocus());
});

it("blocks submission when the final server review changes", async () => {
  vi.mocked(api.preflightResearch).mockResolvedValue(preflight);
  renderView(<Model2Studio algorithmKey="model2" />);
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Review Preflight" }),
    ).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Review Preflight" }));
  await screen.findByRole("button", { name: "Start all three scenarios" });
  fireEvent.click(
    screen.getByLabelText(
      "I acknowledge the listed pricing, margin and data limitations.",
    ),
  );
  fireEvent.click(
    screen.getByLabelText(
      "I accept the exact cycle coverage shown for these inputs.",
    ),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Start all three scenarios" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "server requires a new readiness review",
  );
  expect(api.startResearch).not.toHaveBeenCalled();
});

it("shows native bundle provenance without requiring futures or claiming settlement coverage", async () => {
  vi.mocked(api.getModel2Manifest).mockResolvedValue({
    dataset_version_id: "dataset-version",
    input_checksum: "a".repeat(64),
    bundle_checksum: "b".repeat(64),
    calendar_version: "calendar-v1",
    calendar_sha256: "c".repeat(64),
    components: [
      { kind: "options", source_reference: "Preserved provider sample" },
    ],
    official_settlement_available: false,
    halt_source_available: false,
    limitations: ["Opening-price estimates"],
  });
  renderView(<Model2Dataset versionId="dataset-version" />);
  expect(await screen.findByText("calendar-v1")).toBeVisible();
  expect(screen.getByText(/Futures are optional/)).toBeVisible();
  expect(screen.getAllByText("Absent")).toHaveLength(2);
  expect(screen.getByText("Preserved provider sample")).toBeVisible();
});
