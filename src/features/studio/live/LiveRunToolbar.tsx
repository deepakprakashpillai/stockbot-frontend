import { Crosshair, Pause, Play } from "lucide-react";

export function LiveRunToolbar({
  following,
  onFollowingChange,
}: {
  following: boolean;
  onFollowingChange: (following: boolean) => void;
}) {
  return (
    <div
      className="flex items-center gap-2"
      aria-label="Live inspector controls"
    >
      <button
        type="button"
        onClick={() => onFollowingChange(!following)}
        className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-foreground hover:bg-surface-subtle"
        aria-pressed={following}
      >
        {following ? <Pause size={14} /> : <Play size={14} />}
        {following ? "Pause follow" : "Follow latest"}
      </button>
      <span className="inline-flex items-center gap-1 text-xs text-muted">
        <Crosshair size={13} />
        {following
          ? "Viewport follows durable checkpoints"
          : "Viewing is paused; the run continues"}
      </span>
    </div>
  );
}
