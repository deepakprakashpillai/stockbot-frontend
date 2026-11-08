import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import {
  createCompleteExport,
  downloadCompleteExport,
  getCompleteExport,
} from "../../api/backtests";
import { Button } from "../../components/ui/button";

export function ExportLogsButton({
  runId,
  format = "XLSX",
}: {
  runId: string;
  format?: "XLSX" | "ZIP";
}) {
  const started = useMutation({
    mutationFn: () => createCompleteExport(runId, format),
  });
  const job = useQuery({
    queryKey: ["run-log-export", runId, started.data?.id],
    queryFn: () => getCompleteExport(started.data!.id),
    enabled: Boolean(started.data?.id),
    refetchInterval: (query) =>
      query.state.data?.status === "COMPLETED" ||
      query.state.data?.status === "FAILED"
        ? false
        : 1500,
  });
  const download = useMutation({
    mutationFn: () => downloadCompleteExport(job.data!.id, format),
    onSuccess: ({ blob, filename }) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  });
  const downloaded = useRef<string | null>(null);
  const { mutate: downloadFile } = download;
  useEffect(() => {
    if (job.data?.download_ready && downloaded.current !== job.data.id) {
      downloaded.current = job.data.id;
      downloadFile();
    }
  }, [job.data?.download_ready, job.data?.id, downloadFile]);
  const busy =
    started.isPending ||
    (Boolean(started.data) &&
      (!job.data ||
        job.data.status === "PENDING" ||
        job.data.status === "RUNNING"));
  const error = started.error || job.error || download.error;
  return (
    <div className="flex max-w-sm flex-col gap-1">
      <Button
        variant={format === "XLSX" ? "default" : "outline"}
        className="gap-2"
        disabled={busy || download.isPending}
        onClick={() =>
          job.data?.download_ready ? download.mutate() : started.mutate()
        }
      >
        <Download className="h-4 w-4" />
        {busy
          ? "Preparing logs…"
          : job.data?.download_ready
            ? `Download ${format === "XLSX" ? "Excel" : "ZIP"}`
            : format === "XLSX"
              ? "Export logs"
              : "Complete archive (ZIP)"}
      </Button>
      <span role="status" className="text-xs text-muted-foreground">
        {busy
          ? "Building the full run export in the background."
          : format === "XLSX"
            ? "Excel · all days and saved decision evidence"
            : "All stored evidence in CSV and JSON"}
      </span>
      {(error || job.data?.status === "FAILED") && (
        <span role="alert" className="text-xs text-destructive">
          {error instanceof Error
            ? error.message
            : job.data?.error_message || "The export failed. Try again."}
          {job.error && (
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => job.refetch()}
            >
              Retry status
            </button>
          )}
        </span>
      )}
    </div>
  );
}
