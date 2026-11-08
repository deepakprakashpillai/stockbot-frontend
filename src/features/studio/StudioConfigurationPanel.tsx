import type { ReactNode } from "react";
import { Gauge, SlidersHorizontal } from "lucide-react";

import { AppSelect } from "../../components/ui/app-select";

type Choice = { value: string; label: string };

type Props = {
  datasetId: string;
  datasetOptions: Choice[];
  onDatasetChange: (value: string) => void;
  startDate: string;
  endDate: string;
  coverageStart?: string | null;
  coverageEnd?: string | null;
  sessionCount?: number | null;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  algorithmKey: string;
  algorithmOptions: Choice[];
  onAlgorithmChange: (value: string) => void;
  algorithmVersionId: string;
  versionOptions: Choice[];
  onVersionChange: (value: string) => void;
  algorithmDescription?: string | null;
  algorithmCodeVersion?: string | null;
  capital: string;
  onCapitalChange: (value: string) => void;
  showDatasetWarning: boolean;
  acknowledged: boolean;
  onAcknowledgedChange: (value: boolean) => void;
  reviewDisabled: boolean;
  reviewPending: boolean;
  onReview: () => void;
  errorContent: ReactNode;
};

export function StudioConfigurationPanel(props: Props) {
  return (
    <aside className="min-w-0 rounded-2xl border border-border bg-surface p-4 xl:sticky xl:top-4">
      <div className="mb-4 flex items-center gap-2">
        <SlidersHorizontal size={18} className="text-brand" />
        <h2 className="m-0 text-lg font-semibold text-foreground">
          Run Configuration
        </h2>
      </div>
      <div className="min-w-0 space-y-4">
        <fieldset className="min-w-0 rounded-xl border border-border bg-surface-subtle/50 p-3.5">
          <legend className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            01 · Dataset & Range
          </legend>
          <label className="mt-2 block min-w-0 text-sm font-medium text-muted">
            Validated dataset
            <AppSelect
              value={props.datasetId}
              ariaLabel="Validated dataset"
              placeholder="Select dataset…"
              onValueChange={props.onDatasetChange}
              className="mt-1"
              options={props.datasetOptions}
            />
          </label>
          <div className="mt-3 grid min-w-0 grid-cols-2 gap-2">
            <label className="min-w-0 text-sm font-medium text-muted">
              From
              <input
                type="date"
                value={props.startDate}
                min={props.coverageStart?.slice(0, 10)}
                max={props.coverageEnd?.slice(0, 10)}
                onChange={(event) =>
                  props.onStartDateChange(event.target.value)
                }
                className="mt-1 block w-full min-w-0 max-w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm text-foreground"
              />
            </label>
            <label className="min-w-0 text-sm font-medium text-muted">
              To
              <input
                type="date"
                value={props.endDate}
                min={props.coverageStart?.slice(0, 10)}
                max={props.coverageEnd?.slice(0, 10)}
                onChange={(event) => props.onEndDateChange(event.target.value)}
                className="mt-1 block w-full min-w-0 max-w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm text-foreground"
              />
            </label>
          </div>
          {props.coverageStart && (
            <p className="mb-0 mt-2 text-xs leading-5 text-muted-foreground">
              {props.sessionCount ?? 0} sessions · coverage{" "}
              {props.coverageStart.slice(0, 10)} →{" "}
              {props.coverageEnd?.slice(0, 10)}
            </p>
          )}
        </fieldset>

        <fieldset className="min-w-0 rounded-xl border border-border bg-surface-subtle/50 p-3.5">
          <legend className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            02 · Algorithm Version
          </legend>
          <label className="mt-2 block min-w-0 text-sm font-medium text-muted">
            Algorithm
            <AppSelect
              value={props.algorithmKey}
              ariaLabel="Algorithm"
              placeholder="Select algorithm…"
              onValueChange={props.onAlgorithmChange}
              className="mt-1"
              options={props.algorithmOptions}
            />
          </label>
          <label className="mt-3 block min-w-0 text-sm font-medium text-muted">
            Immutable version
            <AppSelect
              value={props.algorithmVersionId}
              ariaLabel="Immutable algorithm version"
              placeholder="Select version…"
              onValueChange={props.onVersionChange}
              className="mt-1"
              options={props.versionOptions}
            />
          </label>
          {props.algorithmDescription && (
            <p className="mb-0 mt-2 text-xs leading-5 text-muted-foreground">
              {props.algorithmDescription} · code {props.algorithmCodeVersion}
            </p>
          )}
        </fieldset>

        <fieldset className="min-w-0 rounded-xl border border-border bg-surface-subtle/50 p-3.5">
          <legend className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            03 · Run Context
          </legend>
          <label className="block min-w-0 text-sm font-medium text-muted">
            Starting context
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={props.capital}
              onChange={(event) => props.onCapitalChange(event.target.value)}
              className="mt-1 block w-full min-w-0 max-w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
            />
          </label>
          <p className="mb-0 mt-2 text-xs leading-5 text-muted-foreground">
            Stored for reproducibility only. Never real capital.
          </p>
          {props.showDatasetWarning && (
            <label className="mt-3 flex items-center gap-2 text-xs font-medium text-warning">
              <input
                type="checkbox"
                checked={props.acknowledged}
                onChange={(event) =>
                  props.onAcknowledgedChange(event.target.checked)
                }
                className="rounded"
              />{" "}
              I acknowledge this dataset’s warnings.
            </label>
          )}
        </fieldset>

        <button
          type="button"
          disabled={props.reviewDisabled}
          onClick={props.onReview}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-bold text-brand-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Gauge size={17} />
          {props.reviewPending ? "Checking readiness…" : "Review Preflight"}
        </button>
        {props.errorContent}
      </div>
    </aside>
  );
}
