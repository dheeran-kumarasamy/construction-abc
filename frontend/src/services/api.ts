const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function getHostedApiHost(currentHost: string) {
  if (currentHost.includes("-frontend.")) {
    return currentHost.replace("-frontend.", "-backend.");
  }

  return currentHost;
}

export function getApiBaseUrl() {
  if (configuredApiUrl) {
    const normalizedConfigured = configuredApiUrl.replace(/\/$/, "");

    if (typeof window !== "undefined") {
      try {
        const parsed = new URL(normalizedConfigured);
        const currentHost = window.location.hostname || "localhost";
        const isHttpsPage = window.location.protocol === "https:";

        if (isLocalHost(parsed.hostname) && !isLocalHost(currentHost)) {
          if (isHttpsPage) {
            return `https://${getHostedApiHost(currentHost)}`;
          }

          const port = parsed.port || "4000";
          return `http://${currentHost}:${port}`;
        }

        if (isHttpsPage && parsed.protocol === "http:") {
          return `https://${parsed.host}`;
        }
      } catch {
      }
    }

    return normalizedConfigured;
  }

  if (typeof window !== "undefined") {
    const protocol = window.location.protocol || "http:";
    const hostname = window.location.hostname || "localhost";

    if (protocol === "https:" && !isLocalHost(hostname)) {
      return `https://${getHostedApiHost(hostname)}`;
    }

    return `${protocol}//${hostname}:4000`;
  }

  return "http://localhost:4000";
}

export function apiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}
