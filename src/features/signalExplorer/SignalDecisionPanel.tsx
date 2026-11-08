import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleMinus,
  ExternalLink,
  XCircle,
} from "lucide-react";

import { getSignalDetail } from "../../api/backtests";
import { formatPlatformDateTime } from "../../lib/dateTime";
import { ApiError } from "../../api/system";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

type Props = {
  runId: string;
  signalId: string | undefined;
  onClose: () => void;
  onSelectSignal: (id: string) => void;
  onSelectTrade: (id: string) => void;
};

function JsonEvidence({ value }: { value: unknown }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-border bg-surface-subtle p-3 text-xs text-muted">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "passed")
    return <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />;
  if (status === "failed")
    return <XCircle className="h-4 w-4 text-danger" aria-hidden />;
  if (status === "not_evaluated")
    return <CircleMinus className="h-4 w-4 text-muted" aria-hidden />;
  return <CircleAlert className="h-4 w-4 text-brand" aria-hidden />;
}

function titleCase(value: string) {
  return value.replaceAll("_", " ");
}

export function SignalDecisionPanel({
  runId,
  signalId,
  onClose,
  onSelectSignal,
  onSelectTrade,
}: Props) {
  const location = useLocation();
  const detail = useQuery({
    queryKey: ["signal-decision-detail", runId, signalId],
    queryFn: () => getSignalDetail(runId, signalId ?? ""),
    enabled: Boolean(runId && signalId),
    retry: false,
  });
  const data = detail.data;
  const relatedTrade = data?.related_trade;
  const returnTo = `${location.pathname}${location.search}`;

  return (
    <Dialog
      open={Boolean(signalId)}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="flex max-h-[92vh] max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="border-b border-border px-6 py-5 pr-12">
          <DialogTitle>Signal decision evidence</DialogTitle>
          <DialogDescription>
            Immutable backend evidence for this one signal. It does not
            recalculate strategy rules.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1 px-6">
          <div className="space-y-6 py-5">
            {detail.isLoading && (
              <p className="text-sm text-muted">Loading decision evidence…</p>
            )}
            {detail.isError && (
              <p className="text-sm text-danger" role="alert">
                {detail.error instanceof ApiError
                  ? detail.error.message
                  : "This signal explanation could not be loaded."}
              </p>
            )}
            {data && (
              <>
                <section className="rounded-lg border border-border bg-surface-subtle/50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="m-0 text-sm font-semibold text-foreground">
                        {data.signal.decision === "ACCEPTED"
                          ? "Accepted"
                          : "Rejected"}{" "}
                        signal
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {formatPlatformDateTime(data.signal.timestamp)} · Signal
                        #{data.signal.sequence}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant={
                          data.signal.decision === "ACCEPTED"
                            ? "outline"
                            : "destructive"
                        }
                        className={
                          data.signal.decision === "ACCEPTED"
                            ? "border-success/40 text-success"
                            : undefined
                        }
                      >
                        {data.signal.decision}
                      </Badge>
                      <Badge variant="outline">
                        Score: {data.signal.score ?? "—"}
                      </Badge>
                      {data.signal.window && (
                        <Badge variant="outline">
                          {titleCase(data.signal.window)}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-muted">Primary reason</dt>
                      <dd className="mt-1 font-mono text-sm text-foreground">
                        {data.diagnostic?.primary_reason ??
                          data.signal.rejection_reason ??
                          "ACCEPTED"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Evidence schema</dt>
                      <dd className="mt-1 font-mono text-sm text-foreground">
                        {data.diagnostic?.schema_version ??
                          "Legacy raw evidence"}
                      </dd>
                    </div>
                  </dl>
                </section>

                {data.execution_rejection && (
                  <section className="rounded-lg border border-warning/40 bg-warning/5 p-4">
                    <h3 className="m-0 text-sm font-semibold text-foreground">
                      Option entry rejected
                    </h3>
                    <p className="mt-1 text-sm text-muted">
                      {data.signal.decision === "ACCEPTED"
                        ? "The strategy accepted this signal, but no spread was opened"
                        : "No spread was opened"}{" "}
                      at{" "}
                      {formatPlatformDateTime(
                        data.execution_rejection.timestamp,
                      )}
                      .
                    </p>
                    <p className="mt-2 font-mono text-xs text-foreground">
                      {data.execution_rejection.reason}
                    </p>
                    <JsonEvidence value={data.execution_rejection.details} />
                  </section>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!data.previous_signal_id}
                    onClick={() =>
                      data.previous_signal_id &&
                      onSelectSignal(data.previous_signal_id)
                    }
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" /> Previous signal
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!data.next_signal_id}
                    onClick={() =>
                      data.next_signal_id && onSelectSignal(data.next_signal_id)
                    }
                  >
                    Next signal <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                  <Button asChild type="button" variant="ghost" size="sm">
                    <Link
                      to={`/library?algorithm=${encodeURIComponent(data.run_identity.algorithm_key)}&algorithmInspector=1&algorithmTab=logic`}
                      state={{ returnTo }}
                    >
                      View algorithm documentation{" "}
                      <ExternalLink className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>

                {!data.structured_explanation_available ? (
                  <section
                    className="space-y-3"
                    aria-labelledby="raw-evidence-heading"
                  >
                    <div>
                      <h3
                        id="raw-evidence-heading"
                        className="text-sm font-semibold text-foreground"
                      >
                        Limited historical evidence
                      </h3>
                      <p className="mt-1 text-sm text-muted">
                        No structured diagnostic was stored for this signal, so
                        the application does not infer an explanation.
                      </p>
                    </div>
                    <JsonEvidence value={data.raw_evidence} />
                  </section>
                ) : (
                  <>
                    <section aria-labelledby="evaluation-flow-heading">
                      <h3
                        id="evaluation-flow-heading"
                        className="text-sm font-semibold text-foreground"
                      >
                        Evaluation flow
                      </h3>
                      <ol className="mt-3 space-y-3 border-l border-border pl-4">
                        {data.diagnostic?.evaluation_steps.map((step) => (
                          <li
                            key={step.step_id}
                            className="relative rounded-md border border-border bg-surface p-3"
                          >
                            <div className="flex items-start gap-2">
                              <StatusIcon status={step.status} />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="m-0 text-sm font-medium text-foreground">
                                    {step.label}
                                  </p>
                                  <Badge
                                    variant="outline"
                                    className="capitalize"
                                  >
                                    {titleCase(step.status)}
                                  </Badge>
                                  {step.experimental && (
                                    <Badge variant="secondary">
                                      Experimental
                                    </Badge>
                                  )}
                                </div>
                                <p className="mt-1 text-xs text-muted">
                                  Documentation step:{" "}
                                  <span className="font-mono">
                                    {step.logic_step_id}
                                  </span>
                                </p>
                                {(step.observed_value !== null ||
                                  step.threshold_value !== null) && (
                                  <p className="mt-2 text-xs text-foreground">
                                    Observed:{" "}
                                    <span className="font-mono">
                                      {String(
                                        step.observed_value ?? "unavailable",
                                      )}
                                    </span>
                                    {step.comparator && (
                                      <> {step.comparator} </>
                                    )}
                                    {step.threshold_value !== null && (
                                      <span className="font-mono">
                                        {String(step.threshold_value)}
                                      </span>
                                    )}
                                    {step.unit && ` ${step.unit}`}
                                  </p>
                                )}
                                {step.score_contribution !== 0 && (
                                  <p className="mt-1 text-xs text-foreground">
                                    Score contribution:{" "}
                                    {step.score_contribution}
                                  </p>
                                )}
                                {step.reason_code && (
                                  <p className="mt-1 font-mono text-xs text-muted">
                                    {step.reason_code}
                                  </p>
                                )}
                                {Object.keys(step.evidence).length > 0 && (
                                  <div className="mt-2">
                                    <JsonEvidence value={step.evidence} />
                                  </div>
                                )}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </section>

                    <section aria-labelledby="market-context-heading">
                      <h3
                        id="market-context-heading"
                        className="text-sm font-semibold text-foreground"
                      >
                        Market context
                      </h3>
                      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                        {data.diagnostic?.market_context.map((context) => (
                          <div
                            key={context.key}
                            className="rounded-md border border-border bg-surface p-3"
                          >
                            <dt className="text-xs text-muted">
                              {context.label}
                            </dt>
                            <dd className="mt-1 font-mono text-sm text-foreground">
                              {context.available
                                ? String(context.exact_value)
                                : "Unavailable"}
                              {context.display_unit
                                ? ` ${context.display_unit}`
                                : ""}
                            </dd>
                            <p className="mt-1 text-[11px] text-muted">
                              Source: {context.source}
                            </p>
                          </div>
                        ))}
                      </dl>
                    </section>

                    <section aria-labelledby="parameters-heading">
                      <h3
                        id="parameters-heading"
                        className="text-sm font-semibold text-foreground"
                      >
                        Immutable parameter snapshot
                      </h3>
                      <p className="mt-1 text-xs text-muted">
                        Version: {data.diagnostic?.parameter_version_id}
                      </p>
                      <div className="mt-3">
                        <JsonEvidence
                          value={data.diagnostic?.parameter_snapshot}
                        />
                      </div>
                    </section>
                  </>
                )}

                {relatedTrade && (
                  <section
                    className="rounded-lg border border-border bg-surface p-4"
                    aria-labelledby="related-trade-heading"
                  >
                    <h3
                      id="related-trade-heading"
                      className="text-sm font-semibold text-foreground"
                    >
                      Explicitly linked synthetic trade
                    </h3>
                    <p className="mt-1 text-xs text-muted">
                      Trade #{relatedTrade.sequence} · {relatedTrade.unit} · not
                      financial P&amp;L
                    </p>
                    <Button
                      type="button"
                      variant="link"
                      className="mt-2 h-auto px-0"
                      onClick={() => onSelectTrade(relatedTrade.id)}
                    >
                      Inspect linked trade
                    </Button>
                  </section>
                )}

                {data.limitations.length > 0 && (
                  <section
                    className="rounded-lg border border-warning/30 bg-warning/10 p-4"
                    aria-labelledby="limitations-heading"
                  >
                    <h3
                      id="limitations-heading"
                      className="text-sm font-semibold text-foreground"
                    >
                      Limitations
                    </h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                      {data.limitations.map((limitation) => (
                        <li key={limitation}>{limitation}</li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
