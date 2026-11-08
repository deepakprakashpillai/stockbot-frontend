import { describe, expect, it } from "vitest";

import { getRuntimeConfig } from "./config";

describe("getRuntimeConfig", () => {
  it("keeps the local UI, API, and session cookie on the localhost site", () => {
    expect(getRuntimeConfig({})).toEqual({
      apiBaseUrl: "http://localhost:8000",
      websocketUrl: "ws://localhost:8000/api/v1/ws",
    });
  });

  it("accepts configured API and WebSocket URLs", () => {
    expect(
      getRuntimeConfig({
        VITE_API_BASE_URL: "https://api.example.test/",
        VITE_WEBSOCKET_URL: "wss://api.example.test/ws",
      }),
    ).toEqual({
      apiBaseUrl: "https://api.example.test",
      websocketUrl: "wss://api.example.test/ws",
    });
  });

  it("rejects malformed public configuration", () => {
    expect(() => getRuntimeConfig({ VITE_API_BASE_URL: "not-a-url" })).toThrow(
      "API base URL",
    );
  });

  it("requires explicit secure same-host production endpoints", () => {
    expect(() => getRuntimeConfig({ PROD: true })).toThrow(
      "Production requires explicit",
    );
    expect(() =>
      getRuntimeConfig({
        PROD: true,
        VITE_API_BASE_URL: "http://api.example.test",
        VITE_WEBSOCKET_URL: "wss://api.example.test/ws",
      }),
    ).toThrow("https:");
    expect(() =>
      getRuntimeConfig({
        PROD: true,
        VITE_API_BASE_URL: "https://api.example.test",
        VITE_WEBSOCKET_URL: "wss://socket.example.test/ws",
      }),
    ).toThrow("same hostname");
  });

  it("allows startup-injected production configuration", () => {
    expect(
      getRuntimeConfig(
        { PROD: true },
        {
          apiBaseUrl: "https://stockbot.example.test/api/",
          websocketUrl: "wss://stockbot.example.test/api/v1/ws",
        },
      ),
    ).toEqual({
      apiBaseUrl: "https://stockbot.example.test/api",
      websocketUrl: "wss://stockbot.example.test/api/v1/ws",
    });
  });
});
