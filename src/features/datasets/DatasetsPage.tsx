import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  Database,
  FileUp,
  GitBranch,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import {
  getDataset,
  getDatasetVersion,
  getLibrarySummary,
  listDatasets,
  preflightRange,
  uploadDataset,
  uploadDatasetVersion,
  type DatasetDetail,
  type DatasetSummary,
  type DatasetVersion,
} from "../../api/datasets";
import {
  archiveAlgorithmVersion,
  checkCompatibility,
  getAlgorithmSchema,
  listAlgorithmVersions,
  listAlgorithms,
  saveAlgorithmVersion,
  validateAlgorithm,
  type Algorithm,
  type AlgorithmVersion,
} from "../../api/algorithms";
import { ApiError } from "../../api/system";
import { Slideover } from "../../components/Slideover";
import { AppSelect } from "../../components/ui/app-select";
import { UploadPreviewSlideover } from "../datasetExplorer/UploadPreviewSlideover";
import { AlgorithmDetailModal } from "../algorithmInspector/AlgorithmDetailModal";
import { formatPlatformDateTime } from "../../lib/dateTime";

const datasetStatuses = [
  "",
  "PENDING",
  "VALIDATING",
  "VALID",
  "WARNING",
  "INVALID",
  "FAILED",
];
const pending = new Set(["PENDING", "VALIDATING"]);
type AssetTab = "datasets" | "algorithms";
type InspectorTab = "overview" | "versions" | "quality" | "range";
type Property = {
  title?: string;
  label?: string;
  type?: string;
  format?: string;
  enum?: string[];
  default?: unknown;
  help?: string;
  minimum?: number;
  maximum?: number;
  experimental?: boolean;
};

function statusClass(status?: string) {
  if (status === "VALID" || status === "COMPLETED")
    return "bg-success/10 text-success";
  if (status === "WARNING") return "bg-warning/10 text-warning";
  if (status === "INVALID" || status === "FAILED")
    return "bg-danger/10 text-danger";
  return "bg-brand/10 text-brand";
}

function ErrorText({ error }: { error: unknown }) {
  if (!(error instanceof ApiError)) return null;
  return (
    <p className="m-0 text-sm font-medium text-danger" role="alert">
      {error.message}
      {error.requestId ? ` Request ID: ${error.requestId}` : ""}
    </p>
  );
}

function ReadinessBand() {
  const summary = useQuery({
    queryKey: ["library-summary"],
    queryFn: getLibrarySummary,
  });
  const data = summary.data;
  const kpis = [
    [
      "Datasets",
      data?.dataset_count,
      `${data?.dataset_version_count ?? 0} immutable versions`,
    ],
    [
      "Ready / warning",
      data
        ? `${data.usable_dataset_count} / ${data.warning_dataset_count}`
        : "—",
      "Validation health",
    ],
    [
      "Coverage",
      data?.coverage_start && data?.coverage_end
        ? `${data.coverage_start.slice(0, 10)} → ${data.coverage_end.slice(0, 10)}`
        : "—",
      `${data?.total_sessions ?? 0} sessions`,
    ],
    [
      "Algorithms",
      data?.active_algorithm_count,
      `${data?.saved_algorithm_version_count ?? 0} saved versions`,
    ],
  ];
  return (
    <section
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      aria-label="Library readiness"
    >
      {kpis.map(([label, value, detail]) => (
        <div
          key={String(label)}
          className="rounded-xl border border-border bg-surface/80 p-4 shadow-sm"
        >
          <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
            {label}
          </p>
          <p className="m-0 mt-2 font-mono text-xl font-semibold tabular-nums text-foreground">
            {value ?? "—"}
          </p>
          <p className="m-0 mt-1 text-xs text-muted">{detail}</p>
        </div>
      ))}
    </section>
  );
}

function CoverageTimeline({ datasets }: { datasets: DatasetSummary[] }) {
  const spans = datasets.flatMap((dataset) =>
    dataset.latest_version?.coverage_start &&
    dataset.latest_version.coverage_end
      ? [
          {
            dataset,
            start: new Date(dataset.latest_version.coverage_start).getTime(),
            end: new Date(dataset.latest_version.coverage_end).getTime(),
          },
        ]
      : [],
  );
  const earliest = Math.min(...spans.map((span) => span.start), Date.now());
  const latest = Math.max(...spans.map((span) => span.end), earliest + 1);
  if (!spans.length)
    return (
      <p className="m-0 p-4 text-xs text-muted">
        Coverage will appear after validation establishes a durable date range.
      </p>
    );
  return (
    <section className="rounded-xl border border-border bg-surface/80 p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="m-0 text-sm font-semibold text-foreground">
            Calendar coverage
          </h2>
          <p className="m-0 text-xs text-muted">
            Actual validated coverage positions, not duration-only bars.
          </p>
        </div>
        <span className="font-mono text-[10px] text-muted">
          {new Date(earliest).toISOString().slice(0, 10)} —{" "}
          {new Date(latest).toISOString().slice(0, 10)}
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {spans.slice(0, 8).map(({ dataset, start, end }) => (
          <div
            key={dataset.id}
            className="grid grid-cols-[minmax(90px,150px)_minmax(0,1fr)] items-center gap-3 text-xs"
          >
            <span className="truncate text-foreground" title={dataset.name}>
              {dataset.name}
            </span>
            <div className="relative h-5 rounded bg-surface-subtle">
              <span
                className="absolute top-0 h-5 rounded bg-brand/75"
                style={{
                  left: `${((start - earliest) / (latest - earliest)) * 100}%`,
                  width: `${Math.max(2, ((end - start) / (latest - earliest)) * 100)}%`,
                }}
                aria-label={`${dataset.name}: ${dataset.latest_version?.coverage_start?.slice(0, 10)} through ${dataset.latest_version?.coverage_end?.slice(0, 10)}`}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DatasetInspector({
  detail,
  selectedVersionId,
  onVersionChange,
}: {
  detail?: DatasetDetail;
  selectedVersionId?: string;
  onVersionChange: (id: string) => void;
}) {
  const [tab, setTab] = useState<InspectorTab>("overview");
  const version =
    detail?.versions.find((item) => item.id === selectedVersionId) ??
    detail?.versions.at(-1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const range = useMutation({
    mutationFn: () => preflightRange(version!.id, startDate, endDate),
  });
  if (!detail || !version)
    return (
      <aside className="flex min-h-80 items-center justify-center rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
        Select a dataset to inspect its immutable versions and validation
        evidence.
      </aside>
    );
  return (
    <aside className="min-w-0 rounded-xl border border-border bg-surface/90 shadow-sm xl:sticky xl:top-0 xl:max-h-[calc(100vh-8rem)] xl:overflow-auto">
      <div className="border-b border-border p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-brand">
              Dataset inspector
            </p>
            <h2 className="m-0 mt-1 truncate text-base font-semibold text-foreground">
              {detail.name}
            </h2>
            <p className="m-0 mt-1 truncate text-xs text-muted">
              {detail.source || "No source supplied"}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${statusClass(version.status)}`}
          >
            {version.status}
          </span>
        </div>
        <AppSelect
          value={version.id}
          onValueChange={onVersionChange}
          options={detail.versions.map((item) => ({
            value: item.id,
            label: `v${item.version_number} · ${item.original_filename}`,
          }))}
          placeholder="Choose dataset version…"
          ariaLabel="Dataset version"
          className="mt-4 h-9 text-xs"
        />
        <div className="mt-3 flex gap-1 border-b border-border">
          {(["overview", "versions", "quality", "range"] as InspectorTab[]).map(
            (item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                className={`border-b-2 px-2 py-2 text-[11px] font-bold capitalize ${tab === item ? "border-brand text-brand" : "border-transparent text-muted"}`}
              >
                {item}
              </button>
            ),
          )}
        </div>
      </div>
      <div className="space-y-4 p-4">
        {tab === "overview" && (
          <>
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-muted">Rows</dt>
                <dd className="m-0 font-mono text-foreground">
                  {version.row_count ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Sessions</dt>
                <dd className="m-0 font-mono text-foreground">
                  {version.session_count ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Resolution</dt>
                <dd className="m-0 text-foreground">
                  {version.resolution_minutes
                    ? `${version.resolution_minutes} minutes`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Timezone</dt>
                <dd className="m-0 text-foreground">
                  {version.timezone ?? "—"}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted">Validated coverage</dt>
                <dd className="m-0 text-foreground">
                  {version.coverage_start?.slice(0, 10) ?? "—"} →{" "}
                  {version.coverage_end?.slice(0, 10) ?? "—"}
                </dd>
              </div>
            </dl>
            <p className="rounded-lg bg-surface-subtle p-3 text-xs text-muted">
              {version.original_filename} · checksum{" "}
              {version.checksum.slice(0, 12)}…
            </p>
            <a
              href={`/library?tab=datasets&dataset=${detail.id}&version=${version.id}&explorer=1`}
              className="inline-flex rounded-lg border border-brand/30 px-3 py-2 text-xs font-bold text-brand"
            >
              Open dataset explorer
            </a>
          </>
        )}
        {tab === "versions" && (
          <div className="space-y-2">
            {detail.versions.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onVersionChange(item.id)}
                className={`flex w-full items-center justify-between rounded-lg border p-3 text-left text-xs ${item.id === version.id ? "border-brand bg-brand/5" : "border-border"}`}
              >
                <span>
                  <strong className="text-foreground">
                    v{item.version_number}
                  </strong>
                  <span className="ml-2 text-muted">
                    {formatPlatformDateTime(item.created_at)}
                  </span>
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusClass(item.status)}`}
                >
                  {item.status}
                </span>
              </button>
            ))}
          </div>
        )}
        {tab === "quality" && (
          <>
            <p className="m-0 text-xs text-muted">
              Validation {version.validation_progress}% ·{" "}
              {version.warning_count} warnings · {version.error_count} errors
            </p>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-subtle">
              <div
                className="h-full bg-brand"
                style={{ width: `${version.validation_progress}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(version.capabilities).map(([key, available]) => (
                <span
                  key={key}
                  className={`rounded-md border px-2 py-1 text-[10px] ${available ? "border-brand/30 bg-brand/10 text-brand" : "border-border text-muted"}`}
                >
                  {key.replaceAll("_", " ")} ·{" "}
                  {available ? "available" : "unavailable"}
                </span>
              ))}
            </div>
            {[...version.warnings, ...version.errors].map((issue) => (
              <p
                key={`${issue.code}-${issue.message}`}
                className="rounded-lg border border-warning/30 bg-warning/10 p-2 text-xs text-foreground"
              >
                <strong>{issue.code}</strong> · {issue.message}
              </p>
            ))}
          </>
        )}
        {tab === "range" && (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              range.mutate();
            }}
          >
            <p className="m-0 text-xs text-muted">
              Check a research range against this version’s durable coverage.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-muted">
                Start
                <input
                  required
                  type="date"
                  min={version.coverage_start?.slice(0, 10)}
                  max={version.coverage_end?.slice(0, 10)}
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-surface p-2 text-foreground"
                />
              </label>
              <label className="text-xs text-muted">
                End
                <input
                  required
                  type="date"
                  min={version.coverage_start?.slice(0, 10)}
                  max={version.coverage_end?.slice(0, 10)}
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-surface p-2 text-foreground"
                />
              </label>
            </div>
            <button
              className="rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white"
              disabled={range.isPending}
            >
              {range.isPending ? "Checking…" : "Check range"}
            </button>
            {range.data && (
              <p
                className={`m-0 text-xs ${range.data.selection_allowed ? "text-success" : "text-danger"}`}
              >
                {range.data.selection_allowed
                  ? `${range.data.usable_session_count} usable sessions · about ${range.data.estimated_row_count} rows`
                  : range.data.issues
                      .map((item) => String(item.message ?? item.code))
                      .join(" ")}
              </p>
            )}
            <ErrorText error={range.error} />
          </form>
        )}
      </div>
    </aside>
  );
}

export function UploadSlideover({
  isOpen,
  onClose,
  selectedDataset,
  onUploaded,
}: {
  isOpen: boolean;
  onClose: () => void;
  selectedDataset?: DatasetDetail;
  onUploaded: (version: DatasetVersion) => void;
}) {
  const [asVersion, setAsVersion] = useState(false);
  const upload = useMutation({
    mutationFn: (input: {
      name: string;
      description: string;
      source: string;
      file: File;
    }) =>
      asVersion && selectedDataset
        ? uploadDatasetVersion({ ...input, datasetId: selectedDataset.id })
        : uploadDataset(input),
    onSuccess: (result) => onUploaded(result.dataset_version),
  });
  useEffect(() => {
    if (!selectedDataset) setAsVersion(false);
  }, [selectedDataset]);
  return (
    <Slideover
      isOpen={isOpen}
      onClose={onClose}
      title="Upload dataset"
      size="wide"
    >
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const file = form.get("file");
          if (file instanceof File && file.size)
            upload.mutate({
              name: String(form.get("name")),
              description: String(form.get("description") ?? ""),
              source: String(form.get("source") ?? ""),
              file,
            });
        }}
      >
        <div className="rounded-xl border border-brand/25 bg-brand/5 p-4">
          <p className="m-0 text-xs font-semibold text-foreground">
            Original files are preserved. Each accepted upload becomes an
            immutable dataset version.
          </p>
          {selectedDataset && (
            <label className="mt-3 flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={asVersion}
                onChange={(event) => setAsVersion(event.target.checked)}
              />{" "}
              Add as a new version of {selectedDataset.name}
            </label>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-muted">
            Name
            <input
              name="name"
              required
              defaultValue={
                selectedDataset?.name ?? "NIFTY 50 five-minute candles"
              }
              className="mt-1 w-full rounded-lg border border-border bg-surface p-2.5 text-foreground"
            />
          </label>
          <label className="text-sm text-muted">
            Source
            <input
              name="source"
              defaultValue={selectedDataset?.source ?? "Local research file"}
              className="mt-1 w-full rounded-lg border border-border bg-surface p-2.5 text-foreground"
            />
          </label>
          <label className="sm:col-span-2 text-sm text-muted">
            Description
            <textarea
              name="description"
              defaultValue={selectedDataset?.description ?? ""}
              rows={3}
              className="mt-1 w-full rounded-lg border border-border bg-surface p-2.5 text-foreground"
            />
          </label>
          <label className="sm:col-span-2 text-sm text-muted">
            CSV file
            <input
              name="file"
              required
              type="file"
              accept=".csv,text/csv"
              className="mt-1 block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-brand/10 file:px-3 file:py-2 file:font-semibold file:text-brand"
            />
          </label>
        </div>
        <button
          className="rounded-lg bg-brand px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          disabled={upload.isPending}
        >
          {upload.isPending
            ? "Uploading…"
            : asVersion
              ? "Upload immutable version"
              : "Upload dataset"}
        </button>
        {upload.data && (
          <p className="m-0 text-sm text-success">
            {upload.data.duplicate
              ? "Matching immutable version already exists."
              : "Upload accepted; validation is now tracked in the inspector."}
          </p>
        )}
        <ErrorText error={upload.error} />
      </form>
    </Slideover>
  );
}

function AlgorithmWorkspace({
  selectedDatasetVersionId,
}: {
  selectedDatasetVersionId?: string;
}) {
  const [params, setParams] = useSearchParams();
  const selectedKey = params.get("algorithm");
  const selectedVersionId = params.get("algorithmVersion");
  const algorithms = useQuery({
    queryKey: ["algorithms"],
    queryFn: listAlgorithms,
  });
  const selected =
    algorithms.data?.items.find((item) => item.key === selectedKey) ??
    algorithms.data?.items[0];
  const schema = useQuery({
    queryKey: ["algorithm-schema", selected?.key],
    queryFn: () => getAlgorithmSchema(selected!.key),
    enabled: Boolean(selected),
  });
  const versions = useQuery({
    queryKey: ["algorithm-versions", selected?.key],
    queryFn: () => listAlgorithmVersions(selected!.key),
    enabled: Boolean(selected),
  });
  const selectedVersion = versions.data?.items.find(
    (item) => item.id === selectedVersionId,
  );
  const compatibility = useQuery({
    queryKey: [
      "library-compatibility",
      selected?.key,
      selectedDatasetVersionId,
    ],
    queryFn: () => checkCompatibility(selected!.key, selectedDatasetVersionId!),
    enabled: Boolean(selected && selectedDatasetVersionId),
  });
  const [editorOpen, setEditorOpen] = useState(false);
  const [archiveCandidate, setArchiveCandidate] =
    useState<AlgorithmVersion | null>(null);
  useEffect(() => {
    if (params.get("newVersion") !== "1") return;
    setEditorOpen(true);
    setParams(
      (current) => {
        current.delete("newVersion");
        return current;
      },
      { replace: true },
    );
  }, [params, setParams]);
  const setAlgorithm = (key: string, versionId?: string) =>
    setParams((current) => {
      current.set("tab", "algorithms");
      current.set("algorithm", key);
      if (versionId) current.set("algorithmVersion", versionId);
      else current.delete("algorithmVersion");
      return current;
    });
  if (!selected)
    return (
      <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">
        No active developer-owned algorithms are registered.
      </p>
    );
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_440px]">
      <section className="min-w-0 rounded-xl border border-border bg-surface/80 shadow-sm">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h2 className="m-0 text-base font-semibold text-foreground">
              Algorithm catalog
            </h2>
            <p className="m-0 text-xs text-muted">
              Developer-owned code; users save immutable parameter versions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditorOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white"
          >
            <Plus size={14} /> New version
          </button>
        </div>
        <div className="divide-y divide-border">
          {algorithms.data?.items.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() =>
                setParams((current) => {
                  current.set("tab", "algorithms");
                  current.set("algorithm", item.key);
                  current.set("algorithmInspector", "1");
                  return current;
                })
              }
              className={`flex w-full items-start justify-between gap-4 p-4 text-left hover:bg-brand/5 ${item.key === selected.key ? "bg-brand/10" : ""}`}
            >
              <div className="min-w-0">
                <p className="m-0 font-semibold text-foreground">
                  {item.display_name}
                </p>
                <p className="m-0 mt-1 line-clamp-2 text-xs text-muted">
                  {item.description}
                </p>
              </div>
              <span className="shrink-0 font-mono text-[10px] text-muted">
                {item.code_version}
              </span>
            </button>
          ))}
        </div>
      </section>
      <aside className="min-w-0 rounded-xl border border-border bg-surface/90 p-4 shadow-sm xl:sticky xl:top-0 xl:max-h-[calc(100vh-8rem)] xl:overflow-auto">
        <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-brand">
          Algorithm inspector
        </p>
        <h2 className="m-0 mt-1 text-lg font-semibold text-foreground">
          {selected.display_name}
        </h2>
        <p className="m-0 mt-2 text-xs leading-5 text-muted">
          {selected.description}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="text-muted">Code</dt>
            <dd className="m-0 font-mono text-foreground">
              {selected.code_version}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Schema</dt>
            <dd className="m-0 font-mono text-foreground">
              v{selected.schema_version}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-xs font-semibold text-foreground">
          Required capabilities
        </p>
        <div className="flex flex-wrap gap-1">
          {selected.required_capabilities.map((item) => (
            <span
              key={item}
              className="rounded border border-border px-2 py-1 text-[10px] text-muted"
            >
              {item.replaceAll("_", " ")}
            </span>
          ))}
        </div>
        {compatibility.data && (
          <p
            className={`mt-3 rounded-lg p-3 text-xs ${compatibility.data.compatible ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}
          >
            {compatibility.data.compatible
              ? "Selected dataset version is compatible."
              : `Missing: ${compatibility.data.missing_capabilities.join(", ") || "requirements"}`}
          </p>
        )}
        <div className="mt-5 border-t border-border pt-4">
          <p className="m-0 text-xs font-semibold text-foreground">
            Immutable versions
          </p>
          <div className="mt-2 space-y-2">
            {versions.data?.items.map((item) => (
              <div
                key={item.id}
                className={`rounded-lg border p-3 ${item.id === selectedVersion?.id ? "border-brand bg-brand/5" : "border-border"}`}
              >
                <button
                  type="button"
                  onClick={() => setAlgorithm(selected.key, item.id)}
                  className="w-full text-left"
                >
                  <strong className="text-xs text-foreground">
                    v{item.version_number} · {item.name}
                  </strong>
                  <span className="ml-2 text-[10px] text-muted">
                    {item.archived ? "Archived" : "Active"}
                  </span>
                  <p className="m-0 mt-1 text-[10px] text-muted">
                    {formatPlatformDateTime(item.created_at)}
                  </p>
                </button>
                {!item.archived && (
                  <button
                    type="button"
                    onClick={() => setArchiveCandidate(item)}
                    className="mt-2 text-[10px] font-bold text-danger"
                  >
                    Archive version
                  </button>
                )}
              </div>
            ))}
            {versions.data?.items.length === 0 && (
              <p className="text-xs text-muted">No saved versions yet.</p>
            )}
          </div>
        </div>
      </aside>
      <AlgorithmEditor
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        algorithm={selected}
        schema={
          schema.data?.schema.properties as Record<string, Property> | undefined
        }
        sourceVersion={selectedVersion}
        onSaved={(version) => setAlgorithm(selected.key, version.id)}
      />
      <ArchiveConfirm
        candidate={archiveCandidate}
        onClose={() => setArchiveCandidate(null)}
      />
      <AlgorithmDetailModal algorithmKey={selected.key} />
    </section>
  );
}

function AlgorithmEditor({
  isOpen,
  onClose,
  algorithm,
  schema,
  sourceVersion,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  algorithm: Algorithm;
  schema?: Record<string, Property>;
  sourceVersion?: AlgorithmVersion;
  onSaved: (version: AlgorithmVersion) => void;
}) {
  const queryClient = useQueryClient();
  const [templateKey, setTemplateKey] = useState("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [parameters, setParameters] = useState<Record<string, unknown>>({});
  useEffect(() => {
    if (!isOpen) return;
    setTemplateKey("");
    setName(sourceVersion ? `${sourceVersion.name} clone` : "");
    setNotes(sourceVersion?.notes ?? "");
    setParameters(sourceVersion ? { ...sourceVersion.parameters } : {});
  }, [isOpen, sourceVersion]);
  const validation = useMutation({
    mutationFn: () => validateAlgorithm(algorithm.key, parameters),
  });
  const save = useMutation({
    mutationFn: () =>
      saveAlgorithmVersion(algorithm.key, {
        name,
        notes,
        parent_version_id: sourceVersion?.id ?? null,
        parameters,
      }),
    onSuccess: (version) => {
      void queryClient.invalidateQueries({
        queryKey: ["algorithm-versions", algorithm.key],
      });
      onSaved(version);
    },
  });
  const chooseTemplate = (key: string) => {
    const template = algorithm.templates.find((item) => item.key === key);
    setTemplateKey(key);
    if (template) {
      setParameters({ ...template.parameters });
      setName(`${template.name} research`);
    }
    validation.reset();
  };
  return (
    <Slideover
      isOpen={isOpen}
      onClose={onClose}
      title="New immutable version"
      size="wide"
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-foreground">
          <strong>Experimental research only.</strong> This form changes no
          executable code. Saving creates a new immutable parameter version.
        </div>
        <label className="block text-sm text-muted">
          Template
          <AppSelect
            value={templateKey || "__no_template__"}
            onValueChange={(value) =>
              chooseTemplate(value === "__no_template__" ? "" : value)
            }
            options={[
              { value: "__no_template__", label: "Choose a template…" },
              ...algorithm.templates.map((item) => ({
                value: item.key,
                label: item.name,
              })),
            ]}
            placeholder="Choose a template…"
            ariaLabel="Template"
            className="mt-1"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          {Object.entries(schema ?? {}).map(([key, property]) => (
            <label key={key} className="text-sm text-muted">
              {property.label ?? property.title ?? key}
              {property.enum ? (
                <AppSelect
                  value={String(parameters[key] ?? "")}
                  onValueChange={(value) =>
                    setParameters((current) => ({
                      ...current,
                      [key]: value,
                    }))
                  }
                  options={property.enum.map((value) => ({
                    value,
                    label: value,
                  }))}
                  placeholder="Choose a value…"
                  ariaLabel={property.label ?? property.title ?? key}
                  className="mt-1"
                />
              ) : (
                <input
                  type={
                    property.format === "time"
                      ? "time"
                      : property.type === "number" ||
                          property.type === "integer"
                        ? "number"
                        : "text"
                  }
                  min={property.minimum}
                  max={property.maximum}
                  value={String(parameters[key] ?? property.default ?? "")}
                  onChange={(event) =>
                    setParameters((current) => ({
                      ...current,
                      [key]:
                        property.type === "integer"
                          ? Number.parseInt(event.target.value, 10)
                          : property.type === "number"
                            ? Number(event.target.value)
                            : event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-border bg-surface p-2.5 text-foreground"
                />
              )}
              {property.help && (
                <span className="mt-1 block text-[10px]">{property.help}</span>
              )}
            </label>
          ))}
        </div>
        <label className="block text-sm text-muted">
          Version name
          <input
            value={name}
            maxLength={200}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface p-2.5 text-foreground"
          />
        </label>
        <label className="block text-sm text-muted">
          Notes
          <textarea
            value={notes}
            maxLength={5000}
            rows={3}
            onChange={(event) => setNotes(event.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface p-2.5 text-foreground"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => validation.mutate()}
            disabled={!Object.keys(parameters).length || validation.isPending}
            className="rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground disabled:opacity-50"
          >
            Validate
          </button>
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={!name.trim() || !validation.data?.valid || save.isPending}
            className="rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            Save as new immutable version
          </button>
        </div>
        {validation.data?.valid && (
          <p className="m-0 text-sm text-success">Parameters are valid.</p>
        )}
        {validation.data && !validation.data.valid && (
          <ul className="m-0 text-xs text-danger">
            {validation.data.errors.map((item) => (
              <li key={`${item.field}-${item.message}`}>
                {item.field}: {item.message}
              </li>
            ))}
          </ul>
        )}
        <ErrorText error={validation.error ?? save.error} />
      </div>
    </Slideover>
  );
}

function ArchiveConfirm({
  candidate,
  onClose,
}: {
  candidate: AlgorithmVersion | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const archive = useMutation({
    mutationFn: archiveAlgorithmVersion,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["algorithm-versions"] });
      onClose();
    },
  });
  if (!candidate) return null;
  return (
    <Slideover isOpen onClose={onClose} title="Archive immutable version">
      <p className="text-sm text-muted">
        Archive v{candidate.version_number} · {candidate.name}? It remains
        available to historical runs and cannot be edited or deleted.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground"
        >
          Keep active
        </button>
        <button
          type="button"
          onClick={() => archive.mutate(candidate.id)}
          className="rounded-lg bg-danger px-3 py-2 text-xs font-bold text-white"
        >
          Archive version
        </button>
      </div>
      <ErrorText error={archive.error} />
    </Slideover>
  );
}

export function DatasetsPage() {
  const [params, setParams] = useSearchParams();
  const tab =
    params.get("tab") === "algorithms"
      ? "algorithms"
      : ("datasets" as AssetTab);
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const datasetId = params.get("dataset") ?? undefined;
  const versionId = params.get("version") ?? undefined;
  const queryClient = useQueryClient();
  const catalog = useInfiniteQuery({
    queryKey: ["library-datasets", status, search],
    queryFn: ({ pageParam }) => listDatasets(status, search, pageParam, 25),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
  });
  const items = useMemo(
    () => catalog.data?.pages.flatMap((page) => page.items) ?? [],
    [catalog.data],
  );
  const detail = useQuery({
    queryKey: ["library-dataset", datasetId],
    queryFn: () => getDataset(datasetId!),
    enabled: Boolean(datasetId),
  });
  const selectedVersion = useQuery({
    queryKey: ["library-version", versionId],
    queryFn: () => getDatasetVersion(versionId!),
    enabled: Boolean(versionId),
    refetchInterval: (query) =>
      query.state.data && pending.has(query.state.data.status) ? 2000 : false,
  });
  const setSelection = useCallback(
    (id?: string, selectedVersionId?: string) =>
      setParams((current) => {
        current.set("tab", "datasets");
        if (id) current.set("dataset", id);
        else current.delete("dataset");
        if (selectedVersionId) current.set("version", selectedVersionId);
        else current.delete("version");
        return current;
      }),
    [setParams],
  );
  useEffect(() => {
    if (tab === "datasets" && !datasetId && items[0]?.latest_version)
      setSelection(items[0].id, items[0].latest_version.id);
  }, [tab, datasetId, items, setSelection]);
  const applyFilters = () =>
    setParams((current) => {
      current.set("tab", "datasets");
      if (search.trim()) current.set("q", search.trim());
      else current.delete("q");
      if (status) current.set("status", status);
      else current.delete("status");
      return current;
    });
  const selectedDataset = detail.data;
  const selectedDatasetVersion =
    selectedVersion.data ??
    selectedDataset?.versions.find((item) => item.id === versionId);
  return (
    <section className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 animate-in fade-in duration-500">
      <header className="rounded-2xl border border-border/50 glass p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand/10 rounded-full blur-3xl -z-10" />
        <div className="flex flex-wrap items-start justify-between gap-4 relative z-10">
          <div>
            <p className="m-0 text-[11px] font-bold uppercase tracking-[0.16em] text-brand">
              Asset registry
            </p>
            <h1 className="m-0 mt-2 text-3xl font-extrabold tracking-tight text-foreground">
              Library
            </h1>
            <p className="m-0 mt-2 max-w-2xl text-sm text-muted-foreground">
              Inspect durable data quality and developer-owned algorithm
              definitions before configuring a reproducible platform-demo run.
            </p>
          </div>
          {tab === "datasets" ? (
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-brand hover:bg-brand/90 transition-colors px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand/20"
            >
              <FileUp size={16} /> Upload dataset
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                setParams((current) => {
                  current.set("tab", "algorithms");
                  current.set("newVersion", "1");
                  return current;
                })
              }
              className="inline-flex items-center gap-2 rounded-lg bg-brand hover:bg-brand/90 transition-colors px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand/20"
            >
              <Plus size={16} /> New version
            </button>
          )}
        </div>
        <div className="mt-6 flex gap-2 border-b border-border/50 relative z-10">
          <button
            type="button"
            onClick={() =>
              setParams((current) => {
                current.set("tab", "datasets");
                return current;
              })
            }
            className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${tab === "datasets" ? "border-brand text-brand" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <Database className="mr-2 inline" size={16} /> Datasets
          </button>
          <button
            type="button"
            onClick={() =>
              setParams((current) => {
                current.set("tab", "algorithms");
                return current;
              })
            }
            className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${tab === "algorithms" ? "border-brand text-brand" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <GitBranch className="mr-2 inline" size={16} /> Algorithms
          </button>
        </div>
      </header>
      <ReadinessBand />
      {tab === "datasets" ? (
        <>
          <section className="rounded-xl border border-border bg-surface/80 p-4 shadow-sm">
            <div className="flex flex-wrap gap-2">
              <label className="relative min-w-[220px] flex-1">
                <Search
                  size={15}
                  className="absolute left-3 top-2.5 text-muted"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && applyFilters()}
                  placeholder="Search dataset name or source…"
                  className="w-full rounded-lg border border-border bg-surface py-2 pl-8 pr-3 text-sm text-foreground"
                />
              </label>
              <AppSelect
                value={status || "__all_statuses__"}
                onValueChange={(value) =>
                  setStatus(value === "__all_statuses__" ? "" : value)
                }
                options={datasetStatuses.map((item) => ({
                  value: item || "__all_statuses__",
                  label: item || "All validation states",
                }))}
                placeholder="All validation states"
                ariaLabel="Validation status"
                className="w-auto min-w-48"
              />
              <button
                type="button"
                onClick={applyFilters}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground"
              >
                <SlidersHorizontal size={14} /> Apply
              </button>
            </div>
          </section>
          <CoverageTimeline datasets={items} />
          <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_440px]">
            <section className="min-w-0 rounded-xl border border-border bg-surface/80 shadow-sm">
              <div className="flex items-center justify-between border-b border-border p-4">
                <div>
                  <h2 className="m-0 text-base font-semibold text-foreground">
                    Dataset catalog
                  </h2>
                  <p className="m-0 text-xs text-muted">
                    {catalog.data?.pages[0]?.total_count ?? 0} matching ·{" "}
                    {items.length} loaded
                  </p>
                </div>
                <Database size={17} className="text-brand" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[910px] text-left text-xs">
                  <thead className="bg-surface-subtle text-muted">
                    <tr>
                      {[
                        "Dataset / status",
                        "Latest version",
                        "Coverage",
                        "Rows / sessions",
                        "Resolution",
                        "Source",
                        "Quality",
                      ].map((item) => (
                        <th key={item} className="p-3 font-medium">
                          {item}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const latest = item.latest_version;
                      return (
                        <tr
                          key={item.id}
                          onClick={() => {
                            setSelection(item.id, latest?.id);
                            if (
                              typeof window !== "undefined" &&
                              window.innerWidth < 1280
                            )
                              setDetailOpen(true);
                          }}
                          className={`cursor-pointer border-t border-border hover:bg-brand/5 ${item.id === datasetId ? "bg-brand/10" : ""}`}
                        >
                          <td className="p-3">
                            <p className="m-0 max-w-52 truncate font-semibold text-foreground">
                              {item.name}
                            </p>
                            <span
                              className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${statusClass(latest?.status)}`}
                            >
                              {latest?.status ?? "NO VERSION"}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-foreground">
                            {latest ? `v${latest.version_number}` : "—"}
                            <p className="m-0 max-w-32 truncate text-[10px] text-muted">
                              {latest?.original_filename}
                            </p>
                          </td>
                          <td className="p-3 whitespace-nowrap text-foreground">
                            {latest?.coverage_start?.slice(0, 10) ?? "—"}
                            <br />
                            {latest?.coverage_end?.slice(0, 10) ?? "—"}
                          </td>
                          <td className="p-3 font-mono text-foreground">
                            {latest?.row_count ?? "—"} /{" "}
                            {latest?.session_count ?? "—"}
                          </td>
                          <td className="p-3 text-foreground">
                            {latest?.resolution_minutes
                              ? `${latest.resolution_minutes}m`
                              : "—"}
                            <p className="m-0 text-[10px] text-muted">
                              {latest?.timezone ?? "—"}
                            </p>
                          </td>
                          <td className="p-3 max-w-36 truncate text-muted">
                            {item.source ?? "—"}
                          </td>
                          <td className="p-3 text-foreground">
                            {latest ? `${latest.validation_progress}%` : "—"}
                            <p className="m-0 text-[10px] text-muted">
                              {latest?.warning_count ?? 0} warnings ·{" "}
                              {latest?.error_count ?? 0} errors
                            </p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {catalog.isLoading && (
                <p className="p-5 text-sm text-muted">Loading datasets…</p>
              )}
              {!items.length && !catalog.isLoading && (
                <p className="p-10 text-center text-sm text-muted">
                  No datasets match the current filter.
                </p>
              )}
              {catalog.hasNextPage && (
                <button
                  type="button"
                  onClick={() => catalog.fetchNextPage()}
                  disabled={catalog.isFetchingNextPage}
                  className="m-4 w-[calc(100%-2rem)] rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground"
                >
                  {catalog.isFetchingNextPage ? "Loading…" : "Load 25 more"}
                </button>
              )}
              <ErrorText error={catalog.error} />
            </section>
            <DatasetInspector
              detail={selectedDataset}
              selectedVersionId={selectedDatasetVersion?.id}
              onVersionChange={(id) => setSelection(selectedDataset?.id, id)}
            />
          </div>
          <Slideover
            isOpen={detailOpen}
            onClose={() => setDetailOpen(false)}
            title="Dataset inspector"
            size="wide"
          >
            <DatasetInspector
              detail={selectedDataset}
              selectedVersionId={selectedDatasetVersion?.id}
              onVersionChange={(id) => setSelection(selectedDataset?.id, id)}
            />
          </Slideover>
          <UploadPreviewSlideover
            isOpen={uploadOpen}
            onClose={() => setUploadOpen(false)}
            selectedDataset={selectedDataset}
            onCommitted={(version) => {
              void queryClient.invalidateQueries({
                queryKey: ["library-datasets"],
              });
              void queryClient.invalidateQueries({
                queryKey: ["library-summary"],
              });
              setSelection(version.dataset_id, version.id);
            }}
          />
        </>
      ) : (
        <AlgorithmWorkspace
          selectedDatasetVersionId={selectedDatasetVersion?.id}
        />
      )}
    </section>
  );
}
