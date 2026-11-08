import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

import type { SignalEvaluation } from "../../api/backtests";
import { ApiError } from "../../api/system";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AppSelect } from "@/components/ui/app-select";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Props = {
  signals: SignalEvaluation[];
  loaded: boolean;
  error: unknown;
  hasNextPage: boolean;
  loadingNextPage: boolean;
  decision?: "ACCEPTED" | "REJECTED";
  rejectionReason?: string;
  selectedSignalId?: string;
  onDecisionChange: (value: "ACCEPTED" | "REJECTED" | undefined) => void;
  onRejectionReasonChange: (value: string | undefined) => void;
  onSelectSignal: (id: string) => void;
  onSelectTrade: (id: string) => void;
  onLoadMore: () => void;
};

function ErrorText({ error }: { error: unknown }) {
  if (!(error instanceof ApiError)) return null;
  return (
    <div className="bg-destructive/10 text-destructive border border-destructive/20 p-4 rounded-lg flex items-start gap-3 my-4">
      <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
      <div>
        <p className="font-semibold text-sm">{error.message}</p>
        {error.requestId && (
          <p className="text-xs mt-1 opacity-80">
            Request ID: {error.requestId}
          </p>
        )}
      </div>
    </div>
  );
}

export function RunSignalExplorer({
  signals,
  loaded,
  error,
  hasNextPage,
  loadingNextPage,
  decision,
  rejectionReason,
  selectedSignalId,
  onDecisionChange,
  onRejectionReasonChange,
  onSelectSignal,
  onSelectTrade,
  onLoadMore,
}: Props) {
  return (
    <details
      id="section-signals"
      open={
        selectedSignalId !== undefined || Boolean(decision || rejectionReason)
      }
      className="mt-6 rounded-xl border border-border p-4"
    >
      <summary className="cursor-pointer text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
        Search signal decisions · filter and inspect individual checks
      </summary>
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Signal Decision Explorer</CardTitle>
          <CardDescription>
            Accepted and rejected signal decisions from the persisted algorithm
            version
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ErrorText error={error} />
          <div className="mb-4 flex flex-wrap gap-3 rounded-lg border border-border bg-surface/30 p-3">
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Decision
              <AppSelect
                ariaLabel="Signal decision filter"
                value={decision ?? "__all__"}
                placeholder="All decisions"
                onValueChange={(value) =>
                  onDecisionChange(
                    value === "__all__"
                      ? undefined
                      : (value as "ACCEPTED" | "REJECTED"),
                  )
                }
                className="h-9"
                options={[
                  { value: "__all__", label: "All decisions" },
                  { value: "ACCEPTED", label: "Accepted" },
                  { value: "REJECTED", label: "Rejected" },
                ]}
              />
            </label>
            <label className="grid min-w-48 gap-1 text-xs font-medium text-muted-foreground">
              Rejection reason
              <input
                aria-label="Signal rejection reason filter"
                value={rejectionReason ?? ""}
                onChange={(event) =>
                  onRejectionReasonChange(event.target.value || undefined)
                }
                placeholder="Exact reason"
                className="h-9 rounded-md border border-border bg-surface px-2 text-foreground"
              />
            </label>
          </div>
          {loaded && signals.length === 0 && (
            <div className="p-8 text-center text-muted-foreground border border-dashed border-border rounded-lg">
              No signal decisions recorded.
            </div>
          )}
          {signals.length > 0 && (
            <div className="rounded-md border border-border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Decision</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Rejection / Window</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {signals.map((signal) => {
                    const isAccepted = signal.decision === "ACCEPTED";
                    return (
                      <TableRow
                        key={signal.id}
                        id={`signal-${signal.id}`}
                        data-selected={
                          selectedSignalId !== undefined &&
                          selectedSignalId === signal.id
                            ? "true"
                            : undefined
                        }
                        onClick={() => onSelectSignal(signal.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onSelectSignal(signal.id);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        className="cursor-pointer hover:bg-surface/60 transition-colors data-[selected=true]:bg-brand/10"
                      >
                        <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {signal.timestamp}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "font-semibold",
                              isAccepted
                                ? "bg-success/10 text-success border-success/30"
                                : "bg-destructive/10 text-destructive border-destructive/30",
                            )}
                          >
                            {isAccepted ? (
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                            ) : (
                              <XCircle className="w-3 h-3 mr-1" />
                            )}
                            {signal.decision}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono">
                          {signal.score ?? "—"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-sm",
                            !isAccepted && "text-destructive font-medium",
                          )}
                        >
                          {signal.rejection_reason ?? signal.window ?? "—"}
                          {(signal.entry_trade_ids?.length ?? 0) > 0 && (
                            <button
                              type="button"
                              className="ml-2 text-xs text-brand underline underline-offset-2"
                              onClick={(event) => {
                                event.stopPropagation();
                                onSelectTrade(signal.entry_trade_ids![0]);
                              }}
                            >
                              Open linked trade
                            </button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {hasNextPage && (
            <div className="flex justify-center mt-6">
              <Button
                variant="outline"
                onClick={() => onLoadMore()}
                disabled={loadingNextPage}
              >
                {loadingNextPage ? "Loading…" : "Load more signals"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </details>
  );
}
