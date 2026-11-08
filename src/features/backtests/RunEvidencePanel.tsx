import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import {
  getRunDiagnostics,
  listDayClassifications,
  listExecutionAttempts,
  listJournalEvents,
  type BacktestRun,
} from "../../api/backtests";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { formatPlatformDateTime } from "../../lib/dateTime";
import { formatCurrency } from "../../lib/formatters";

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

export function RunEvidencePanel({ run }: { run: BacktestRun }) {
  const refreshInterval =
    run.status === "RUNNING" || run.status === "PENDING" ? 3000 : false;
  const attempts = useQuery({
    refetchInterval: refreshInterval,
    queryKey: ["backtest-attempts", run.id],
    queryFn: () => listExecutionAttempts(run.id),
  });
  const days = useInfiniteQuery({
    refetchInterval: refreshInterval,
    queryKey: ["backtest-days", run.id],
    queryFn: ({ pageParam }) => listDayClassifications(run.id, pageParam, 500),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
  });
  const journal = useInfiniteQuery({
    refetchInterval: refreshInterval,
    queryKey: ["backtest-journal", run.id],
    queryFn: ({ pageParam }) => listJournalEvents(run.id, pageParam, 250),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
  });
  const diagnostics = useQuery({
    queryKey: ["backtest-diagnostics", run.id],
    queryFn: () => getRunDiagnostics(run.id),
    enabled: run.status === "COMPLETED",
  });

  const dayItems = days.data?.pages.flatMap((page) => page.items) ?? [];
  const journalItems = journal.data?.pages.flatMap((page) => page.items) ?? [];
  const dayCounts = days.data?.pages[0]?.counts ?? {};
  const activeAttempt = attempts.data?.items.find(
    (item) => item.id === attempts.data?.active_attempt_id,
  );
  const legacyJournal = journal.data?.pages[0]?.legacy_detail_unavailable;

  return (
    <div className="space-y-6">
      {activeAttempt && (
        <p className="text-xs text-muted-foreground">
          Execution attempt {activeAttempt.attempt_number} ·{" "}
          {label(activeAttempt.status)}
        </p>
      )}
      {(run.compatibility_warnings ?? []).map((warning) => (
        <p key={warning} className="text-xs text-warning">
          {warning}
        </p>
      ))}
      <details className="rounded-xl border border-border p-4">
        <summary className="cursor-pointer text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
          Daily summary · traded, skipped and excluded sessions
        </summary>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Daily outcomes</CardTitle>
            <CardDescription>
              One final classification for every requested trading session.
              Excluded sessions do not enter performance denominators.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {days.error && (
              <p role="alert" className="text-sm text-destructive">
                Could not load daily outcomes.{" "}
                <button onClick={() => days.refetch()} className="underline">
                  Retry
                </button>
              </p>
            )}
            <div className="mb-4 flex flex-wrap gap-2">
              {Object.entries(dayCounts).map(([key, value]) => (
                <span
                  key={key}
                  className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground"
                >
                  {label(key)}: {value}
                </span>
              ))}
            </div>
            <div className="max-h-[420px] overflow-auto rounded-lg border border-border">
              {dayItems.map((day) => (
                <details
                  key={day.id}
                  className="border-b border-border p-3 last:border-b-0"
                >
                  <summary className="cursor-pointer text-sm font-medium text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
                    <span className="font-mono">{day.session_date}</span> ·{" "}
                    {label(day.classification)}
                    {day.primary_reason
                      ? ` · ${label(day.primary_reason)}`
                      : ""}
                  </summary>
                  <pre className="mt-3 overflow-auto rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                    {JSON.stringify(day.evidence, null, 2)}
                  </pre>
                </details>
              ))}
              {!dayItems.length && (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  Day classifications are unavailable for this legacy or
                  unfinished run.
                </p>
              )}
            </div>
            {days.hasNextPage && (
              <Button
                className="mt-3"
                variant="outline"
                onClick={() => days.fetchNextPage()}
              >
                Load more sessions
              </Button>
            )}
          </CardContent>
        </Card>
      </details>
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Decision log</CardTitle>
          <CardDescription>
            Saved entry decisions, rejected entries and trade monitoring. Open a
            record for its values; Export logs includes the full run in Excel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {legacyJournal && (
            <p className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-warning">
              This historical attempt predates detailed checkpoints. Existing
              records were preserved without fabricating a journal.
            </p>
          )}
          {journal.isLoading && <p role="status">Loading decision log…</p>}
          {journal.error && (
            <p role="alert" className="text-sm text-destructive">
              Could not load the decision log.{" "}
              <button onClick={() => journal.refetch()} className="underline">
                Retry
              </button>
            </p>
          )}
          <div className="max-h-[560px] overflow-auto space-y-2">
            {journalItems.map((entry) => (
              <details
                key={entry.id}
                className="rounded-lg border border-border bg-surface/50 p-3"
              >
                <summary className="grid cursor-pointer gap-2 text-xs sm:grid-cols-[72px_150px_100px_1fr]">
                  <span className="font-mono text-muted-foreground">
                    #{entry.sequence}
                  </span>
                  <span className="font-semibold text-foreground">
                    {label(entry.event_type)}
                  </span>
                  <span className="font-semibold text-brand">
                    {entry.position_state ?? "—"}
                  </span>
                  <span className="text-muted-foreground">
                    {formatPlatformDateTime(entry.timestamp)}
                  </span>
                </summary>
                <pre className="mt-3 overflow-auto rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                  {JSON.stringify(entry.payload, null, 2)}
                </pre>
              </details>
            ))}
            {!journalItems.length &&
              !legacyJournal &&
              !journal.isLoading &&
              !journal.error && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No journal events recorded yet.
                </p>
              )}
          </div>
          {journal.hasNextPage && (
            <Button
              className="mt-3"
              variant="outline"
              onClick={() => journal.fetchNextPage()}
            >
              Load more journal events
            </Button>
          )}
        </CardContent>
      </Card>

      {diagnostics.data && (
        <details className="rounded-xl border border-border p-4">
          <summary className="cursor-pointer text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
            Performance breakdown
          </summary>
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Controlled diagnostics</CardTitle>
              <CardDescription>
                Stored-price movement and cost drag with sample sizes for each
                category.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <p className="rounded-lg border border-border p-3 text-sm">
                  Adverse movement:{" "}
                  <strong>
                    {formatCurrency(
                      diagnostics.data.adverse_movement_amount,
                      diagnostics.data.unit,
                    )}
                  </strong>
                </p>
                <p className="rounded-lg border border-border p-3 text-sm">
                  Cost drag:{" "}
                  <strong>
                    {formatCurrency(
                      diagnostics.data.cost_drag_amount,
                      diagnostics.data.unit,
                    )}
                  </strong>
                </p>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {Object.entries(diagnostics.data.groups).map(
                  ([group, values]) => (
                    <div
                      key={group}
                      className="rounded-lg border border-border p-3"
                    >
                      <h4 className="m-0 text-sm font-semibold capitalize text-foreground">
                        {label(group)}
                        {group === "entry_time" ? " (IST)" : ""}
                      </h4>
                      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {values.map((value) => (
                          <p
                            key={value.category}
                            className="m-0 flex justify-between gap-3"
                          >
                            <span>{value.category}</span>
                            <span className="font-mono">
                              n={value.sample_count} · trades=
                              {value.trade_count} · net=
                              {formatCurrency(
                                value.net_outcome,
                                diagnostics.data.unit,
                              )}
                            </span>
                          </p>
                        ))}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </CardContent>
          </Card>
        </details>
      )}
    </div>
  );
}
