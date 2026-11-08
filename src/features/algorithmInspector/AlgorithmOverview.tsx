import type { Algorithm } from "../../api/algorithms";

export function AlgorithmOverview({ algorithm }: { algorithm: Algorithm }) {
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-foreground">
        <strong>
          {algorithm.documentation.lifecycle_status.replaceAll("_", " ")}
        </strong>
        <p className="m-0 mt-1">{algorithm.documentation.safety_notice}</p>
      </section>
      <p className="m-0 text-sm leading-6 text-muted">
        {algorithm.documentation.purpose}
      </p>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted">Code / schema</dt>
          <dd className="m-0 font-mono text-sm text-foreground">
            {algorithm.code_version} · v{algorithm.schema_version}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Modes</dt>
          <dd className="m-0 text-sm text-foreground">
            {algorithm.supported_modes.join(", ")}
          </dd>
        </div>
      </dl>
      <section>
        <h3 className="m-0 text-sm font-semibold text-foreground">
          Research limitations
        </h3>
        <ul className="mt-2 space-y-1 text-sm text-muted">
          {algorithm.documentation.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="m-0 text-sm font-semibold text-foreground">
            Versioned rule register
          </h3>
          <span className="font-mono text-xs text-muted">
            {algorithm.documentation.rule_register_version}
          </span>
        </div>
        <div className="mt-2 space-y-2">
          {(algorithm.documentation.rules ?? []).map((rule) => (
            <article
              key={rule.key}
              className="rounded-lg border border-border bg-surface-subtle/40 p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="m-0 text-sm font-semibold text-foreground">
                  {rule.statement}
                </p>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide ${
                    rule.status === "PENDING_PARTNER"
                      ? "border-warning/40 bg-warning/10 text-warning"
                      : "border-success/30 bg-success/10 text-success"
                  }`}
                >
                  {rule.status.replaceAll("_", " ")}
                </span>
              </div>
              <p className="mb-0 mt-1 text-xs text-muted">
                {rule.source_document} · {rule.source_reference}
              </p>
            </article>
          ))}
          {!(algorithm.documentation.rules ?? []).length && (
            <p className="text-sm text-muted">
              This legacy code version predates the rule register.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
