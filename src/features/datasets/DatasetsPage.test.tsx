import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
