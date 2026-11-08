import { describe, expect, it } from "vitest";

import {
  readRunExplorerState,
  writeRunExplorerState,
} from "./runExplorerSearchParams";

describe("run explorer URL state", () => {
  it("round-trips a durable selection, range, filters, and live-follow state", () => {
    const parameters = writeRunExplorerState(
      new URLSearchParams("tab=trades"),
      {
        selection: { type: "trade", id: "trade-123" },
        start: "2026-01-02T09:15:00+05:30",
        end: "2026-01-02T15:30:00+05:30",
        signalDecision: "ACCEPTED",
        eventType: "BACKTEST_TRADE_CREATED",
        liveFollow: false,
      },
    );

    expect(readRunExplorerState(parameters)).toEqual({
      selection: { type: "trade", id: "trade-123" },
      start: "2026-01-02T09:15:00+05:30",
      end: "2026-01-02T15:30:00+05:30",
      tab: "trades",
      signalDecision: "ACCEPTED",
      signalRejectionReason: undefined,
      eventType: "BACKTEST_TRADE_CREATED",
      liveFollow: false,
    });
  });

  it("drops malformed or incomplete ranges and clears explicitly reset state", () => {
    const invalid = readRunExplorerState(
      new URLSearchParams(
        "range_start=nope&range_end=2026-01-02T15:30:00+05:30",
      ),
    );
    expect(invalid.start).toBeUndefined();
    expect(invalid.end).toBeUndefined();

    const reset = writeRunExplorerState(
      new URLSearchParams(
        "selection=signal&record=s1&range_start=2026-01-02T09%3A15%3A00%2B05%3A30&range_end=2026-01-02T15%3A30%3A00%2B05%3A30",
      ),
      { selection: { type: "none" }, start: "", end: "" },
    );
    expect(reset.toString()).toBe("");
  });
});
