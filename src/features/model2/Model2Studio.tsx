import { humanize, money } from "./presentation";
import { useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { listAlgorithms, listAlgorithmVersions } from "../../api/algorithms";
import { listDatasets } from "../../api/datasets";
import { preflightResearch, startResearch } from "../../api/model2";
import type { BacktestInputs } from "../../api/backtests";
import { StudioConfigurationPanel } from "../studio/StudioConfigurationPanel";
import { ResearchGroupView, ResearchError } from "./ResearchGroupView";
import { Button } from "../../components/ui/button";

export function Model2Studio({ algorithmKey }: { algorithmKey: string }) {
  const [params, setParams] = useSearchParams();
  const [datasetId, setDatasetId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [range, setRange] = useState<{ start: string; end: string } | null>(
    null,
  );
  const [capital, setCapital] = useState("500000.00");
  const [acknowledged, setAcknowledged] = useState(false);
  const [accepted, setAccepted] = useState<string | null>(null);
  const datasets = useInfiniteQuery({
    queryKey: ["model2-datasets"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      listDatasets(undefined, undefined, pageParam, 100),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
  const algorithms = useQuery({
    queryKey: ["algorithms", "studio"],
    queryFn: listAlgorithms,
  });
  const versions = useQuery({
    queryKey: ["algorithm-versions", algorithmKey, "studio"],
    queryFn: () => listAlgorithmVersions(algorithmKey),
  });
  const rows = datasets.data?.pages.flatMap((page) => page.items) ?? [];
  const dataset =
    rows.find((item) => item.id === datasetId) ??
    rows.find((item) => item.latest_version?.capabilities.model2_bundle_v3);
  const datasetVersion = dataset?.latest_version;
  const version =
    versions.data?.items.find(
      (item) => item.id === versionId && !item.archived,
    ) ?? versions.data?.items.find((item) => !item.archived);
  const algorithm = algorithms.data?.items.find(
    (item) => item.key === algorithmKey,
  );
  const startDate =
    range?.start ?? datasetVersion?.coverage_start?.slice(0, 10) ?? "";
  const endDate =
    range?.end ?? datasetVersion?.coverage_end?.slice(0, 10) ?? "";
  const input: BacktestInputs | null =
    datasetVersion && version && startDate && endDate
      ? {
          dataset_version_id: datasetVersion.id,
          algorithm_version_id: version.id,
          start_date: startDate,
          end_date: endDate,
          starting_capital: capital,
          warning_acknowledged: acknowledged,
          accepted_coverage_digest: accepted,
        }
      : null;
  const identity = JSON.stringify(
    input && {
      ...input,
      warning_acknowledged: false,
      accepted_coverage_digest: null,
    },
  );
  const preflight = useMutation({
    mutationFn: async () => ({
      identity,
      result: await preflightResearch(input!),
    }),
  });
  const ready =
    preflight.data?.identity === identity ? preflight.data.result : undefined;
  const idempotency = useRef<{ identity: string; key: string } | null>(null);
  const start = useMutation({
    mutationFn: async () => {
      if (!idempotency.current || idempotency.current.identity !== identity)
        idempotency.current = { identity, key: crypto.randomUUID() };
      const finalReview = await preflightResearch(input!);
      if (!finalReview.allowed)
        throw new Error(
          "The server requires a new readiness review for these inputs.",
        );
      return startResearch(input!, idempotency.current.key);
    },
    onSuccess: (group) => setParams({ researchGroup: group.id }),
  });
  const reset = () => {
    setAcknowledged(false);
    setAccepted(null);
    start.reset();
  };
  const groupId = params.get("researchGroup");
  if (groupId) return <ResearchGroupView groupId={groupId} />;
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-brand">
          Backtest Studio · Model 2
        </p>
        <h1 className="mt-1 text-2xl font-bold">
          Research the overnight iron condor
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Choose a saved configuration and a preserved market-data bundle. One
          request runs the primary maximum-loss assumption, zero-risk assumption
          and halt-at-exclusion scenario independently.
        </p>
      </header>
      <ResearchError
        error={datasets.error || algorithms.error || versions.error}
      />
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[340px_1fr]">
        <div>
          <StudioConfigurationPanel
            datasetId={dataset?.id ?? ""}
            datasetOptions={rows.map((item) => ({
              value: item.id,
              label: `${item.name}${item.latest_version?.capabilities.model2_bundle_v3 ? " · Model 2 bundle" : " · incompatible"}`,
            }))}
            onDatasetChange={(value) => {
              reset();
              setDatasetId(value);
              setRange(null);
            }}
            startDate={startDate}
            endDate={endDate}
            sessionCount={datasetVersion?.session_count}
            coverageStart={datasetVersion?.coverage_start}
            coverageEnd={datasetVersion?.coverage_end}
            onStartDateChange={(value) => {
              reset();
              setRange({ start: value, end: endDate });
            }}
            onEndDateChange={(value) => {
              reset();
              setRange({ start: startDate, end: value });
            }}
            algorithmKey={algorithmKey}
            algorithmOptions={(algorithms.data?.items ?? []).map((item) => ({
              value: item.key,
              label: item.display_name,
            }))}
            onAlgorithmChange={(value) => setParams({ algorithm: value })}
            algorithmVersionId={version?.id ?? ""}
            versionOptions={(versions.data?.items ?? [])
              .filter((item) => !item.archived)
              .map((item) => ({
                value: item.id,
                label: `${item.name} · v${item.version_number}`,
              }))}
            onVersionChange={(value) => {
              reset();
              setVersionId(value);
            }}
            algorithmDescription={algorithm?.description}
            algorithmCodeVersion={algorithm?.code_version}
            capital={capital}
            capitalLabel="Research capital (INR)"
            capitalDescription="Fixed throughout this replay. Sets the approved risk and margin limits; no real funds are used."
            onCapitalChange={(value) => {
              reset();
              setCapital(value);
            }}
            showDatasetWarning={false}
            acknowledged={acknowledged}
            onAcknowledgedChange={setAcknowledged}
            reviewDisabled={!input || preflight.isPending}
            reviewPending={preflight.isPending}
            onReview={() => {
              reset();
              preflight.mutate();
            }}
            errorContent={<ResearchError error={preflight.error} />}
          />
          {datasets.hasNextPage && (
            <Button
              className="mt-2"
              variant="outline"
              onClick={() => datasets.fetchNextPage()}
            >
              Load more datasets
            </Button>
          )}
        </div>
        <section className="min-w-0 rounded-xl border border-border bg-surface p-5">
          <h2 className="text-xl font-semibold">Cycle readiness</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Entry data is checked without removing cycles because of future exit
            gaps. Estimates use candle opens, the saved slippage and an ASSUMED
            margin model.
          </p>
          {!ready ? (
            <p className="my-10 text-sm">
              Review the selected inputs to see eligible cycles and missing
              evidence.
            </p>
          ) : (
            <>
              <p className="my-4 font-medium">
                {humanize(ready.coverage_status)} ·{" "}
                {ready.entry_ready_cycle_count ?? 0} entry-ready /{" "}
                {ready.requested_cycle_count ?? 0} scheduled cycles
              </p>
              <ul className="my-3 space-y-2 text-sm">
                {[...ready.issues, ...ready.warnings].map((item, index) => (
                  <li key={index} className="rounded border border-border p-3">
                    {String(item.message ?? item.code ?? JSON.stringify(item))}
                  </li>
                ))}
              </ul>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      {[
                        "Entry → expiry",
                        "Readiness",
                        "Credit points",
                        "Maximum loss",
                        "Margin · ASSUMED",
                      ].map((label) => (
                        <th key={label} className="p-2">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ready.cycles?.map((cycle) => (
                      <tr key={cycle.expiry} className="border-t border-border">
                        <td className="p-2 whitespace-nowrap">
                          {cycle.entry_date} → {cycle.expiry}
                        </td>
                        <td className="p-2">
                          {humanize(cycle.classification)}
                          <br />
                          {cycle.reason ? humanize(cycle.reason) : ""}
                        </td>
                        <td className="p-2">
                          {cycle.entry_estimate?.credit_points ?? "—"}
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          {cycle.entry_estimate
                            ? money(cycle.entry_estimate.maximum_loss_inr)
                            : "—"}
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          {cycle.entry_estimate
                            ? money(cycle.entry_estimate.assumed_margin_inr)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {ready.acknowledgement_required && (
                <label className="mt-5 flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(event) => setAcknowledged(event.target.checked)}
                    className="mt-1"
                  />
                  I acknowledge the listed pricing, margin and data limitations.
                </label>
              )}
              {ready.coverage_status === "PARTIAL" && (
                <label className="mt-3 flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={accepted === ready.coverage_digest}
                    onChange={(event) =>
                      setAccepted(
                        event.target.checked ? ready.coverage_digest : null,
                      )
                    }
                    className="mt-1"
                  />
                  I accept the exact cycle coverage shown for these inputs.
                </label>
              )}
              <Button
                className="mt-5"
                disabled={
                  ready.coverage_status === "BLOCKED" ||
                  ready.issues.length > 0 ||
                  start.isPending ||
                  (ready.acknowledgement_required && !acknowledged) ||
                  (ready.coverage_status === "PARTIAL" &&
                    accepted !== ready.coverage_digest)
                }
                onClick={() => start.mutate()}
              >
                {start.isPending
                  ? "Starting research…"
                  : "Start all three scenarios"}
              </Button>
              <ResearchError error={start.error} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
