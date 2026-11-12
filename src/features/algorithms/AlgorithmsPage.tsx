import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sliders,
  Save,
  ShieldAlert,
  Archive,
  Copy,
  CheckCircle2,
} from "lucide-react";

import {
  archiveAlgorithmVersion,
  checkCompatibility,
  getAlgorithmSchema,
  listAlgorithms,
  listAlgorithmVersions,
  saveAlgorithmVersion,
  validateAlgorithm,
  type AlgorithmVersion,
} from "../../api/algorithms";
import { listDatasets } from "../../api/datasets";
import { listBacktests } from "../../api/backtests";
import { ApiError } from "../../api/system";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppSelect } from "@/components/ui/app-select";

import { cn } from "@/lib/utils";

type Property = {
  title?: string;
  type?: string;
  format?: string;
  enum?: string[];
  default?: unknown;
  label?: string;
  help?: string;
  group?: string;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  experimental?: boolean;
  editable?: boolean;
  section?: string;
  order?: number;
  unit?: string;
  control?: string;
};

type VersionPerformance = AlgorithmVersion & {
  onClone: (id: string) => void;
  onArchive: (id: string) => void;
};

function VersionPerformanceCard({ version }: { version: VersionPerformance }) {
  const runsQuery = useQuery({
    queryKey: ["backtests", "algorithm-version", version.id],
    queryFn: () => listBacktests({ algorithmVersionId: version.id }),
  });

  const runs = runsQuery.data?.items ?? [];
  const completed = runs.filter((r) => r.status === "COMPLETED").length;
  const failed = runs.filter((r) => r.status === "FAILED").length;
  const successRate = runs.length
    ? Math.round((completed / runs.length) * 100)
    : null;

  return (
    <Card
      className={cn(
        "glass-card border-border/50 hover:border-border transition-colors group",
        version.archived && "opacity-60",
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              v{version.version_number} · {version.name}
              {version.archived && (
                <Badge
                  variant="secondary"
                  className="bg-muted text-muted-foreground"
                >
                  Archived
                </Badge>
              )}
              {!version.archived && (
                <Badge
                  variant="secondary"
                  className="bg-success/10 text-success border-success/30"
                >
                  Active
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1 font-mono text-xs">
              Code: {version.code_version}
            </CardDescription>
          </div>
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-brand"
              onClick={() => version.onClone(version.id)}
            >
              <Copy className="h-4 w-4" />
            </Button>
            {!version.archived && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => version.onArchive(version.id)}
              >
                <Archive className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="grid grid-cols-3 gap-2 text-center text-xs my-2">
          <div className="rounded-md bg-surface/50 border border-border/50 p-2">
            <span className="block text-muted-foreground text-[10px] uppercase tracking-wider mb-1">
              Total Runs
            </span>
            <strong className="text-sm font-semibold text-foreground">
              {runs.length}
            </strong>
          </div>
          <div className="rounded-md bg-surface/50 border border-border/50 p-2">
            <span className="block text-muted-foreground text-[10px] uppercase tracking-wider mb-1">
              Success Rate
            </span>
            <strong className="text-sm font-semibold text-foreground">
              {successRate !== null ? `${successRate}%` : "—"}
            </strong>
          </div>
          <div className="rounded-md bg-surface/50 border border-border/50 p-2">
            <span className="block text-muted-foreground text-[10px] uppercase tracking-wider mb-1">
              Failures
            </span>
            <strong className="text-sm font-semibold text-destructive">
              {failed}
            </strong>
          </div>
        </div>
        {version.notes && (
          <p className="text-xs text-muted-foreground italic line-clamp-2 mt-3 bg-muted/20 p-2 rounded-md border border-border/30">
            {version.notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ErrorText({ error }: { error: unknown }) {
  if (!(error instanceof ApiError)) return null;
  return (
    <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-lg flex items-start gap-2">
      <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
      <div>
        <p className="font-medium m-0">{error.message}</p>
        {error.requestId && (
          <p className="text-[10px] opacity-80 mt-0.5">
            Request ID: {error.requestId}
          </p>
        )}
      </div>
    </div>
  );
}

export function AlgorithmsPage() {
  const queryClient = useQueryClient();
  const catalog = useQuery({
    queryKey: ["algorithms"],
    queryFn: listAlgorithms,
  });
  const algorithm =
    catalog.data?.items.find((item) => item.key === "bull_call_spread") ??
    catalog.data?.items[0];
  const schema = useQuery({
    queryKey: ["algorithm-schema", algorithm?.key],
    queryFn: () => getAlgorithmSchema(algorithm!.key),
    enabled: Boolean(algorithm),
  });
  const versions = useQuery({
    queryKey: ["algorithm-versions", algorithm?.key],
    queryFn: () => listAlgorithmVersions(algorithm!.key),
    enabled: Boolean(algorithm),
  });
  const datasets = useQuery({
    queryKey: ["datasets", "algorithm-compatibility"],
    queryFn: () => listDatasets(),
  });
  const datasetVersionId = datasets.data?.items.find(
    (item) => item.latest_version,
  )?.latest_version?.id;
  const compatibility = useQuery({
    queryKey: ["algorithm-compatibility", algorithm?.key, datasetVersionId],
    queryFn: () => checkCompatibility(algorithm!.key, datasetVersionId!),
    enabled: Boolean(algorithm && datasetVersionId),
  });
  const [parameters, setParameters] = useState<Record<string, unknown>>({});
  const [templateKey, setTemplateKey] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const validation = useMutation({
    mutationFn: () => validateAlgorithm(algorithm!.key, parameters),
  });
  const save = useMutation({
    mutationFn: () =>
      saveAlgorithmVersion(algorithm!.key, {
        name,
        notes,
        parent_version_id: parentId,
        parameters,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["algorithm-versions", algorithm?.key],
      });
      setParentId(null);
    },
  });
  const archive = useMutation({
    mutationFn: archiveAlgorithmVersion,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["algorithm-versions", algorithm?.key],
      });
    },
  });
  const properties = useMemo(
    () => (schema.data?.schema.properties ?? {}) as Record<string, Property>,
    [schema.data],
  );
  const sections = useMemo(() => {
    const grouped = new Map<string, Array<[string, Property]>>();
    for (const entry of Object.entries(properties).sort(
      (left, right) => (left[1].order ?? 999) - (right[1].order ?? 999),
    )) {
      const section = entry[1].section ?? entry[1].group ?? "Parameters";
      grouped.set(section, [...(grouped.get(section) ?? []), entry]);
    }
    return [...grouped.entries()];
  }, [properties]);
  const fieldErrors = useMemo(
    () =>
      new Map(
        (validation.data?.errors ?? []).map((error) => [
          error.field,
          error.message,
        ]),
      ),
    [validation.data],
  );
  const maximumScore = [
    "pdh_weight",
    "vwap_weight",
    "rsi_weight",
    "vix_weight",
  ].reduce(
    (total, key) =>
      total + Number(parameters[key] ?? properties[key]?.default ?? 0),
    0,
  );
  const usesMandatoryPriceGates =
    Number(parameters.pdh_weight ?? properties.pdh_weight?.default ?? 0) ===
      0 &&
    Number(parameters.vwap_weight ?? properties.vwap_weight?.default ?? 0) ===
      0;

  useEffect(() => {
    const template = algorithm?.templates[0];
    if (!template || templateKey || Object.keys(parameters).length) return;
    setTemplateKey(template.key);
    setParameters({ ...template.parameters });
    setName(template.name);
  }, [algorithm, parameters, templateKey]);

  function chooseTemplate(key: string) {
    const template = algorithm?.templates.find((item) => item.key === key);
    setTemplateKey(key);
    setParentId(null);
    setParameters(template ? { ...template.parameters } : {});
    setName(template ? `${template.name} research` : "");
    validation.reset();
    save.reset();
  }
  function cloneVersion(id: string) {
    const version = versions.data?.items.find((item) => item.id === id);
    if (!version) return;
    setParentId(version.id);
    setTemplateKey("");
    setParameters({ ...version.parameters });
    setName(`${version.name} clone`);
    setNotes(version.notes ?? "");
  }
  function change(key: string, property: Property, raw: string) {
    const value =
      property.type === "integer"
        ? Number.parseInt(raw, 10)
        : property.type === "number"
          ? Number(raw)
          : raw;
    setParameters((current) => ({ ...current, [key]: value }));
    validation.reset();
  }

  function changeBoolean(key: string, value: boolean) {
    setParameters((current) => ({ ...current, [key]: value }));
    validation.reset();
  }

  if (catalog.isPending)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
      </div>
    );

  if (!algorithm)
    return (
      <div className="max-w-7xl mx-auto flex flex-col gap-6 w-full animate-in fade-in duration-500">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground m-0">
          Algorithms
        </h1>
        <ErrorText error={catalog.error} />
        <Card className="glass-card">
          <CardContent className="p-12 text-center text-muted-foreground flex flex-col items-center">
            <Sliders className="h-10 w-10 mb-4 opacity-20" />
            No active algorithms are registered in the system.
          </CardContent>
        </Card>
      </div>
    );

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6 w-full animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
        <div>
          <Badge
            variant="outline"
            className="bg-brand/10 text-brand border-brand/20 uppercase tracking-widest text-[10px] font-bold mb-2"
          >
            Bull Call Spread V1 · Immutable versions
          </Badge>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground m-0 flex items-center gap-2">
            {algorithm.display_name}
          </h1>
          <p className="text-sm text-muted-foreground m-0 mt-1.5 max-w-2xl">
            {algorithm.description}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column - Algorithm Info */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg">
                Capabilities & Requirements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Required Capabilities
                </p>
                <div className="flex flex-wrap gap-2">
                  {algorithm.required_capabilities.map((capability) => (
                    <Badge
                      key={capability}
                      variant="secondary"
                      className="bg-muted/50 border-border/50 text-xs"
                    >
                      {capability.replaceAll("_", " ")}
                    </Badge>
                  ))}
                </div>
              </div>

              {compatibility.data && (
                <div
                  className={cn(
                    "p-4 rounded-lg border flex items-start gap-3",
                    compatibility.data.compatible
                      ? "bg-success/10 border-success/30 text-success"
                      : "bg-warning/10 border-warning/30 text-warning",
                  )}
                >
                  {compatibility.data.compatible ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                  ) : (
                    <ShieldAlert className="h-5 w-5 shrink-0" />
                  )}
                  <div className="text-sm font-medium">
                    {compatibility.data.compatible
                      ? "The selected dataset is fully compatible."
                      : `Current NIFTY dataset is incompatible. Missing: ${compatibility.data.missing_capabilities.join(", ")}.`}
                  </div>
                </div>
              )}

              <div className="bg-warning/10 border border-warning/30 text-warning p-4 rounded-lg text-sm">
                <strong>Estimated historical pricing.</strong> Option fills use
                completed candle closes plus adverse slippage. They are not
                executable bid/ask fills, and live trading remains disabled.
              </div>

              <dl className="grid grid-cols-2 gap-4 text-xs bg-surface/30 p-4 rounded-lg border border-border/50">
                <div>
                  <dt className="text-muted-foreground mb-1 uppercase tracking-wider font-semibold text-[10px]">
                    Code version
                  </dt>
                  <dd className="font-mono text-foreground">
                    {algorithm.code_version}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground mb-1 uppercase tracking-wider font-semibold text-[10px]">
                    Mode
                  </dt>
                  <dd className="font-medium text-foreground">
                    {algorithm.supported_modes.join(", ")}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted-foreground mb-1 uppercase tracking-wider font-semibold text-[10px]">
                    RSI implementation
                  </dt>
                  <dd className="font-medium text-foreground">
                    Configurable Wilder/RMA using completed candles
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg">Saved Versions</CardTitle>
              <CardDescription>
                Performance of immutable variants
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {versions.data?.items.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg bg-surface/30">
                  No versions saved yet. Use the configurator to save your first
                  version.
                </div>
              )}
              {versions.data?.items.map((version) => (
                <VersionPerformanceCard
                  key={version.id}
                  version={{
                    ...version,
                    onClone: cloneVersion,
                    onArchive: archive.mutate,
                  }}
                />
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Configurator */}
        <div className="lg:col-span-2">
          <Card className="glass-card">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle>Configure an immutable V1 version</CardTitle>
              <CardDescription>
                Change approved values here. Saving always creates a new
                version; it never changes an existing run or version.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid gap-7">
                <section className="grid grid-cols-1 gap-4 rounded-lg border border-border/60 bg-surface/20 p-4">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground m-0">
                      Version
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1 mb-0">
                      Name this reproducible variant and record why it differs.
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Version name
                    </label>
                    <input
                      className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                      value={name}
                      placeholder="e.g. Conservative weekly expiry"
                      maxLength={200}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Notes
                    </label>
                    <textarea
                      className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand min-h-[76px]"
                      value={notes}
                      placeholder="What is different about this version?"
                      maxLength={5000}
                      onChange={(event) => setNotes(event.target.value)}
                    />
                  </div>
                </section>

                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-foreground">
                    Starting defaults
                  </span>
                  <AppSelect
                    value={templateKey || "__no_template__"}
                    onValueChange={(value) =>
                      chooseTemplate(value === "__no_template__" ? "" : value)
                    }
                    options={[
                      {
                        value: "__no_template__",
                        label: "Choose a template to start…",
                      },
                      ...algorithm.templates.map((template) => ({
                        value: template.key,
                        label: template.name,
                      })),
                    ]}
                    placeholder="Choose a template to start…"
                    ariaLabel="Starting defaults"
                  />
                </div>

                {parentId && (
                  <div className="bg-brand/10 border border-brand/20 text-brand px-4 py-2 rounded-md text-sm flex items-center gap-2">
                    <Copy className="h-4 w-4" />
                    Cloning from parent version:{" "}
                    <span className="font-mono font-bold">
                      {parentId.slice(0, 8)}
                    </span>
                  </div>
                )}

                {sections.map(([section, entries]) => (
                  <fieldset
                    key={section}
                    className="rounded-lg border border-border/60 p-4"
                  >
                    <legend className="px-1 text-sm font-semibold text-foreground">
                      {section}
                    </legend>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                      {entries.map(([key, property]) => {
                        const error = fieldErrors.get(key);
                        const label = property.label ?? property.title ?? key;
                        const editable = property.editable !== false;
                        return (
                          <div key={key} className="flex flex-col gap-1.5">
                            <label
                              className="text-xs font-semibold text-foreground flex items-center justify-between gap-2"
                              htmlFor={`parameter-${key}`}
                            >
                              <span>{label}</span>
                              <span className="flex items-center gap-1">
                                {property.unit && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px]"
                                  >
                                    {property.unit}
                                  </Badge>
                                )}
                                {!editable && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px]"
                                  >
                                    Fixed
                                  </Badge>
                                )}
                              </span>
                            </label>
                            {property.type === "boolean" ? (
                              <label className="flex min-h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm cursor-pointer">
                                <input
                                  id={`parameter-${key}`}
                                  type="checkbox"
                                  checked={Boolean(
                                    parameters[key] ?? property.default,
                                  )}
                                  disabled={!editable}
                                  onChange={(event) =>
                                    changeBoolean(key, event.target.checked)
                                  }
                                  className="h-4 w-4 accent-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                                />
                                {(parameters[key] ?? property.default)
                                  ? "Enabled"
                                  : "Disabled"}
                              </label>
                            ) : property.enum ? (
                              <AppSelect
                                value={String(
                                  parameters[key] ?? property.default ?? "",
                                )}
                                onValueChange={(value) =>
                                  change(key, property, value)
                                }
                                options={property.enum.map((value) => ({
                                  value,
                                  label: value,
                                }))}
                                placeholder="Choose a value…"
                                ariaLabel={label}
                              />
                            ) : (
                              <input
                                id={`parameter-${key}`}
                                disabled={!editable}
                                className={cn(
                                  "w-full bg-surface border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50",
                                  error
                                    ? "border-destructive"
                                    : "border-border",
                                )}
                                type={
                                  property.format === "time"
                                    ? "time"
                                    : property.type === "number" ||
                                        property.type === "integer"
                                      ? "number"
                                      : "text"
                                }
                                step={
                                  property.type === "number" ? "any" : undefined
                                }
                                min={
                                  property.minimum ?? property.exclusiveMinimum
                                }
                                max={
                                  property.maximum ?? property.exclusiveMaximum
                                }
                                value={String(
                                  parameters[key] ?? property.default ?? "",
                                )}
                                onChange={(event) =>
                                  change(key, property, event.target.value)
                                }
                              />
                            )}
                            {property.help && (
                              <p className="text-[11px] text-muted-foreground m-0">
                                {property.help}
                              </p>
                            )}
                            {error && (
                              <p
                                className="text-[11px] text-destructive m-0"
                                role="alert"
                              >
                                {error}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}

                <section className="rounded-lg border border-brand/25 bg-brand/5 p-4">
                  <h2 className="text-sm font-semibold text-foreground m-0">
                    Live rule summary
                  </h2>
                  <p className="mt-2 mb-0 text-sm text-muted-foreground">
                    {usesMandatoryPriceGates ? (
                      <>
                        Require spot above PDH and{" "}
                        {algorithm?.fixed_rules.vwap_comparison_price ===
                        "nifty_futures_close"
                          ? "futures close"
                          : "spot close"}{" "}
                        above futures VWAP, then enter when RSI/VIX confirmation
                        is at least {String(parameters.minimum_score ?? 3)} of{" "}
                        {maximumScore}.
                      </>
                    ) : (
                      <>
                        Enter when the completed-candle score is at least{" "}
                        {String(parameters.minimum_score ?? 7)} of{" "}
                        {maximumScore}.
                      </>
                    )}{" "}
                    Buy ATM CE and sell the configured higher-strike CE. The
                    system uses completed candles, Wilder RSI, blocks monthly
                    expiry, and rejects missing pre-entry data.
                  </p>
                </section>
                <section className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm">
                  <h2 className="text-sm font-semibold text-foreground m-0">
                    Deferred data rules
                  </h2>
                  <p className="mt-2 mb-0 text-muted-foreground">
                    Historical bid/ask quotes, liquidity thresholds, and the
                    non-monthly event calendar are intentionally deferred.
                    Results are labelled historical estimates, never executable
                    fills.
                  </p>
                </section>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col items-stretch gap-4 bg-surface/30 border-t border-border/50 p-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={
                    !Object.keys(parameters).length || validation.isPending
                  }
                  onClick={() => validation.mutate()}
                >
                  Validate Parameters
                </Button>
                <Button
                  className="flex-1 bg-brand hover:bg-brand/90"
                  disabled={
                    !name.trim() || !validation.data?.valid || save.isPending
                  }
                  onClick={() => save.mutate()}
                >
                  <Save className="h-4 w-4 mr-2" /> Save New Version
                </Button>
              </div>

              {validation.data?.valid && (
                <div className="bg-success/10 text-success p-3 rounded-md text-sm flex items-center justify-center gap-2 border border-success/20">
                  <CheckCircle2 className="h-4 w-4" /> Parameters are valid.
                  Ready to save.
                </div>
              )}

              {validation.data && !validation.data.valid && (
                <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm border border-destructive/20">
                  <p className="font-bold mb-2">Validation Errors:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    {validation.data.errors.map((error) => (
                      <li key={`${error.field}-${error.message}`}>
                        <strong>{error.field}</strong>: {error.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {save.isSuccess && (
                <div className="bg-success/10 text-success p-3 rounded-md text-sm flex items-center justify-center gap-2 border border-success/20">
                  <CheckCircle2 className="h-4 w-4" /> Saved new version
                  successfully.
                </div>
              )}

              <ErrorText error={validation.error ?? save.error} />
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
