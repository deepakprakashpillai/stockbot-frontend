import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listJournalEvents, type DemoTrade } from "../../api/backtests";
import type { components } from "../../api/generated/schema";

type ReasonSummaryResponse = components["schemas"]["ReasonSummaryResponse"];
type DemoTradeResponse = DemoTrade;
import { Slideover } from "../../components/Slideover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { formatPlatformDateTime } from "../../lib/dateTime";
import { formatNumber, formatCurrency } from "../../lib/formatters";

function ReasonSummary({
  summary,
  fallback,
}: {
  summary?: ReasonSummaryResponse | null;
  fallback: string;
}) {
  if (!summary)
    return <span className="text-muted-foreground">{fallback}</span>;
  return (
    <div className="space-y-0.5">
      <span className="font-medium text-foreground capitalize">
        {summary.user_facing_label}
      </span>
      {summary.supporting_points && summary.supporting_points.length > 0 && (
        <span className="block text-[11px] text-muted-foreground truncate max-w-[200px]">
          {summary.supporting_points.join(", ")}
        </span>
      )}
    </div>
  );
}

function TradeDetailDrawer({
  trade,
  runId,
  isOpen,
  onClose,
}: {
  trade: DemoTradeResponse | null;
  runId: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const journal = useQuery({
    queryKey: ["trade-journal", runId, trade?.sequence],
    queryFn: async () => {
      let cursor: string | undefined;
      const items = [];
      do {
        const page = await listJournalEvents(runId, cursor, 500);
        items.push(...page.items);
        cursor = page.next_cursor ?? undefined;
      } while (cursor !== undefined);
      return items.filter((item) => item.trade_sequence === trade?.sequence);
    },
    enabled: Boolean(trade),
  });

  if (!trade) return null;

  const durationStr =
    (new Date(trade.exit_timestamp).getTime() -
      new Date(trade.entry_timestamp).getTime()) /
    1000;
  const formattedDuration = `${Math.floor(durationStr / 60)}m ${Math.floor(
    durationStr % 60,
  )}s`;

  return (
    <Slideover
      isOpen={isOpen}
      onClose={onClose}
      title={`Trade #${trade.sequence} Details`}
    >
      <div className="space-y-6 pb-6">
        <div className="grid grid-cols-2 gap-4 border border-border p-4 bg-surface/30 rounded-lg">
          <div>
            <span className="text-xs text-muted-foreground block">
              Net Outcome
            </span>
            <span
              className={`font-mono text-lg font-bold ${
                Number(trade.net_demo_units) > 0
                  ? "text-success"
                  : Number(trade.net_demo_units) < 0
                    ? "text-destructive"
                    : "text-muted-foreground"
              }`}
            >
              {formatCurrency(trade.net_demo_units, trade.unit)}
            </span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">
              Duration
            </span>
            <span className="font-mono text-sm">{formattedDuration}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 bg-surface/40 p-3 rounded-lg border border-border text-xs">
          <div>
            <span className="text-muted-foreground block mb-0.5">
              Entry Ref
            </span>
            <span className="font-mono font-medium text-foreground">
              {trade.entry_reference}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block mb-0.5">Exit Ref</span>
            <span className="font-mono font-medium text-foreground">
              {trade.exit_reference}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block mb-0.5">
              Entry Time
            </span>
            <span className="font-mono text-muted-foreground">
              {formatPlatformDateTime(trade.entry_timestamp)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block mb-0.5">
              Exit Time
            </span>
            <span className="font-mono text-muted-foreground">
              {formatPlatformDateTime(trade.exit_timestamp)}
            </span>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-2 text-foreground">
            Why Entered
          </h4>
          <div className="p-3 border border-border bg-surface rounded-lg">
            {trade.entry_reason_summary ? (
              <>
                <p className="font-medium capitalize">
                  {trade.entry_reason_summary.user_facing_label}
                </p>
                {trade.entry_reason_summary.supporting_points?.map((pt, i) => (
                  <p key={i} className="text-sm text-muted-foreground mt-1">
                    • {pt}
                  </p>
                ))}
              </>
            ) : (
              <p className="text-muted-foreground">Unknown entry reason</p>
            )}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-2 text-foreground">
            Why Exited
          </h4>
          <div className="p-3 border border-border bg-surface rounded-lg">
            <p className="font-medium capitalize">
              {trade.exit_reason_label ||
                trade.exit_reason.replace(/_/g, " ").toLowerCase()}
            </p>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-2 text-foreground">
            Execution assumptions
          </h4>
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-surface/50 p-3 text-xs">
            <span>Quantity</span>
            <strong className="text-right font-mono">{trade.quantity}</strong>
            <span>Estimated costs</span>
            <strong className="text-right font-mono">
              {formatCurrency(trade.costs_demo_units, trade.unit)}
            </strong>
            {Object.entries(trade.assumptions ?? {}).map(([key, value]) => (
              <div
                key={key}
                className="col-span-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-2 border-t border-border/60 pt-2"
              >
                <span className="text-muted-foreground capitalize">
                  {key.replaceAll("_", " ")}
                </span>
                <span className="break-words text-right font-mono text-foreground">
                  {typeof value === "object"
                    ? JSON.stringify(value)
                    : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-2 text-foreground">Legs</h4>
          <div className="space-y-2">
            {trade.legs.map((leg) => (
              <div
                key={leg.id}
                className="p-3 border border-border bg-surface/50 rounded-lg text-sm"
              >
                <div className="flex justify-between font-medium mb-1 text-foreground">
                  <span>{leg.name}</span>
                  <span
                    className={
                      Number(leg.demo_units) > 0
                        ? "text-success"
                        : Number(leg.demo_units) < 0
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }
                  >
                    {formatCurrency(leg.demo_units, leg.unit || trade.unit)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground font-mono">
                  <span>Entry: {formatNumber(leg.entry_reference)}</span>
                  <span>Exit: {formatNumber(leg.exit_reference)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-2 text-foreground">
            Chronological checks
          </h4>
          <div className="space-y-2">
            {(journal.data ?? []).map((entry) => (
              <details
                key={entry.id}
                className="rounded-lg border border-border bg-surface/50 p-3 text-xs"
              >
                <summary className="cursor-pointer font-medium text-foreground">
                  #{entry.sequence} · {entry.event_type.replaceAll("_", " ")} ·{" "}
                  {entry.position_state ?? "—"}
                </summary>
                <p className="font-mono text-muted-foreground">
                  {entry.timestamp}
                </p>
                <pre className="overflow-auto rounded bg-muted/40 p-2 text-[11px] text-muted-foreground">
                  {JSON.stringify(entry.payload, null, 2)}
                </pre>
              </details>
            ))}
            {journal.isLoading && (
              <p className="text-xs text-muted-foreground">
                Loading persisted checks…
              </p>
            )}
            {!journal.isLoading && !journal.data?.length && (
              <p className="text-xs text-muted-foreground">
                Detailed checkpoints are unavailable for this trade.
              </p>
            )}
          </div>
        </div>
      </div>
    </Slideover>
  );
}

export function TradeOutcomeList({
  runId,
  trades,
  selectedTradeId,
  onSelectTrade,
}: {
  runId: string;
  trades: DemoTradeResponse[];
  selectedTradeId?: string;
  onSelectTrade?: (trade: DemoTradeResponse) => void;
}) {
  const [drawerTrade, setDrawerTrade] = useState<DemoTradeResponse | null>(
    null,
  );

  useEffect(() => {
    if (!selectedTradeId) {
      setDrawerTrade(null);
      return;
    }
    const matching = trades.find((item) => item.id === selectedTradeId);
    if (matching) {
      setDrawerTrade(matching);
    }
  }, [selectedTradeId, trades]);

  if (!trades.length) {
    return (
      <div className="p-8 text-center border border-dashed border-border rounded-xl bg-surface/20">
        <p className="text-sm font-medium text-muted-foreground">
          No executed trades found in this run.
        </p>
      </div>
    );
  }

  const handleRowClick = (trade: DemoTradeResponse) => {
    setDrawerTrade(trade);
    if (onSelectTrade) {
      onSelectTrade(trade);
    }
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-surface/40 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-surface-subtle/50 hover:bg-surface-subtle/50">
              <TableHead className="w-[80px]">#</TableHead>
              <TableHead>Why Entered</TableHead>
              <TableHead>Why Exited</TableHead>
              <TableHead className="text-right">Duration</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead className="text-right">Costs / Tax</TableHead>
              <TableHead className="text-right">Net P&amp;L</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trades.map((trade) => {
              const isSelected = selectedTradeId === trade.id;
              const durationStr =
                (new Date(trade.exit_timestamp).getTime() -
                  new Date(trade.entry_timestamp).getTime()) /
                1000;
              const formattedDuration = `${Math.floor(
                durationStr / 60,
              )}m ${Math.floor(durationStr % 60)}s`;

              return (
                <TableRow
                  key={trade.id}
                  onClick={() => handleRowClick(trade)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleRowClick(trade);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  className={`cursor-pointer transition-colors ${
                    isSelected ? "bg-brand/10" : "hover:bg-surface-subtle"
                  }`}
                  data-selected={isSelected ? "true" : undefined}
                >
                  <TableCell className="font-mono text-xs font-semibold text-muted-foreground">
                    #{trade.sequence}
                  </TableCell>
                  <TableCell>
                    <ReasonSummary
                      summary={trade.entry_reason_summary}
                      fallback="Unknown"
                    />
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-foreground capitalize">
                      {trade.exit_reason_label ||
                        trade.exit_reason.replace(/_/g, " ").toLowerCase()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">
                    {formattedDuration}
                  </TableCell>
                  <TableCell className="text-right font-mono text-success">
                    {formatCurrency(trade.gross_demo_units, trade.unit)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-destructive">
                    {formatCurrency(trade.costs_demo_units, trade.unit)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono font-bold ${
                      Number(trade.net_demo_units) > 0
                        ? "text-success"
                        : Number(trade.net_demo_units) < 0
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }`}
                  >
                    {formatCurrency(trade.net_demo_units, trade.unit)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <TradeDetailDrawer
        runId={runId}
        trade={drawerTrade}
        isOpen={drawerTrade !== null}
        onClose={() => setDrawerTrade(null)}
      />
    </>
  );
}
