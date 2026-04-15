export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "-";
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  const day = String(dt.getDate()).padStart(2, "0");
  const month = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ][dt.getMonth()];
  const year = String(dt.getFullYear());
  return `${day}-${month}-${year}`;
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
