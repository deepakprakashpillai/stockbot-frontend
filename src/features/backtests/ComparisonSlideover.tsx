import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, ShieldAlert } from "lucide-react";

import { compareBacktests, preflightComparison } from "../../api/backtests";
import { ApiError } from "../../api/system";
import { Slideover } from "../../components/Slideover";
import { ComparisonResults } from "./ComparisonsPage";

function ErrorText({ error }: { error: unknown }) {
  if (!(error instanceof ApiError)) return null;
  return (
    <p className="m-0 text-sm font-medium text-danger" role="alert">
      {error.message}
      {error.requestId ? ` Request ID: ${error.requestId}` : ""}
    </p>
  );
}

export function ComparisonSlideover({
  isOpen,
  onClose,
  runIds,
}: {
  isOpen: boolean;
  onClose: () => void;
  runIds: string[];
}) {
  const selectionKey = runIds.join(",");
  const preflight = useQuery({
    queryKey: ["comparison-preflight", selectionKey],
    queryFn: () => preflightComparison(runIds),
    enabled: isOpen && runIds.length >= 2,
  });
  const comparison = useMutation({
    mutationFn: () => compareBacktests(runIds),
  });

  return (
    <Slideover isOpen={isOpen} onClose={onClose} title="Compare selected runs">
      <div className="space-y-5">
        <div className="rounded-xl border border-brand/25 bg-brand/5 p-4">
          <p className="m-0 text-[11px] font-bold uppercase tracking-[0.14em] text-brand">
            Same-mode comparison
          </p>
          <p className="mb-0 mt-2 text-sm leading-6 text-muted">
            The server checks that selected runs have compatible mode, data, and
            date ranges. Saved results keep their original units and
            limitations.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface-subtle p-4">
          <p className="m-0 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
            Selected runs
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {runIds.map((id) => (
              <span
                key={id}
                className="rounded-md border border-border bg-surface px-2 py-1 font-mono text-xs text-foreground"
              >
                {id.slice(0, 8)}
              </span>
            ))}
          </div>
        </div>
        {runIds.length < 2 && (
          <p className="m-0 text-sm text-muted">
            Select at least two completed runs from Run History first.
          </p>
        )}
        {preflight.isFetching && (
          <p className="m-0 text-sm text-muted" role="status">
            Checking comparison safety…
          </p>
        )}
        <ErrorText error={preflight.error ?? comparison.error} />
        {preflight.data && (
          <section
            className={`rounded-xl border p-4 ${preflight.data.allowed ? "border-success/35 bg-success/10" : "border-danger/35 bg-danger/10"}`}
            role="status"
          >
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              {preflight.data.allowed ? (
                <CheckCircle2 size={17} className="text-success" />
              ) : (
                <ShieldAlert size={17} className="text-danger" />
              )}
              {preflight.data.allowed
                ? "Safe to compare"
                : "Comparison blocked"}
            </div>
            {[...preflight.data.issues, ...preflight.data.warnings].map(
              (issue) => (
                <p key={issue.code} className="mb-0 mt-2 text-xs text-muted">
                  <code className="text-foreground">{issue.code}</code> ·{" "}
                  {issue.message}
                </p>
              ),
            )}
            {preflight.data.allowed && (
              <button
                type="button"
                onClick={() => comparison.mutate()}
                disabled={comparison.isPending}
                className="mt-4 w-full rounded-lg bg-brand px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50"
              >
                {comparison.isPending
                  ? "Building comparison…"
                  : "Compare selected runs"}
              </button>
            )}
          </section>
        )}
        {comparison.data && <ComparisonResults comparison={comparison.data} />}
      </div>
    </Slideover>
  );
}
