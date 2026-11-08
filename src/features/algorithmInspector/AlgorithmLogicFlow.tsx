import type { Algorithm } from "../../api/algorithms";

export function AlgorithmLogicFlow({ algorithm }: { algorithm: Algorithm }) {
  const steps = [...algorithm.documentation.logic_steps].sort(
    (a, b) => a.order - b.order,
  );
  return (
    <ol className="space-y-3" aria-label="Documented algorithm logic flow">
      {steps.map((step) => (
        <li
          key={step.id}
          className="rounded-xl border border-border bg-surface-subtle p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-brand">
                {step.order}. {step.kind}
              </p>
              <h3 className="m-0 mt-1 text-sm font-semibold text-foreground">
                {step.label}
              </h3>
            </div>
            {step.experimental && (
              <span className="rounded-full bg-warning/10 px-2 py-1 text-[10px] font-bold text-warning">
                Experimental
              </span>
            )}
          </div>
          <p className="m-0 mt-2 text-sm text-muted">{step.description}</p>
          <p className="m-0 mt-2 text-xs text-muted">
            Depends on: {step.depends_on.join(", ") || "none"}
          </p>
        </li>
      ))}
    </ol>
  );
}
