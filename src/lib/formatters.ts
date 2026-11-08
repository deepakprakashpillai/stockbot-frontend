export function formatNumber(value: unknown): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

export function formatCurrency(value: unknown, currency = "DEMO"): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  const sign = numeric > 0 ? "+" : numeric < 0 ? "-" : "";
  const absValue = Math.abs(numeric);

  if (currency === "INR" || currency === "₹") {
    const formatted = new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(absValue);
    return `${sign}₹${formatted}`;
  }

  const normalizedCurrency = currency === "DEMO_UNITS" ? "DEMO" : currency;
  return `${sign}${absValue.toFixed(2)} ${normalizedCurrency}`;
}
