export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "-";
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(dt);
}

export function formatTime(value: string | Date | null | undefined) {
  if (!value) return "-";
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(dt);
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "-";
  const datePart = formatDate(value);
  const timePart = formatTime(value);
  if (datePart === "-" || timePart === "-") return "-";
  return `${datePart} ${timePart}`;
}
