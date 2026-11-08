import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function DataTableContainer({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-xl border border-border bg-card",
        className,
      )}
      {...props}
    />
  );
}
