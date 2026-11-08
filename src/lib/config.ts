type Environment = Record<string, string | boolean | undefined>;

export type BrowserRuntimeConfig = {
  apiBaseUrl?: string;
  websocketUrl?: string;
};

export type RuntimeConfig = {
  apiBaseUrl: string;
  websocketUrl: string;
};

function parseUrl(value: string, name: string, protocols: string[]): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL.`);
  }
  if (!protocols.includes(parsed.protocol)) {
    throw new Error(`${name} must use ${protocols.join(" or ")}.`);
  }
  return parsed.toString().replace(/\/$/, "");
}

export function getRuntimeConfig(
  env: Environment = import.meta.env,
  browserConfig: BrowserRuntimeConfig | undefined = typeof window ===
  "undefined"
    ? undefined
    : window.__STOCKBOT_CONFIG__,
): RuntimeConfig {
  const production = env.PROD === true || env.MODE === "production";
  const apiValue = browserConfig?.apiBaseUrl ?? env.VITE_API_BASE_URL;
  const websocketValue = browserConfig?.websocketUrl ?? env.VITE_WEBSOCKET_URL;
  if (production && (!apiValue || !websocketValue)) {
    throw new Error(
      "Production requires explicit API and WebSocket runtime configuration.",
    );
  }
  const apiBaseUrl = parseUrl(
    String(apiValue ?? "http://localhost:8000"),
    "API base URL",
    production ? ["https:"] : ["http:", "https:"],
  );
  const websocketUrl = parseUrl(
    String(websocketValue ?? "ws://localhost:8000/api/v1/ws"),
    "WebSocket URL",
    production ? ["wss:"] : ["ws:", "wss:"],
  );
  if (
    production &&
    new URL(apiBaseUrl).hostname !== new URL(websocketUrl).hostname
  ) {
    throw new Error(
      "Production API and WebSocket URLs must use the same hostname for the secure session boundary.",
    );
  }
  return {
    apiBaseUrl,
    websocketUrl,
  };
}
