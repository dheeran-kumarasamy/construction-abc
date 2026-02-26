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
  if (configuredApiUrl) {
    return configuredApiUrl.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    const protocol = window.location.protocol || "http:";
    const hostname = window.location.hostname || "localhost";

    if (protocol === "https:" && !isLocalHost(hostname)) {
      return `https://${getHostedApiHost(hostname)}`;
    }
  }

  if (typeof window !== "undefined") {
    const protocol = window.location.protocol || "http:";
    const hostname = window.location.hostname || "localhost";

    return `${protocol}//${hostname}:4000`;
  }

  return "http://localhost:4000";
}

export function apiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}
