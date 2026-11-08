import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAuthSession, getAuthSession } from "../api/auth";
import { SESSION_STATE_EVENT } from "../api/client";
import { AuthGate } from "./AuthGate";
import { ThemeProvider } from "./theme";

vi.mock("../api/auth", () => ({
  createAuthSession: vi.fn(),
  getAuthSession: vi.fn(),
}));

function renderGate() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ThemeProvider>
        <AuthGate>
          <p>Private platform</p>
        </AuthGate>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe("AuthGate", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the platform when an HttpOnly-cookie session is active", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ authenticated: true });
    renderGate();
    expect(await screen.findByText("Private platform")).toBeVisible();
  });

  it("submits the key from form memory and clears it after unlocking", async () => {
    const storageWrite = vi.spyOn(Storage.prototype, "setItem");
    vi.mocked(getAuthSession)
      .mockResolvedValueOnce({ authenticated: false })
      .mockResolvedValue({ authenticated: true });
    vi.mocked(createAuthSession).mockResolvedValue({ authenticated: true });
    renderGate();
    const input = await screen.findByLabelText("Local access key");
    fireEvent.change(input, { target: { value: "temporary-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock platform" }));
    await waitFor(() => expect(createAuthSession).toHaveBeenCalled());
    expect(vi.mocked(createAuthSession).mock.calls[0][0]).toBe(
      "temporary-secret",
    );
    expect(await screen.findByText("Private platform")).toBeVisible();
    expect(storageWrite).not.toHaveBeenCalled();
  });

  it("re-locks and explains recovery when a protected call reports expiry", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ authenticated: true });
    renderGate();
    expect(await screen.findByText("Private platform")).toBeVisible();

    act(() => {
      window.dispatchEvent(
        new CustomEvent(SESSION_STATE_EVENT, { detail: "expired" }),
      );
    });

    expect(await screen.findByText(/secure session expired/i)).toBeVisible();
    expect(screen.getByLabelText("Local access key")).toHaveFocus();
  });
});
