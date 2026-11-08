import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical, LockKeyhole, Play, ShieldCheck } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import {
  getAlgorithmSchema,
  listAlgorithmVersions,
} from "../../api/algorithms";
import { preflightBacktest } from "../../api/backtests";
import { listDatasets } from "../../api/datasets";
import {
  createExperiment,
  preflightExperiment,
  getExperiment,
  startExperiment,
  unlockExperimentValidation,
} from "../../api/experiments";
import { ApiError } from "../../api/system";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";

function parseValues(raw: string) {
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        return value;
      }
    });
}

function ErrorText({ error }: { error: unknown }) {
  return error instanceof ApiError ? (
    <p className="text-sm text-destructive" role="alert">
      {error.message}
    </p>
  ) : null;
}

export function ExperimentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const planId = searchParams.get("plan");
  const datasets = useQuery({
    queryKey: ["datasets", "experiments"],
    queryFn: () => listDatasets(),
  });
  const versions = useQuery({
    queryKey: ["algorithm-versions", "bull_call_spread", "experiments"],
    queryFn: () => listAlgorithmVersions("bull_call_spread"),
  });
  const correctedVersions = useMemo(
    () =>
      versions.data?.items.filter(
        (item) =>
          item.code_version === "1.2.0-bull-call-spread-v1" && !item.archived,
      ) ?? [],
    [versions.data],
  );
  const [name, setName] = useState("Bull Call Spread controlled experiment");
  const [hypothesis, setHypothesis] = useState("");
  const [datasetVersionId, setDatasetVersionId] = useState("");
  const [baselineId, setBaselineId] = useState("");
  const [parameterKey, setParameterKey] = useState("lots");
  const [parameterValues, setParameterValues] = useState("2");
  const [developmentStart, setDevelopmentStart] = useState("");
  const [developmentEnd, setDevelopmentEnd] = useState("");
  const [validationStart, setValidationStart] = useState("");
  const [validationEnd, setValidationEnd] = useState("");
  const [capital, setCapital] = useState("500000.00");
  const [selectedVersionId, setSelectedVersionId] = useState("");

  useEffect(() => {
    if (!datasetVersionId) {
      const latest = datasets.data?.items.find(
        (item) => item.latest_version,
      )?.latest_version;
      if (latest) setDatasetVersionId(latest.id);
    }
    if (!baselineId && correctedVersions[0])
      setBaselineId(correctedVersions[0].id);
  }, [baselineId, correctedVersions, datasetVersionId, datasets.data]);

  const schema = useQuery({
    queryKey: ["algorithm-schema", "bull_call_spread"],
    queryFn: () => getAlgorithmSchema("bull_call_spread"),
  });
  const properties = (schema.data?.schema.properties ?? {}) as Record<
    string,
    { editable?: boolean; label?: string; const?: unknown }
  >;
  const editable = Object.entries(properties).filter(
    ([, field]) => field.editable !== false && field.const === undefined,
  );
  const planInput = {
    name,
    hypothesis,
    baseline_algorithm_version_id: baselineId,
    dataset_version_id: datasetVersionId,
    parameter_key: parameterKey,
    parameter_values: parseValues(parameterValues),
    development_start_date: developmentStart,
    development_end_date: developmentEnd,
    validation_start_date: validationStart,
    validation_end_date: validationEnd,
    coverage_digest: "0".repeat(64),
    starting_capital: capital,
  };
  const developmentInputKey = JSON.stringify(planInput);
  const developmentPreflight = useMutation({
    mutationFn: async () => ({
      ...(await preflightExperiment(planInput)),
      inputKey: developmentInputKey,
    }),
  });
  const create = useMutation({
    mutationFn: () =>
      createExperiment({
        name,
        hypothesis,
        baseline_algorithm_version_id: baselineId,
        dataset_version_id: datasetVersionId,
        parameter_key: parameterKey,
        parameter_values: parseValues(parameterValues),
        development_start_date: developmentStart,
        development_end_date: developmentEnd,
        validation_start_date: validationStart,
        validation_end_date: validationEnd,
        coverage_digest: developmentPreflight.data!.coverage_digest,
        starting_capital: capital,
        notes:
          "Explicit variants only; no automatic optimization or promotion.",
      }),
    onSuccess: (plan) => setSearchParams({ plan: plan.id }),
  });
  const batch = useQuery({
    queryKey: ["experiment", planId],
    queryFn: () => getExperiment(planId!),
    enabled: Boolean(planId),
    refetchInterval: (query) =>
      query.state.data?.plan.status.endsWith("RUNNING") ? 4_000 : false,
  });
  const start = useMutation({
    mutationFn: () => startExperiment(planId!),
    onSuccess: (value) =>
      queryClient.setQueryData(["experiment", planId], value),
  });
  const validationPreflight = useMutation({
    mutationFn: async () => ({
      ...(await preflightBacktest({
        dataset_version_id: batch.data!.plan.dataset_version_id,
        algorithm_version_id: selectedVersionId,
        start_date: batch.data!.plan.validation_start_date,
        end_date: batch.data!.plan.validation_end_date,
        starting_capital: String(batch.data!.plan.starting_capital),
        warning_acknowledged: true,
      })),
      selectedVersionId,
    }),
  });
  const unlock = useMutation({
    mutationFn: () =>
      unlockExperimentValidation(
        planId!,
        selectedVersionId,
        validationPreflight.data!.coverage_digest,
      ),
    onSuccess: (value) =>
      queryClient.setQueryData(["experiment", planId], value),
  });

  const canReview = Boolean(
    datasetVersionId &&
    baselineId &&
    developmentStart &&
    developmentEnd &&
    validationStart &&
    validationEnd,
  );
  const values = parseValues(parameterValues);

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6">
      <header className="rounded-2xl border border-border bg-surface p-5">
        <p className="m-0 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-brand">
          <FlaskConical size={16} /> Research controls
        </p>
        <h1 className="mb-0 mt-2 text-3xl font-bold text-foreground">
          Controlled experiments
        </h1>
        <p className="mb-0 mt-2 max-w-3xl text-sm text-muted-foreground">
          Test one approved parameter with one baseline and up to nine explicit
          variants. Runs execute sequentially. The later validation period stays
          locked until every development run completes and a partner selects one
          candidate.
        </p>
      </header>

      {!planId ? (
        <Card>
          <CardHeader>
            <CardTitle>Create immutable plan</CardTitle>
            <CardDescription>
              The plan records the hypothesis, exact values, data, chronological
              split, and coverage digest.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                Plan name
                <input
                  className="rounded-lg border border-border bg-surface p-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Starting capital
                <input
                  className="rounded-lg border border-border bg-surface p-2"
                  value={capital}
                  onChange={(e) => setCapital(e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-sm sm:col-span-2">
                Hypothesis
                <textarea
                  className="min-h-24 rounded-lg border border-border bg-surface p-2"
                  value={hypothesis}
                  onChange={(e) => setHypothesis(e.target.value)}
                  placeholder="What single change do you expect, and why?"
                />
              </label>
              <label className="grid gap-1 text-sm">
                Corrected baseline
                <select
                  className="rounded-lg border border-border bg-surface p-2"
                  value={baselineId}
                  onChange={(e) => setBaselineId(e.target.value)}
                >
                  {correctedVersions.map((item) => (
                    <option key={item.id} value={item.id}>
                      v{item.version_number} · {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                Dataset version
                <select
                  className="rounded-lg border border-border bg-surface p-2"
                  value={datasetVersionId}
                  onChange={(e) => setDatasetVersionId(e.target.value)}
                >
                  {datasets.data?.items.flatMap((item) =>
                    item.latest_version
                      ? [
                          <option
                            key={item.latest_version.id}
                            value={item.latest_version.id}
                          >
                            {item.name} · v{item.latest_version.version_number}
                          </option>,
                        ]
                      : [],
                  )}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                One parameter
                <select
                  className="rounded-lg border border-border bg-surface p-2"
                  value={parameterKey}
                  onChange={(e) => setParameterKey(e.target.value)}
                >
                  {editable.map(([key, field]) => (
                    <option key={key} value={key}>
                      {field.label ?? key}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                Explicit variants, comma separated
                <input
                  className="rounded-lg border border-border bg-surface p-2 font-mono"
                  value={parameterValues}
                  onChange={(e) => setParameterValues(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">
                  {values.length} variants + 1 baseline; maximum batch size 10.
                </span>
              </label>
              <label className="grid gap-1 text-sm">
                Development start
                <input
                  type="date"
                  className="rounded-lg border border-border bg-surface p-2"
                  value={developmentStart}
                  onChange={(e) => setDevelopmentStart(e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Development end
                <input
                  type="date"
                  className="rounded-lg border border-border bg-surface p-2"
                  value={developmentEnd}
                  onChange={(e) => setDevelopmentEnd(e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Reserved validation start
                <input
                  type="date"
                  className="rounded-lg border border-border bg-surface p-2"
                  value={validationStart}
                  onChange={(e) => setValidationStart(e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Reserved validation end
                <input
                  type="date"
                  className="rounded-lg border border-border bg-surface p-2"
                  value={validationEnd}
                  onChange={(e) => setValidationEnd(e.target.value)}
                />
              </label>
            </div>
            <Button
              onClick={() => developmentPreflight.mutate()}
              disabled={
                !canReview ||
                developmentPreflight.isPending ||
                values.length < 1 ||
                values.length > 9
              }
            >
              <ShieldCheck className="mr-2 h-4 w-4" /> Review development
              coverage
            </Button>
            {developmentPreflight.data && (
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 text-sm">
                <strong>
                  {developmentPreflight.data.allowed
                    ? "Coverage reviewed"
                    : "Coverage blocked"}
                </strong>
                {developmentPreflight.data.variants.map((variant) => (
                  <details key={String(variant.variant_index)}>
                    <summary>
                      Variant {String(variant.variant_index)}:{" "}
                      {String(variant.included_session_count)} included sessions
                      ·{" "}
                      {Array.isArray(variant.excluded_sessions)
                        ? variant.excluded_sessions.length
                        : 0}{" "}
                      excluded
                    </summary>
                    <ul className="list-disc pl-5">
                      {(Array.isArray(variant.excluded_sessions)
                        ? variant.excluded_sessions
                        : []
                      ).map((raw, index) => {
                        const exclusion = raw as Record<string, unknown>;
                        return (
                          <li key={index}>
                            {String(exclusion.session_date)}:{" "}
                            {String(exclusion.reason_code)
                              .toLowerCase()
                              .replaceAll("_", " ")}
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                ))}
                {developmentPreflight.data.issues.map((issue) => (
                  <p key={issue} role="alert">
                    {issue}
                  </p>
                ))}
                <p className="text-xs text-muted-foreground">
                  Digest {developmentPreflight.data.coverage_digest}
                </p>
                <Button
                  onClick={() => create.mutate()}
                  disabled={
                    !hypothesis.trim() ||
                    create.isPending ||
                    !developmentPreflight.data.allowed ||
                    developmentPreflight.data.inputKey !== developmentInputKey
                  }
                >
                  Acknowledge coverage and create plan
                </Button>
              </div>
            )}
            <ErrorText error={developmentPreflight.error ?? create.error} />
          </CardContent>
        </Card>
      ) : batch.data ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{batch.data.plan.name}</CardTitle>
              <CardDescription>{batch.data.plan.hypothesis}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="rounded-full border border-border px-3 py-1 font-semibold">
                {batch.data.plan.status.replaceAll("_", " ")}
              </span>
              {batch.data.plan.status === "DRAFT" && (
                <Button
                  onClick={() => start.mutate()}
                  disabled={start.isPending}
                >
                  <Play className="mr-2 h-4 w-4" /> Start sequential batch
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>All tested variants</CardTitle>
              <CardDescription>
                Poor and strong outcomes remain visible. Selecting a row does
                not promote it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {batch.data.runs
                .filter((item) => item.phase === "DEVELOPMENT")
                .map((item) => (
                  <label
                    key={item.id}
                    className="flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 focus-within:ring-2 focus-within:ring-brand"
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="candidate"
                        checked={
                          selectedVersionId === item.algorithm_version_id
                        }
                        onChange={() =>
                          setSelectedVersionId(item.algorithm_version_id)
                        }
                      />
                      <strong>
                        {item.variant_index === 0
                          ? "Baseline"
                          : `Variant ${item.variant_index}`}
                      </strong>
                      <span className="font-mono text-xs">
                        {batch.data.plan.parameter_key}=
                        {JSON.stringify(item.parameter_value)}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.run_status} · net{" "}
                      {String(item.outcome_metrics.net_outcome ?? "—")} · trades{" "}
                      {String(item.outcome_metrics.total_trades ?? "—")}
                    </span>
                    <Link
                      className="text-xs font-semibold text-brand underline"
                      to={`/backtests/${item.backtest_run_id}`}
                    >
                      Inspect run
                    </Link>
                  </label>
                ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LockKeyhole size={18} /> Reserved validation
              </CardTitle>
              <CardDescription>
                {batch.data.plan.validation_start_date} →{" "}
                {batch.data.plan.validation_end_date}. One candidate, one
                validation run.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {batch.data.runs.some((item) => item.phase === "VALIDATION") ? (
                batch.data.runs
                  .filter((item) => item.phase === "VALIDATION")
                  .map((item) => (
                    <Link
                      key={item.id}
                      className="font-semibold text-brand underline"
                      to={`/backtests/${item.backtest_run_id}`}
                    >
                      Open validation run · {item.run_status}
                    </Link>
                  ))
              ) : (
                <>
                  <Button
                    variant="outline"
                    disabled={
                      !selectedVersionId ||
                      batch.data.plan.status !== "DEVELOPMENT_COMPLETE" ||
                      validationPreflight.isPending
                    }
                    onClick={() => validationPreflight.mutate()}
                  >
                    Review validation coverage
                  </Button>
                  {validationPreflight.data && (
                    <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
                      {validationPreflight.data.included_session_count} included
                      · {validationPreflight.data.excluded_session_count}{" "}
                      excluded
                      <Button
                        className="ml-3"
                        onClick={() => unlock.mutate()}
                        disabled={
                          unlock.isPending ||
                          validationPreflight.data.selectedVersionId !==
                            selectedVersionId ||
                          validationPreflight.data.coverage_status === "BLOCKED"
                        }
                      >
                        Partner selected: unlock once
                      </Button>
                    </div>
                  )}
                </>
              )}
              <ErrorText
                error={validationPreflight.error ?? unlock.error ?? start.error}
              />
            </CardContent>
          </Card>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Loading experiment…</p>
      )}
    </section>
  );
}
