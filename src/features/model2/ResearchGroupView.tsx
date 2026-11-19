import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  getAssessment,
  getCycle,
  getOptionPosition,
  getResearchGroup,
  getScenarioComparison,
  listCycles,
  listRiskEntries,
  listPortfolioJournal,
  cancelResearchGroup,
  type OptionPosition,
} from "../../api/model2";
import { listExecutionAttempts } from "../../api/backtests";
import { useRealtimeChannel } from "../../realtime/useRealtimeChannel";
import { ExportLogsButton } from "../backtests/ExportLogsButton";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";

const terminal = new Set(["COMPLETED", "CANCELLED", "FAILED"]);
import { policyLabels, humanize, money } from "./presentation";
export function ResearchError({ error }: { error: unknown }) {
  return error ? (
    <p
      role="alert"
      className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive"
    >
      {error instanceof Error ? error.message : "Could not load evidence."}
    </p>
  ) : null;
}
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
function Evidence({
  value,
  title = "Saved evidence",
}: {
  value: unknown;
  title?: string;
}) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer font-medium">{title}</summary>
      <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-muted/30 p-3 text-xs">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}
function ChildUpdates({
  runId,
  refresh,
}: {
  runId: string;
  refresh: () => void;
}) {
  const { connectionState } = useRealtimeChannel(`backtest:${runId}`, refresh);
  return <span className="sr-only">Update connection: {connectionState}</span>;
}

export function ResearchGroupView({ groupId }: { groupId: string }) {
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    },
    [],
  );
  const refresh = () => {
    if (!refreshTimer.current)
      refreshTimer.current = setTimeout(() => {
        refreshTimer.current = null;
        void client.invalidateQueries({ queryKey: ["model2"] });
      }, 500);
  };
  const group = useQuery({
    queryKey: ["model2", "group", groupId],
    queryFn: () => getResearchGroup(groupId),
    refetchInterval: (query) =>
      terminal.has(query.state.data?.status ?? "") ? false : 2000,
  });
  const cancel = useMutation({
    mutationFn: () => cancelResearchGroup(groupId),
    onSuccess: () => client.invalidateQueries({ queryKey: ["model2"] }),
  });
  const member =
    group.data?.members.find(
      (item) => item.policy === params.get("scenario"),
    ) ?? group.data?.members.find((item) => item.primary);
  if (!group.data)
    return (
      <>
        <p role="status">Loading research group…</p>
        <ResearchError error={group.error} />
        <Button variant="outline" onClick={() => group.refetch()}>
          Retry
        </Button>
      </>
    );
  const finished = terminal.has(group.data.status);
  return (
    <div className="flex min-w-0 flex-col gap-5">
      {group.data.members.map((item) => (
        <ChildUpdates key={item.run.id} runId={item.run.id} refresh={refresh} />
      ))}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-brand">
            Model 2 · historical research
          </p>
          <h1 className="mt-1 text-2xl font-bold">Overnight iron condor</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            One request, three independent replays. Opening-price estimates,
            assumed margin and placeholder charges.
          </p>
          <p role="status" className="mt-2 text-sm font-medium">
            {humanize(group.data.status)} · updates recover from saved records
            automatically
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/studio">New research</Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => client.invalidateQueries({ queryKey: ["model2"] })}
          >
            Refresh evidence
          </Button>
          {!finished && (
            <Button
              variant="outline"
              disabled={cancel.isPending || group.data.cancellation_requested}
              onClick={() => cancel.mutate()}
            >
              Cancel all scenarios
            </Button>
          )}
        </div>
      </header>
      <ResearchError error={group.error || cancel.error} />
      <nav
        aria-label="Research scenarios"
        className="grid gap-3 lg:grid-cols-3"
      >
        {group.data.members.map((item) => (
          <button
            key={item.policy}
            aria-pressed={item.policy === member?.policy}
            onClick={() =>
              setParams((current) => {
                current.set("scenario", item.policy);
                current.delete("cycle");
                return current;
              })
            }
            className={`rounded-xl border p-4 text-left ${item.policy === member?.policy ? "border-brand bg-brand/5" : "border-border bg-surface"}`}
          >
            <strong className="block text-sm">
              {policyLabels[item.policy]}
            </strong>
            <span className="mt-2 block text-xs text-muted-foreground">
              {humanize(item.run.status)} · {item.run.progress}% ·{" "}
              {humanize(item.scope)}
            </span>
            <span className="mt-1 block text-xs">
              {item.priced_cycle_count ?? "—"} priced ·{" "}
              {item.excluded_cycle_count ?? "—"} excluded ·{" "}
              {humanize(item.reliability_status)}
            </span>
          </button>
        ))}
      </nav>
      {member && (
        <ScenarioEvidence
          key={member.run.id}
          runId={member.run.id}
          active={!finished}
        />
      )}
      <ScenarioComparison groupId={groupId} active={!finished} />
      {finished && member && (
        <Panel title="Complete research exports">
          <p className="mb-3 text-sm text-muted-foreground">
            Each file includes all three scenarios separately, with source
            identities, four-leg rows, excluded cycles and risk assumptions.
          </p>
          <div className="flex flex-wrap gap-4">
            <ExportLogsButton runId={member.run.id} format="XLSX" />
            <ExportLogsButton runId={member.run.id} format="ZIP" />
          </div>
        </Panel>
      )}
      <Evidence
        value={group.data.snapshot}
        title="Research inputs and source identities"
      />
    </div>
  );
}

function ScenarioEvidence({
  runId,
  active,
}: {
  runId: string;
  active: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const cycleOpener = useRef<HTMLButtonElement | null>(null);
  const interval = active ? 2000 : false;
  const cycles = useInfiniteQuery({
    queryKey: ["model2", "cycles", runId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => listCycles(runId, pageParam),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    refetchInterval: interval,
  });
  const risks = useInfiniteQuery({
    queryKey: ["model2", "risk", runId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => listRiskEntries(runId, pageParam),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    refetchInterval: interval,
  });
  const assessment = useQuery({
    queryKey: ["model2", "assessment", runId],
    queryFn: () => getAssessment(runId),
    refetchInterval: interval,
  });
  const stats = assessment.data?.priced_statistics;
  const reliability = assessment.data?.reliability;
  const rows = cycles.data?.pages.flatMap((page) => page.items) ?? [];
  const riskRows = risks.data?.pages.flatMap((page) => page.items) ?? [];
  const selected = params.get("cycle");
  const select = (id: string | null) =>
    setParams((current) => {
      if (id) current.set("cycle", id);
      else current.delete("cycle");
      return current;
    });
  return (
    <>
      <ResearchError error={cycles.error || risks.error || assessment.error} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Priced net result", money(stats?.net_pnl_inr)],
          ["Priced cycles", stats?.trade_count ?? "—"],
          ["Data reliability", humanize(reliability?.status)],
          ["Historical assessment", humanize(assessment.data?.overall_status)],
        ].map(([title, value]) => (
          <div
            key={String(title)}
            className="min-w-0 rounded-xl border border-border bg-surface p-4"
          >
            <p className="text-xs text-muted-foreground">{String(title)}</p>
            <p className="mt-2 break-words text-lg font-semibold">
              {String(value)}
            </p>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Priced cycles only. Unknown outcomes and assumed losses are excluded
        from financial returns. Scope: {humanize(assessment.data?.scope)}. No
        result represents trading approval.
      </p>
      <Panel title="Scheduled cycles and overnight positions">
        <p className="mb-3 text-sm text-muted-foreground">
          Includes skipped, pending, priced and excluded cycles. Open a cycle
          for its four legs, trigger, actual fill and source evidence.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="p-2">Expiry</th>
                <th className="p-2">Entry day</th>
                <th className="p-2">State</th>
                <th className="p-2">Reason</th>
                <th className="p-2">Inspect</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="p-2 whitespace-nowrap">{row.expiry}</td>
                  <td className="p-2 whitespace-nowrap">{row.entry_date}</td>
                  <td className="p-2">{humanize(row.state)}</td>
                  <td className="p-2">{humanize(row.reason)}</td>
                  <td className="p-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(event) => {
                        cycleOpener.current = event.currentTarget;
                        select(row.id);
                      }}
                    >
                      Open cycle {row.expiry}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <p className="py-4 text-sm">
            {active
              ? "Waiting for the worker’s first saved cycle."
              : "No cycles were recorded."}
          </p>
        )}
        {cycles.hasNextPage && (
          <Button
            variant="outline"
            disabled={cycles.isFetchingNextPage}
            onClick={() => cycles.fetchNextPage()}
          >
            More cycles
          </Button>
        )}
      </Panel>
      <Panel title="Separate risk-control ledger">
        <p className="mb-3 text-sm text-muted-foreground">
          Assumed maximum loss or zero affects entry limits and losing streaks
          only. It is never added to priced P&L.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="p-2">Booked</th>
                <th className="p-2">Source</th>
                <th className="p-2">Risk amount</th>
                <th className="p-2">Priced result</th>
                <th className="p-2">Counters</th>
              </tr>
            </thead>
            <tbody>
              {riskRows.map((row) => (
                <tr key={row.cycle_id} className="border-t border-border">
                  <td className="p-2 whitespace-nowrap">{row.booking_date}</td>
                  <td className="p-2">{humanize(row.source)}</td>
                  <td className="p-2 whitespace-nowrap">
                    {money(row.risk_amount)}
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    {money(row.priced_performance_amount)}
                  </td>
                  <td className="p-2">
                    <Evidence value={row.counters} title="Limits and streak" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!riskRows.length && <p className="text-sm">No booked outcomes yet.</p>}
        {risks.hasNextPage && (
          <Button variant="outline" onClick={() => risks.fetchNextPage()}>
            More risk entries
          </Button>
        )}
      </Panel>
      <Panel title="Historical checks">
        <p className="mb-3 text-sm text-muted-foreground">
          Development and known-exposed dates are reported separately.
          Random-day control remains pending; paper validation belongs to a
          later phase.
        </p>
        <ul className="space-y-2">
          {assessment.data?.criteria.map((criterion, index) => (
            <li
              key={index}
              className="rounded-lg border border-border p-3 text-sm"
            >
              <strong>
                {humanize(criterion.key)} · {humanize(criterion.status)}
              </strong>
              <p className="mt-1 text-muted-foreground">
                {String(criterion.threshold ?? "")}
              </p>
              <Evidence value={criterion.value} title="Criterion evidence" />
            </li>
          ))}
        </ul>
        <Evidence
          value={{
            statistics: stats,
            reliability,
            limitations: assessment.data?.limitations,
          }}
          title="Monthly, yearly and population details"
        />
      </Panel>
      <AttemptEvidence runId={runId} active={active} />
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) select(null);
        }}
      >
        <DialogContent
          className="min-w-0 max-h-[90dvh] overflow-x-hidden overflow-y-auto bg-surface text-foreground sm:max-w-4xl [&>*]:min-w-0"
          onCloseAutoFocus={(event) => {
            if (cycleOpener.current?.isConnected) {
              event.preventDefault();
              cycleOpener.current.focus();
            }
          }}
        >
          <DialogTitle>Cycle evidence</DialogTitle>
          <DialogDescription>
            Saved position and decision history. Times retain their recorded
            time-zone offset.
          </DialogDescription>
          {selected && (
            <CycleDetail runId={runId} cycleId={selected} active={active} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function CycleDetail({
  runId,
  cycleId,
  active,
}: {
  runId: string;
  cycleId: string;
  active: boolean;
}) {
  const cycle = useQuery({
    queryKey: ["model2", "cycle", runId, cycleId],
    queryFn: () => getCycle(runId, cycleId),
    refetchInterval: active ? 2000 : false,
  });
  const hasPosition = Boolean(
    cycle.data?.payload.entry ||
    (cycle.data?.payload.result as Record<string, unknown> | undefined)?.entry,
  );
  const position = useQuery({
    queryKey: ["model2", "position", runId, cycleId],
    queryFn: () => getOptionPosition(runId, cycleId),
    enabled: hasPosition,
    refetchInterval: active ? 2000 : false,
  });
  return (
    <>
      <ResearchError error={cycle.error || position.error} />
      <p className="text-sm">
        {cycle.data?.expiry} · {humanize(cycle.data?.state)} ·{" "}
        {humanize(cycle.data?.reason)}
      </p>
      {position.data && <PositionDetails position={position.data} />}
      <Evidence
        value={cycle.data?.payload}
        title="Complete trigger, retry and source evidence"
      />
    </>
  );
}

export function PositionDetails({ position: p }: { position: OptionPosition }) {
  return (
    <div className="min-w-0 space-y-4">
      <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-2 [&>div]:min-w-0">
        <div>
          <dt className="text-muted-foreground">Entry / actual exit</dt>
          <dd className="break-all">
            {p.entry_at} / {p.exit_at ?? "No priced exit"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Priced net / charges</dt>
          <dd>
            {money(p.net_pnl_inr)} / {money(p.charges_inr)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">
            Maximum loss / margin (ASSUMED)
          </dt>
          <dd>
            {money(p.maximum_loss_inr)} / {money(p.assumed_margin_inr)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Exit reason / flags</dt>
          <dd>
            {humanize(p.reason)} · {p.flags.map(humanize).join(", ") || "None"}
          </dd>
        </div>
      </dl>
      <div
        role="region"
        aria-label="Four-leg prices"
        tabIndex={0}
        className="min-w-0 max-w-full overflow-x-auto rounded-sm focus-visible:outline-2 focus-visible:outline-brand"
      >
        <table className="w-full min-w-[56rem] text-left text-sm">
          <caption className="mb-2 text-left font-semibold">
            All four option legs · prices in option points
          </caption>
          <thead>
            <tr>
              {[
                "Role",
                "Contract",
                "Strike",
                "Quantity / lot",
                "Tick",
                "Entry reference",
                "Entry fill",
                "Exit fill",
                "Gross INR",
              ].map((label) => (
                <th className="p-2" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {p.legs.map((leg) => (
              <tr key={leg.role} className="border-t border-border">
                <td className="p-2">
                  {humanize(leg.role)} · {leg.side}
                </td>
                <td className="min-w-40 p-2 break-all">
                  {leg.symbol}
                  <br />
                  {leg.contract_id}
                  <br />
                  {leg.expiry} · {leg.option_type}
                </td>
                <td className="p-2">{leg.strike}</td>
                <td className="p-2">
                  {leg.quantity} / {leg.lot_size}
                </td>
                <td className="p-2">{leg.tick_size}</td>
                <td className="p-2">{leg.entry_reference_price}</td>
                <td className="p-2">{leg.entry_fill_price}</td>
                <td className="p-2">{leg.exit_fill_price ?? "Unknown"}</td>
                <td className="p-2 whitespace-nowrap">
                  {money(leg.gross_pnl_inr)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Evidence value={p.original_trigger} title="Original trigger" />
    </div>
  );
}

function ScenarioComparison({
  groupId,
  active,
}: {
  groupId: string;
  active: boolean;
}) {
  const comparison = useInfiniteQuery({
    queryKey: ["model2", "comparison", groupId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => getScenarioComparison(groupId, pageParam),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    refetchInterval: active ? 2000 : false,
  });
  return (
    <Panel title="Compare the same scheduled cycle">
      <p className="mb-3 text-sm text-muted-foreground">
        Each scenario has its own limits and trade population. A halted or
        skipped cycle has no invented zero return. These results are never
        summed.
      </p>
      <ResearchError error={comparison.error} />
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="p-2">Expiry</th>
              {Object.values(policyLabels).map((label) => (
                <th key={label} className="p-2">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparison.data?.pages
              .flatMap((page) => page.items)
              .map((row) => (
                <tr key={row.expiry} className="border-t border-border">
                  <td className="p-2 whitespace-nowrap">{row.expiry}</td>
                  {row.outcomes.map((outcome) => (
                    <td className="p-2" key={outcome.policy}>
                      {humanize(outcome.state)}
                      <br />
                      <span className="text-muted-foreground">
                        {humanize(outcome.reason)}
                      </span>
                      <br />
                      Priced: {money(outcome.priced_net_pnl_inr)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {comparison.hasNextPage && (
        <Button variant="outline" onClick={() => comparison.fetchNextPage()}>
          More comparisons
        </Button>
      )}
    </Panel>
  );
}

function AttemptEvidence({
  runId,
  active,
}: {
  runId: string;
  active: boolean;
}) {
  const attempts = useQuery({
    queryKey: ["model2", "attempts", runId],
    queryFn: () => listExecutionAttempts(runId),
    refetchInterval: active ? 3000 : false,
  });
  const [attempt, setAttempt] = useState<string | undefined>();
  const [show, setShow] = useState(false);
  const journal = useInfiniteQuery({
    queryKey: ["model2", "journal", runId, attempt],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      listPortfolioJournal(runId, pageParam, 50, attempt),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled: show,
    refetchInterval: active && show ? 3000 : false,
  });
  return (
    <Panel title="Execution and recovery history">
      <p className="mb-3 text-sm text-muted-foreground">
        A recovered worker replays from the original snapshot. Earlier attempt
        evidence remains available; it is excluded from the active result.
      </p>
      <label className="text-sm">
        Execution attempt{" "}
        <select
          className="ml-2 max-w-full rounded border border-border bg-surface p-2"
          value={attempt ?? ""}
          onChange={(event) => {
            setAttempt(event.target.value || undefined);
            setShow(true);
          }}
        >
          <option value="">Active attempt</option>
          {attempts.data?.items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.attempt_number} · {item.status}
            </option>
          ))}
        </select>
      </label>
      <Button
        variant="outline"
        className="ml-2"
        onClick={() => setShow((value) => !value)}
      >
        {show ? "Hide timeline" : "Show timeline"}
      </Button>
      <ResearchError error={attempts.error || journal.error} />
      {show && (
        <>
          <ol className="mt-3 space-y-2">
            {journal.data?.pages
              .flatMap((page) => page.items)
              .map((event) => (
                <li
                  key={event.id}
                  className="rounded border border-border p-3 text-sm"
                >
                  {event.timestamp} · {humanize(event.event_type)}
                  <Evidence value={event.payload} />
                </li>
              ))}
          </ol>
          {journal.hasNextPage && (
            <Button variant="outline" onClick={() => journal.fetchNextPage()}>
              More timeline events
            </Button>
          )}
        </>
      )}
    </Panel>
  );
}
