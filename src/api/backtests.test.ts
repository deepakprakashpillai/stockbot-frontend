import { afterEach, describe, expect, it, vi } from "vitest";

import { listBacktests } from "./backtests";

describe("listBacktests", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sends the selected run mode to the catalog API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ items: [], next_cursor: null, total_count: 0 }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    await listBacktests({ mode: "OPTION_SPREAD_SIMULATION" });

    const request = fetchMock.mock.calls[0][0];
    const url = new URL(
      request instanceof Request ? request.url : String(request),
    );
    expect(url.searchParams.get("mode")).toBe("OPTION_SPREAD_SIMULATION");
  });
});
