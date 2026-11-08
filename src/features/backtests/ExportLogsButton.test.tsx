import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCompleteExport,
  downloadCompleteExport,
  getCompleteExport,
} from "../../api/backtests";
import { ExportLogsButton } from "./ExportLogsButton";

vi.mock("../../api/backtests", () => ({
  createCompleteExport: vi.fn(),
  getCompleteExport: vi.fn(),
  downloadCompleteExport: vi.fn(),
}));
const job = {
  id: "job-1",
  run_id: "run-1",
  attempt_id: null,
  format: "XLSX" as const,
  status: "PENDING" as const,
  row_counts: {},
  download_ready: false,
  error_code: null,
  error_message: null,
  sha256: null,
  created_at: "2026-09-19T00:00:00Z",
  completed_at: null,
};
function view() {
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
      <ExportLogsButton runId="run-1" />
    </QueryClientProvider>,
  );
}
describe("Export logs", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(createCompleteExport).mockResolvedValue(job);
  });
  it("prevents duplicate jobs while queued", async () => {
    vi.mocked(getCompleteExport).mockResolvedValue(job);
    view();
    fireEvent.click(screen.getByRole("button", { name: "Export logs" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Preparing logs…" }),
      ).toBeDisabled(),
    );
    expect(createCompleteExport).toHaveBeenCalledWith("run-1", "XLSX");
    expect(downloadCompleteExport).not.toHaveBeenCalled();
  });
  it("downloads the workbook automatically after completion", async () => {
    vi.mocked(getCompleteExport).mockResolvedValue({
      ...job,
      status: "COMPLETED",
      download_ready: true,
    });
    vi.mocked(downloadCompleteExport).mockResolvedValue({
      blob: new Blob(["workbook"]),
      filename: "logs.xlsx",
    });
    URL.createObjectURL = vi.fn(() => "blob:logs");
    URL.revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    view();
    fireEvent.click(screen.getByRole("button", { name: "Export logs" }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(downloadCompleteExport).toHaveBeenCalledWith("job-1", "XLSX");
    expect(
      screen.getByRole("button", { name: "Download Excel" }),
    ).toBeEnabled();
  });
  it("shows worker failure and allows a new export", async () => {
    vi.mocked(getCompleteExport).mockResolvedValue({
      ...job,
      status: "FAILED",
      error_message: "Could not prepare workbook",
    });
    view();
    fireEvent.click(screen.getByRole("button", { name: "Export logs" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not prepare workbook",
    );
    expect(screen.getByRole("button", { name: "Export logs" })).toBeEnabled();
    expect(downloadCompleteExport).not.toHaveBeenCalled();
  });
});
