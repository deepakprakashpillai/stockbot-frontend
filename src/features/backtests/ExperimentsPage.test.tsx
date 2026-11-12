import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import {
  getAlgorithmSchema,
  listAlgorithmVersions,
} from "../../api/algorithms";
import { listDatasets } from "../../api/datasets";
import { preflightExperiment } from "../../api/experiments";
import { ExperimentsPage } from "./ExperimentsPage";

vi.mock("../../api/algorithms", () => ({
  getAlgorithmSchema: vi.fn(),
  listAlgorithmVersions: vi.fn(),
}));
vi.mock("../../api/datasets", () => ({ listDatasets: vi.fn() }));
vi.mock("../../api/backtests", () => ({ preflightBacktest: vi.fn() }));
vi.mock("../../api/experiments", () => ({
  preflightExperiment: vi.fn(),
  createExperiment: vi.fn(),
  getExperiment: vi.fn(),
  startExperiment: vi.fn(),
  unlockExperimentValidation: vi.fn(),
}));

it.each(["1.2.0-bull-call-spread-v1", "1.3.0-bull-call-spread-v1"])(
  "offers baseline %s, excludes fixed rules, and invalidates review after an input changes",
  async (codeVersion) => {
    vi.mocked(listAlgorithmVersions).mockResolvedValue({
      items: [
        {
          id: "corrected",
          version_number: 2,
          name: "Research V1.2",
          code_version: codeVersion,
          archived: false,
        },
        {
          id: "old",
          version_number: 1,
          name: "Old V1.1",
          code_version: "1.1.0-bull-call-spread-v1",
          archived: false,
        },
      ],
    } as Awaited<ReturnType<typeof listAlgorithmVersions>>);
    vi.mocked(listDatasets).mockResolvedValue({
      items: [
        {
          id: "dataset",
          name: "Test market",
          latest_version: { id: "data-v1" },
        },
      ],
      next_cursor: null,
    } as Awaited<ReturnType<typeof listDatasets>>);
    vi.mocked(getAlgorithmSchema).mockResolvedValue({
      algorithm_key: "bull_call_spread",
      code_version: "1.2.0-bull-call-spread-v1",
      schema_hash: "a".repeat(64),
      schema_version: 3,
      schema: {
        properties: {
          lots: { label: "Number of lots", editable: true },
          pdh_weight: { label: "PDH hard gate", editable: false, const: 0 },
        },
      },
    });
    vi.mocked(preflightExperiment).mockResolvedValue({
      allowed: true,
      coverage_digest: "a".repeat(64),
      variants: [
        {
          variant_index: 0,
          included_session_count: 1,
          excluded_sessions: [
            {
              session_date: "2025-07-22",
              reason_code: "SESSION_CLOCK_INCOMPLETE",
            },
          ],
        },
        { variant_index: 1, included_session_count: 1, excluded_sessions: [] },
      ],
      issues: [],
    });
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <MemoryRouter>
          <ExperimentsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(
      await screen.findByRole("option", { name: "v2 · Research V1.2" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Old V1.1/ }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole("option", { name: "Number of lots" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "PDH hard gate" }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Hypothesis"), {
      target: { value: "Quantity sensitivity" },
    });
    for (const [label, value] of [
      ["Development start", "2025-07-21"],
      ["Development end", "2025-07-22"],
      ["Reserved validation start", "2025-08-01"],
      ["Reserved validation end", "2025-08-02"],
    ])
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(
      screen.getByRole("button", { name: /Review development coverage/ }),
    );
    const acknowledge = await screen.findByRole("button", {
      name: "Acknowledge coverage and create plan",
    });
    await waitFor(() => expect(acknowledge).toBeEnabled());
    expect(
      screen.getByText("2025-07-22: session clock incomplete"),
    ).toBeInTheDocument();
    expect(preflightExperiment).toHaveBeenCalledWith(
      expect.objectContaining({
        baseline_algorithm_version_id: "corrected",
        parameter_values: [2],
      }),
    );
    fireEvent.change(screen.getByLabelText("Starting capital"), {
      target: { value: "600000" },
    });
    expect(acknowledge).toBeDisabled();
  },
);
