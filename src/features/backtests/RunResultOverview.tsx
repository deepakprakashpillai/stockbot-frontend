import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Download } from "lucide-react";

import type {
  BacktestRun,
  ExportFormat,
  ExportKind,
} from "../../api/backtests";
import { ExportLogsButton } from "./ExportLogsButton";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Props = {
  run: BacktestRun;
  codeVersion: string;
  completed: boolean;
  exportPending: boolean;
  exportError: ReactNode;
  onExport: (kind: ExportKind, format: ExportFormat) => void;
};

export function RunResultOverview({
  run,
  codeVersion,
  completed,
  exportPending,
  exportError,
  onExport,
}: Props) {
  return (
    <>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Badge
              variant="outline"
              className="bg-brand/10 text-brand border-brand/20 uppercase tracking-widest text-[10px] font-bold"
            >
              Durable Result
            </Badge>
            <Badge
              variant="secondary"
              className={cn(
                "uppercase font-bold tracking-wider",
                run.status === "COMPLETED" &&
                  "bg-success/20 text-success border-success/30",
                run.status === "FAILED" &&
                  "bg-destructive/20 text-destructive border-destructive/30",
                run.status === "RUNNING" &&
                  "bg-brand/20 text-brand border-brand/30 animate-pulse",
              )}
            >
              {run.status}
            </Badge>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground m-0 flex items-center gap-3">
            Run{" "}
            <span className="font-mono text-muted-foreground">
              {run.id.slice(0, 8)}
            </span>
          </h1>
          <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <div>
              <dt className="sr-only">Dataset version</dt>
              <dd className="m-0 font-mono">
                Dataset v{run.dataset_version_id.slice(0, 8)}
              </dd>
            </div>
            <div>
              <dt className="sr-only">Parameter version</dt>
              <dd className="m-0 font-mono">
                Parameters v{run.algorithm_version_id.slice(0, 8)}
              </dd>
            </div>
            <div>
              <dt className="sr-only">Code version</dt>
              <dd className="m-0">Code {codeVersion}</dd>
            </div>
            <div>
              <dt className="sr-only">Selected range</dt>
              <dd className="m-0 font-mono">
                {run.start_date} → {run.end_date}
              </dd>
            </div>
            <div>
              <dt className="sr-only">Result safeguards</dt>
              <dd
                className={`m-0 font-semibold ${
                  run.mode === "OPTION_SPREAD_SIMULATION"
                    ? "text-success"
                    : "text-warning"
                }`}
              >
                {run.mode === "OPTION_SPREAD_SIMULATION"
                  ? "Indian Rupees (₹) · Financial Simulation"
                  : "DEMO_UNITS · synthetic"}
              </dd>
            </div>
          </dl>
        </div>

        {completed && (
          <div className="flex flex-wrap items-start gap-2">
            <ExportLogsButton key={run.id} runId={run.id} />
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Download className="h-4 w-4" /> Export Data
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Export results</DialogTitle>
                  <DialogDescription>
                    Exports embed this run ID, immutable version snapshots,
                    coverage evidence, result units, and financial-validity
                    safeguards.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  {exportError}
                  <ExportLogsButton
                    key={`${run.id}-zip`}
                    runId={run.id}
                    format="ZIP"
                  />
                  {(
                    [
                      "summary",
                      "analytics",
                      "trades",
                      "signals",
                    ] as ExportKind[]
                  ).map((kind) => (
                    <div
                      key={kind}
                      className="flex items-center justify-between p-3 border border-border rounded-lg bg-surface/50"
                    >
                      <span className="font-semibold capitalize text-sm">
                        {kind}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onExport(kind, "csv")}
                          disabled={exportPending}
                        >
                          CSV
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-brand hover:bg-brand/90"
                          onClick={() => onExport(kind, "json")}
                          disabled={exportPending}
                        >
                          JSON
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <div
        className={`rounded-xl border p-4 ${
          run.coverage_status === "PARTIAL"
            ? "border-warning/40 bg-warning/5"
            : "border-success/30 bg-success/5"
        }`}
      >
        <p className="m-0 text-sm font-semibold text-foreground">
          Data coverage · {run.coverage_status ?? "Legacy run"}
        </p>
        <p className="mb-0 mt-1 text-xs text-muted-foreground">
          {run.included_session_count ?? "—"} sessions included ·{" "}
          {run.excluded_session_count ?? "—"} excluded · coverage digest{" "}
          <span className="font-mono">
            {run.coverage_digest?.slice(0, 12) ?? "unavailable"}
          </span>
        </p>
      </div>

      {run.mode === "OPTION_SPREAD_SIMULATION" ? (
        <div className="bg-success/10 text-success border border-success/20 p-4 rounded-lg flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-sm">
              OPTION_SPREAD_SIMULATION · Estimated historical INR outcome
            </p>
            <p className="text-xs mt-1 opacity-90">
              This backtest evaluates Bull Call Spread contracts using completed
              historical option candles, intraday Futures VWAP, India VIX,
              configured adverse slippage, and the stored cost assumption.
              Executable bid/ask quotes are unavailable.
            </p>
            {run.estimate_limitations?.length ? (
              <ul className="mt-3 mb-0 list-disc space-y-1 pl-5 text-xs opacity-90">
                {run.estimate_limitations.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="bg-warning/10 text-warning border border-warning/20 p-4 rounded-lg flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-sm">
              PLATFORM_DEMO · Synthetic Fixture
            </p>
            <p className="text-xs mt-1 opacity-90">
              Every result on this page uses DEMO_UNITS, has no financial P&L,
              and does not represent strategy performance or executable option
              trades.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
