import { useQuery } from "@tanstack/react-query";
import { checkCompatibility } from "../../api/algorithms";

export function AlgorithmCompatibility({
  algorithmKey,
  datasetVersionId,
  onDataset,
}: {
  algorithmKey: string;
  datasetVersionId?: string;
  onDataset: (id: string) => void;
}) {
  const compatibility = useQuery({
    queryKey: [
      "algorithm-inspector-compatibility",
      algorithmKey,
      datasetVersionId,
    ],
    queryFn: () => checkCompatibility(algorithmKey, datasetVersionId!),
    enabled: Boolean(datasetVersionId),
  });
  return (
    <div className="space-y-4">
      <label className="block text-sm text-muted">
        Dataset version ID
        <input
          value={datasetVersionId ?? ""}
          onChange={(event) => onDataset(event.target.value)}
          placeholder="Paste an immutable dataset version UUID"
          className="mt-1 w-full rounded border border-border bg-surface p-2 text-foreground"
        />
      </label>
      {compatibility.data && (
        <section
          className={`rounded-xl p-4 text-sm ${compatibility.data.compatible ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}
        >
          <strong>
            {compatibility.data.compatible ? "Compatible" : "Not compatible"}
          </strong>
          <p className="m-0 mt-1">
            Required: {compatibility.data.required_capabilities.join(", ")}
          </p>
          <p className="m-0">
            Available:{" "}
            {compatibility.data.available_capabilities.join(", ") || "none"}
          </p>
          <p className="m-0">
            Missing:{" "}
            {compatibility.data.missing_capabilities.join(", ") || "none"}
          </p>
        </section>
      )}
    </div>
  );
}
