import { LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export function LoadingState({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-32 items-center justify-center gap-3 rounded-xl border border-border bg-card px-5 py-8 text-sm text-muted-foreground",
        className,
      )}
      role="status"
    >
      <LoaderCircle
        className="size-4 motion-safe:animate-spin"
        aria-hidden="true"
      />
      {label}
    </div>
  );
}
