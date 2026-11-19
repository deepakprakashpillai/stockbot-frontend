import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  analyzeDatasetUpload,
  getDataset,
  getDatasetVersion,
  getLibrarySummary,
  listDatasets,
} from "../../api/datasets";
import { DatasetsPage } from "./DatasetsPage";
import {
  listAlgorithms,
  listAlgorithmVersions,
  getAlgorithmSchema,
  validateAlgorithm,
  saveAlgorithmVersion,
} from "../../api/algorithms";

vi.mock("../../api/algorithms", () => ({
  listAlgorithms: vi.fn(),
  listAlgorithmVersions: vi.fn(),
  getAlgorithmSchema: vi.fn(),
  validateAlgorithm: vi.fn(),
  saveAlgorithmVersion: vi.fn(),
  archiveAlgorithmVersion: vi.fn(),
  getAlgorithm: vi.fn(),
  getAlgorithmUsage: vi.fn(),
  checkCompatibility: vi.fn(),
}));

vi.mock("../../api/datasets", () => ({
  getDataset: vi.fn(),
  getDatasetVersion: vi.fn(),
  getLibrarySummary: vi.fn(),
  listDatasets: vi.fn(),
  preflightRange: vi.fn(),
  analyzeDatasetUpload: vi.fn(),
  commitDatasetUploadSession: vi.fn(),
  discardDatasetUploadSession: vi.fn(),
  uploadDataset: vi.fn(),
  uploadDatasetVersion: vi.fn(),
}));

const version = {
  id: "11111111-1111-4111-8111-111111111111",
  dataset_id: "22222222-2222-4222-8222-222222222222",
  version_number: 1,
  status: "VALID",
  checksum: "a".repeat(64),
  row_count: 100,
  session_count: 2,
  coverage_start: "2026-01-01T09:15:00Z",
  coverage_end: "2026-01-02T15:25:00Z",
  created_at: "2026-01-03T00:00:00Z",
  original_filename: "nifty.csv",
  validation_progress: 100,
  warning_count: 0,
  error_count: 0,
  timezone: "Asia/Kolkata",
  resolution_minutes: 5,
  capabilities: { price_candles: true },
  schema_profile: "nifty_index_candles_v1",
  storage_key: "datasets/nifty.csv",
  instruments: [],
  warnings: [],
  errors: [],
  task_id: null,
  completed_at: "2026-01-03T00:00:00Z",
};

describe("DatasetsPage", () => {
  afterEach(cleanup);

  it("restores the dataset workspace and opens immutable upload in a slideover", async () => {
    vi.mocked(getLibrarySummary).mockResolvedValue({
      dataset_count: 1,
      dataset_version_count: 1,
      status_counts: { VALID: 1 },
      usable_dataset_count: 1,
      warning_dataset_count: 0,
      invalid_dataset_count: 0,
      failed_dataset_count: 0,
      validating_dataset_count: 0,
      total_rows: 100,
      total_sessions: 2,
      coverage_start: version.coverage_start,
      coverage_end: version.coverage_end,
      active_algorithm_count: 1,
      saved_algorithm_version_count: 1,
      archived_algorithm_version_count: 0,
      capabilities: [{ capability: "price_candles", available_versions: 1 }],
    });
    vi.mocked(listDatasets).mockResolvedValue({
      items: [
        {
          id: version.dataset_id,
          name: "NIFTY",
          description: null,
          source: "Fixture",
          created_at: version.created_at,
          version_count: 1,
          latest_version: version,
        },
      ],
      next_cursor: null,
      total_count: 1,
    });
    vi.mocked(getDataset).mockResolvedValue({
      id: version.dataset_id,
      name: "NIFTY",
      description: null,
      source: "Fixture",
      created_at: version.created_at,
      versions: [version],
    });
    vi.mocked(getDatasetVersion).mockResolvedValue(version);
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <MemoryRouter initialEntries={["/library?tab=datasets"]}>
          <DatasetsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(
      await screen.findByRole("heading", { name: "Library" }),
    ).toBeVisible();
    expect(await screen.findByText("Calendar coverage")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Upload dataset/i }));
    expect(
      await screen.findByRole("dialog", { name: "Analyze dataset upload" }),
    ).toBeVisible();
  });

  it("requires explicit analysis before an immutable upload can be committed", async () => {
    vi.mocked(analyzeDatasetUpload).mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      status: "STAGED",
      checksum: "b".repeat(64),
      size_bytes: 123,
      original_filename: "nifty.csv",
      schema_profile: "nifty_index_candles_v1",
      expires_at: "2026-01-03T01:00:00Z",
      headers: ["timestamp", "open"],
      sample_rows: [{ timestamp: "2026-01-01T09:15:00+05:30", open: "100" }],
      issues: [],
      profile: {},
      committed_dataset_id: null,
      committed_version_id: null,
    });
    vi.mocked(getLibrarySummary).mockResolvedValue({
      dataset_count: 0,
      dataset_version_count: 0,
      status_counts: {},
      usable_dataset_count: 0,
      warning_dataset_count: 0,
      invalid_dataset_count: 0,
      failed_dataset_count: 0,
      validating_dataset_count: 0,
      total_rows: 0,
      total_sessions: 0,
      coverage_start: null,
      coverage_end: null,
      active_algorithm_count: 0,
      saved_algorithm_version_count: 0,
      archived_algorithm_version_count: 0,
      capabilities: [],
    });
    vi.mocked(listDatasets).mockResolvedValue({
      items: [],
      next_cursor: null,
      total_count: 0,
    });
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <MemoryRouter initialEntries={["/library?tab=datasets"]}>
          <DatasetsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /Upload dataset/i }),
    );
    expect(
      screen.queryByRole("button", { name: /Commit immutable dataset/i }),
    ).not.toBeInTheDocument();
    const input = screen.getByLabelText("CSV file");
    fireEvent.change(input, {
      target: { files: [new File(["csv"], "nifty.csv", { type: "text/csv" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze CSV" }));
    expect(
      await screen.findByRole("button", { name: /Commit immutable dataset/i }),
    ).toBeVisible();
  });
});

it("saves Model 2 numeric choices and a real boolean through the Library editor", async () => {
  const parameters = {
    wing_width_points: 200,
    slippage_percent: 2,
    vix_state_filter_enabled: false,
  };
  vi.mocked(listAlgorithms).mockResolvedValue({
    items: [
      {
        key: "model2",
        display_name: "Model 2",
        description: "Four-leg historical research",
        code_version: "1-model2",
        schema_version: 1,
        active: true,
        supported_modes: ["OPTION_PORTFOLIO_SIMULATION"],
        required_capabilities: ["model2_bundle_v3"],
        fixed_rules: {},
        templates: [
          {
            key: "primary_200",
            name: "Primary 200",
            description: "Approved research preset",
            experimental: false,
            parameters,
          },
        ],
        documentation: {
          purpose: "Historical research",
          lifecycle_status: "approved_historical_research",
          safety_notice: "Historical only",
          limitations: [],
          inputs: [],
          logic_steps: [],
          outputs: [],
          diagnostic_schema_version: "1",
          rule_register_version: "1",
          rules: [],
        },
      },
    ],
  });
  vi.mocked(listAlgorithmVersions).mockResolvedValue({ items: [] });
  vi.mocked(getAlgorithmSchema).mockResolvedValue({
    algorithm_key: "model2",
    code_version: "1-model2",
    schema_version: 1,
    schema_hash: "a".repeat(64),
    schema: {
      properties: {
        wing_width_points: {
          title: "Wing width",
          type: "integer",
          enum: [150, 200],
        },
        slippage_percent: {
          title: "Slippage percent",
          type: "integer",
          enum: [0, 1, 2],
        },
        vix_state_filter_enabled: {
          title: "Experimental VIX filter",
          type: "boolean",
        },
      },
    },
  });
  vi.mocked(validateAlgorithm).mockResolvedValue({
    valid: true,
    normalized_parameters: null,
    errors: [],
  });
  vi.mocked(saveAlgorithmVersion).mockImplementation(async (key, input) => ({
    id: "saved-model2",
    algorithm_key: key,
    version_number: 3,
    name: input.name,
    notes: input.notes ?? null,
    parent_version_id: null,
    parameters: input.parameters,
    code_version: "1-model2",
    schema_version: 1,
    creator_context: {},
    created_at: "2026-11-17T00:00:00Z",
    archived: false,
    archived_at: null,
  }));
  vi.mocked(listDatasets).mockResolvedValue({
    items: [],
    total_count: 0,
    next_cursor: null,
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter
        initialEntries={[
          "/library?tab=algorithms&algorithm=model2&newVersion=1",
        ]}
      >
        <DatasetsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const template = await screen.findByRole("combobox", { name: "Template" });
  fireEvent.keyDown(template, { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: "Primary 200" }));
  const width = screen.getByRole("combobox", { name: "Wing width" });
  fireEvent.keyDown(width, { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: "150" }));
  const filter = screen.getByRole("checkbox", {
    name: "Experimental VIX filter",
  });
  expect(filter).not.toBeChecked();
  fireEvent.click(filter);
  fireEvent.click(screen.getByRole("button", { name: "Validate" }));
  await waitFor(() =>
    expect(validateAlgorithm).toHaveBeenCalledWith("model2", {
      wing_width_points: 150,
      slippage_percent: 2,
      vix_state_filter_enabled: true,
    }),
  );
  const save = screen.getByRole("button", {
    name: "Save as new immutable version",
  });
  await waitFor(() => expect(save).toBeEnabled());
  fireEvent.click(filter);
  expect(save).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Validate" }));
  await waitFor(() => expect(save).toBeEnabled());
  fireEvent.click(save);
  await waitFor(() =>
    expect(saveAlgorithmVersion).toHaveBeenCalledWith(
      "model2",
      expect.objectContaining({
        parameters: {
          wing_width_points: 150,
          slippage_percent: 2,
          vix_state_filter_enabled: false,
        },
      }),
    ),
  );
  cleanup();
});
