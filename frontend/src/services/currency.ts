type FormatINROptions = {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  withSymbol?: boolean;
};

export function formatINR(value: number | string | null | undefined, options: FormatINROptions = {}) {
  const numericValue = Number(value ?? 0);
  const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
  const minimumFractionDigits = options.minimumFractionDigits ?? 2;
  const maximumFractionDigits = options.maximumFractionDigits ?? 2;
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(safeValue);

  if (options.withSymbol === false) {
    return formatted;
  }

  return `₹${formatted}`;
}
