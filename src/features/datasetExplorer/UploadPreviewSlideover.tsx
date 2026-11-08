import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  analyzeDatasetUpload,
  commitDatasetUploadSession,
  discardDatasetUploadSession,
  type DatasetDetail,
  type DatasetVersion,
} from "../../api/datasets";
import { ApiError } from "../../api/system";
import { Slideover } from "../../components/Slideover";

export function UploadPreviewSlideover({
  isOpen,
  onClose,
  selectedDataset,
  onCommitted,
}: {
  isOpen: boolean;
  onClose: () => void;
  selectedDataset?: DatasetDetail;
  onCommitted: (version: DatasetVersion) => void;
}) {
  const [file, setFile] = useState<File>();
  const [asVersion, setAsVersion] = useState(false);
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [description, setDescription] = useState("");
  const queryClient = useQueryClient();
  const analyze = useMutation({ mutationFn: analyzeDatasetUpload });
  const discard = useMutation({ mutationFn: discardDatasetUploadSession });
  const commit = useMutation({
    mutationFn: () =>
      commitDatasetUploadSession({
        sessionId: analyze.data!.id,
        name:
          name.trim() ||
          selectedDataset?.name ||
          "NIFTY 50 five-minute candles",
        source,
        description,
        datasetId: asVersion ? selectedDataset?.id : undefined,
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["library-datasets"] });
      void queryClient.invalidateQueries({ queryKey: ["library-summary"] });
      onCommitted(result.dataset_version);
    },
  });
  const close = () => {
    if (analyze.data?.status === "STAGED") void discard.mutate(analyze.data.id);
    onClose();
  };
  const blocked = analyze.data?.issues.length;
  return (
    <Slideover
      isOpen={isOpen}
      onClose={close}
      title="Analyze dataset upload"
      size="wide"
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-brand/30 bg-brand/5 p-4 text-sm text-foreground">
          <strong>Preview before commit.</strong> The CSV is uploaded once into
          a short-lived server staging area. No immutable dataset version exists
          until you confirm the analysis below.
        </div>
        {selectedDataset && (
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={asVersion}
              onChange={(event) => setAsVersion(event.target.checked)}
            />{" "}
            Add as a new immutable version of {selectedDataset.name}
          </label>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-muted">
            Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={
                selectedDataset?.name ?? "NIFTY 50 five-minute candles"
              }
              className="mt-1 w-full rounded border border-border bg-surface p-2 text-foreground"
            />
          </label>
          <label className="text-sm text-muted">
            Source
            <input
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder={selectedDataset?.source ?? "Local research file"}
              className="mt-1 w-full rounded border border-border bg-surface p-2 text-foreground"
            />
          </label>
          <label className="sm:col-span-2 text-sm text-muted">
            Notes
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              className="mt-1 w-full rounded border border-border bg-surface p-2 text-foreground"
            />
          </label>
          <label className="sm:col-span-2 text-sm text-muted">
            CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => setFile(event.target.files?.[0])}
              className="mt-1 block w-full text-sm"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={!file || analyze.isPending}
          onClick={() => file && analyze.mutate(file)}
          className="rounded bg-brand px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {analyze.isPending ? "Analyzing…" : "Analyze CSV"}
        </button>
        <div aria-live="polite">
          {analyze.data && (
            <section className="space-y-3 rounded-xl border border-border p-4">
              <p className="m-0 text-xs text-muted">
                {analyze.data.original_filename} ·{" "}
                {(analyze.data.size_bytes / 1024).toFixed(1)} KB · checksum{" "}
                {analyze.data.checksum.slice(0, 12)}… · expires{" "}
                {new Date(analyze.data.expires_at).toLocaleTimeString()}
              </p>
              <p className="m-0 text-sm font-semibold text-foreground">
                Detected columns: {analyze.data.headers.join(", ") || "none"}
              </p>
              {blocked ? (
                <div className="rounded bg-danger/10 p-3 text-sm text-danger">
                  {analyze.data.issues.map((issue) => (
                    <p key={issue.code} className="m-0">
                      {issue.code}: {issue.message}
                    </p>
                  ))}
                </div>
              ) : (
                <>
                  <p className="m-0 text-sm text-success">
                    Preview is committable. Validation warnings may still be
                    found after immutable commit.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="min-w-[700px] text-left text-xs">
                      <thead>
                        <tr>
                          {analyze.data.headers.map((header) => (
                            <th key={header} className="p-2">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {analyze.data.sample_rows.map((row, index) => (
                          <tr key={index} className="border-t border-border">
                            {analyze.data.headers.map((header) => (
                              <td key={header} className="p-2 font-mono">
                                {row[header]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    type="button"
                    onClick={() => commit.mutate()}
                    disabled={commit.isPending}
                    className="rounded bg-success px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {commit.isPending
                      ? "Committing…"
                      : asVersion
                        ? "Commit immutable version"
                        : "Commit immutable dataset"}
                  </button>
                </>
              )}
            </section>
          )}
        </div>
        {[analyze.error, commit.error, discard.error].map((error, index) =>
          error instanceof ApiError ? (
            <p key={index} role="alert" className="m-0 text-sm text-danger">
              {error.message}
            </p>
          ) : null,
        )}
      </div>
    </Slideover>
  );
}
