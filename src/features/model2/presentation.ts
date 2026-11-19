export const policyLabels: Record<string, string> = {
  MAX_LOSS_RISK: "Primary · maximum-loss assumption",
  ZERO_RISK: "Zero-risk assumption",
  HALT_AT_FIRST_EXCLUSION: "Halt at first exclusion",
};
export const humanize = (value: unknown) =>
  String(value ?? "Pending").replaceAll("_", " ");
export const money = (value: unknown) =>
  value == null
    ? "Unknown"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }).format(Number(value));
