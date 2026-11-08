import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DemoEquityChart } from "./DemoEquityChart";

const items = [
  {
    id: "equity-1",
    sequence: 1,
    timestamp: "2026-01-02T09:20:00+05:30",
    equity_demo_units: "2.50",
    drawdown_demo_units: "0.00",
    synthetic: true as const,
    unit: "DEMO_UNITS" as const,
    financial_pnl_available: false as const,
  },
  {
    id: "equity-2",
    sequence: 2,
    timestamp: "2026-01-02T09:25:00+05:30",
    equity_demo_units: "1.25",
    drawdown_demo_units: "-1.25",
    synthetic: true as const,
    unit: "DEMO_UNITS" as const,
    financial_pnl_available: false as const,
  },
];

const zoomItems = Array.from({ length: 5 }, (_, index) => ({
  ...items[0],
  id: `zoom-${index + 1}`,
  sequence: index + 1,
  timestamp: `2026-01-02T09:${String(20 + index * 5).padStart(2, "0")}:00+05:30`,
  equity_demo_units: String(2.5 + index),
  drawdown_demo_units: String(-index / 2),
}));

describe("DemoEquityChart", () => {
  it("offers chart/table inspection, series controls, and an accessible expanded dialog", () => {
    render(<DemoEquityChart items={items} />);

    expect(
      screen.getByRole("heading", { name: "Equity & Drawdown Curve" }),
    ).toBeVisible();
    expect(screen.getByText(/Synthetic evaluation values/)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Table" }));
    expect(
      screen.getByRole("region", {
        name: "Visible synthetic equity and drawdown data",
      }),
    ).toBeVisible();
    expect(screen.getByText("2.50 DEMO_UNITS")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Equity (DEMO)" }));
    fireEvent.click(screen.getByRole("button", { name: "Drawdown (DEMO)" }));
    fireEvent.click(screen.getByRole("button", { name: "Chart" }));
    expect(screen.getByText("All chart series are hidden.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Show all series" }));

    const expand = screen.getByRole("button", { name: "Expand chart" });
    expand.focus();
    fireEvent.click(expand);
    expect(
      screen.getByRole("dialog", { name: "Equity & Drawdown Curve" }),
    ).toBeVisible();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(
      screen.queryByRole("dialog", { name: "Equity & Drawdown Curve" }),
    ).not.toBeInTheDocument();
    expect(expand).toHaveFocus();
  });

  it("supports keyboard viewport shortcuts from the chart frame", () => {
    render(<DemoEquityChart items={items} />);
    const frame = screen
      .getByRole("heading", { name: "Equity & Drawdown Curve" })
      .closest("section");
    expect(frame).not.toBeNull();
    frame?.focus();
    fireEvent.keyDown(frame!, { key: "+" });
    expect(screen.getByText(/Visible range/)).toBeInTheDocument();
    fireEvent.keyDown(frame!, { key: "Enter" });
    expect(
      screen.getByRole("dialog", { name: "Equity & Drawdown Curve" }),
    ).toBeVisible();
  });

  it("zooms the rendered data window from the + control without a range slider", () => {
    render(<DemoEquityChart items={zoomItems} />);

    const visibleReadout = screen.getByText("Visible").parentElement;
    expect(visibleReadout).toHaveTextContent("5 of 5 points");

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(visibleReadout).toHaveTextContent("3 of 5 points");
  });
});
