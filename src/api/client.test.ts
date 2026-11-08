import { afterEach, describe, expect, it, vi } from "vitest";

import { authenticatedFetch, SESSION_STATE_EVENT } from "./client";

describe("authenticatedFetch", () => {
  afterEach(() => vi.restoreAllMocks());

  it("includes the HttpOnly cookie on every request", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    await authenticatedFetch("https://api.example.test/api/v1/datasets", {
      method: "POST",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/v1/datasets",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("announces session expiry after a protected 401", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 401 }),
    );
    const listener = vi.fn();
    window.addEventListener(SESSION_STATE_EVENT, listener);

    await authenticatedFetch("http://localhost:8000/api/v1/backtests");

    expect(listener).toHaveBeenCalledOnce();
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toBe("expired");
    window.removeEventListener(SESSION_STATE_EVENT, listener);
  });

  it("does not treat a rejected access key as an expired session", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 401 }),
    );
    const listener = vi.fn();
    window.addEventListener(SESSION_STATE_EVENT, listener);

    await authenticatedFetch("http://localhost:8000/api/v1/auth/session", {
      method: "POST",
    });

    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener(SESSION_STATE_EVENT, listener);
  });
});
