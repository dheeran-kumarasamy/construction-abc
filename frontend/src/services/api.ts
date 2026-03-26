const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

function normalizeConfiguredApiUrl(value: string) {
  const trimmed = value.trim().replace(/\/$/, "");

  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;

  // Treat bare hostnames as HTTPS endpoints in production.
  return `https://${trimmed}`;
}

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function getApiBaseUrl() {
  // Priority 1: Use explicit VITE_API_URL if provided
  if (configuredApiUrl) {
    return normalizeConfiguredApiUrl(configuredApiUrl);
  }

  // Priority 2: Auto-detect for local development
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol || "http:";
    const hostname = window.location.hostname || "localhost";

    if (isLocalHost(hostname)) {
      return `${protocol}//${hostname}:4000`;
    }

    // Hosted deployments should provide VITE_API_URL (Railway backend URL).
    // Fallback to same-origin to avoid DNS failures from stale hardcoded hosts.
    return `${protocol}//${hostname}`;
  }

  return "http://localhost:4000";
}

export function apiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}
