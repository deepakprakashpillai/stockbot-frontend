import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AppShell } from "./AppShell";
import { ThemeProvider } from "./theme";

describe("AppShell", () => {
  it("renders the primary product navigation", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ThemeProvider>
          <MemoryRouter>
            <AppShell />
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>,
    );

    const primaryNavigation = screen.getByRole("navigation", {
      name: "Primary navigation",
    });
    expect(primaryNavigation).toBeVisible();
    expect(
      within(primaryNavigation).getByRole("link", { name: "Library" }),
    ).toHaveAttribute("href", "/library");
    expect(
      screen.getByRole("link", { name: "Skip to main content" }),
    ).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeVisible();
  });

  it("opens an accessible navigation drawer on smaller screens", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ThemeProvider>
          <MemoryRouter>
            <AppShell />
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));

    const drawer = screen.getByRole("dialog");
    expect(
      within(drawer).getByRole("link", { name: "Run History" }),
    ).toHaveAttribute("href", "/backtests/history");
    expect(
      within(drawer).getByRole("button", { name: "Close navigation" }),
    ).toBeVisible();
  });
});
