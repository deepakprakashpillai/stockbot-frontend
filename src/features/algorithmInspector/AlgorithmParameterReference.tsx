import type { Algorithm } from "../../api/algorithms";

export function AlgorithmParameterReference({
  algorithm,
}: {
  algorithm: Algorithm;
}) {
  return (
    <div className="space-y-5">
      <section>
        <h3 className="m-0 text-sm font-semibold text-foreground">
          Required data inputs
        </h3>
        <div className="mt-2 space-y-2">
          {algorithm.documentation.inputs.map((input) => (
            <div
              key={input.key}
              className="rounded-lg border border-border p-3 text-sm"
            >
              <strong className="text-foreground">{input.label}</strong>
              <p className="m-0 mt-1 text-muted">{input.description}</p>
              <span className="text-xs text-brand">
                Capability: {input.capability}
              </span>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3 className="m-0 text-sm font-semibold text-foreground">
          Fixed backend rules
        </h3>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2">
          {Object.entries(algorithm.fixed_rules).map(([key, value]) => (
            <div key={key} className="rounded border border-border p-3">
              <dt className="text-xs text-muted">{key.replaceAll("_", " ")}</dt>
              <dd className="m-0 mt-1 font-mono text-sm text-foreground">
                {String(value)}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
