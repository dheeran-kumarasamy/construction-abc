const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function getHostedApiHost(currentHost: string) {
  return currentHost
    .replace("-frontend-", "-backend-")
    .replace("-frontend.", "-backend.");
}

export function getApiBaseUrl() {
  // Priority 1: Use explicit VITE_API_URL if provided
  if (configuredApiUrl) {
    return configuredApiUrl.replace(/\/$/, "");
  }

  // Priority 2: Auto-detect for local development
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol || "http:";
    const hostname = window.location.hostname || "localhost";

    if (isLocalHost(hostname)) {
      return `${protocol}//${hostname}:4000`;
    }

    // Priority 3: Try hostname replacement for Vercel previews
    if (protocol === "https:") {
      return `https://${getHostedApiHost(hostname)}`;
    }
  }

  return "http://localhost:4000";
}

export function apiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}
