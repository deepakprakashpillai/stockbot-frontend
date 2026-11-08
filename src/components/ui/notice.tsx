import type { ComponentProps, ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

type NoticeVariant = "info" | "success" | "warning" | "error";

const noticeIcon = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  error: AlertCircle,
};

const noticeClass = {
  info: "border-brand/30 bg-brand/10",
  success: "border-success/30 bg-success/10",
  warning: "border-warning/35 bg-warning/10",
  error: "border-destructive/30 bg-destructive/10",
};

type NoticeProps = {
  children: ReactNode;
  variant?: NoticeVariant;
  className?: string;
} & Omit<ComponentProps<"div">, "children" | "className">;

export function Notice({
  children,
  variant = "info",
  className,
  ...props
}: NoticeProps) {
  const Icon = noticeIcon[variant];
  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border px-4 py-3 text-sm leading-6 text-foreground",
        noticeClass[variant],
        className,
      )}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
