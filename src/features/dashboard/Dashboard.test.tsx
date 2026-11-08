import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { listAlgorithms } from "../../api/algorithms";
import {
  getBacktestHistorySummary,
  listBacktests,
  listEquity,
} from "../../api/backtests";
import { getSystemStatus } from "../../api/system";
import { Dashboard } from "./Dashboard";

vi.mock("../../api/algorithms", () => ({ listAlgorithms: vi.fn() }));
vi.mock("../../api/backtests", () => ({
  getBacktestHistorySummary: vi.fn(),
  listBacktests: vi.fn(),
  listEquity: vi.fn(),
}));
vi.mock("../../api/system", () => ({ getSystemStatus: vi.fn() }));
vi.mock("recharts", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ResponsiveContainer: () => <div data-testid="chart" />,
}));

function renderDashboard() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listAlgorithms).mockResolvedValue({ items: [] });
  vi.mocked(listBacktests).mockResolvedValue({
    items: [],
    next_cursor: null,
    total_count: 0,
  });
  vi.mocked(getBacktestHistorySummary).mockResolvedValue({
    total_runs: 0,
    completed_runs: 0,
    failed_runs: 0,
    active_runs: 0,
    status_counts: {},
  } as Awaited<ReturnType<typeof getBacktestHistorySummary>>);
  vi.mocked(getSystemStatus).mockResolvedValue({
    readiness: { status: "ready" },
  } as Awaited<ReturnType<typeof getSystemStatus>>);
});

it("shows a genuinely empty distribution and reports unavailable health", async () => {
  vi.mocked(getSystemStatus).mockRejectedValue(new Error("offline"));
  renderDashboard();
  expect(await screen.findByText("Unavailable")).toBeInTheDocument();
  expect(screen.getByText("No runs recorded")).toBeInTheDocument();
  expect(screen.queryAllByTestId("chart")).toHaveLength(0);
  expect(screen.queryByText("100% Stable")).not.toBeInTheDocument();
});

it("uses server-wide totals and fetches all equity pages for the latest completed run", async () => {
  vi.mocked(getBacktestHistorySummary).mockResolvedValue({
    total_runs: 120,
    completed_runs: 100,
    failed_runs: 10,
    active_runs: 5,
    status_counts: { CANCELLED: 5 },
  } as unknown as Awaited<ReturnType<typeof getBacktestHistorySummary>>);
  vi.mocked(listBacktests).mockImplementation(
    async (filters) =>
      ({
        items:
          filters?.status === "COMPLETED"
            ? [{ id: "latest-completed", mode: "OPTION_SPREAD_SIMULATION" }]
            : [],
        next_cursor: null,
      }) as Awaited<ReturnType<typeof listBacktests>>,
  );
  vi.mocked(listEquity)
    .mockResolvedValueOnce({
      items: [
        {
          timestamp: "2025-07-21T09:20:00+05:30",
          equity_demo_units: "100",
          drawdown_demo_units: "0",
        },
      ],
      next_cursor: 1,
    } as Awaited<ReturnType<typeof listEquity>>)
    .mockResolvedValueOnce({
      items: [
        {
          timestamp: "2025-07-21T15:00:00+05:30",
          equity_demo_units: "90",
          drawdown_demo_units: "-10",
        },
      ],
      next_cursor: null,
    } as Awaited<ReturnType<typeof listEquity>>);
  renderDashboard();
  expect(await screen.findByText("120")).toBeInTheDocument();
  expect(await screen.findByText("Operational")).toBeInTheDocument();
  expect(screen.getByText("Cancelled")).toBeInTheDocument();
  expect(screen.getByRole("note")).toHaveTextContent(
    "Historical INR estimates",
  );
  await waitFor(() =>
    expect(listEquity).toHaveBeenCalledWith("latest-completed", 1),
  );
});
