import { describe, expect, it } from "vitest";

import { formatPlatformDateTime } from "./dateTime";

describe("formatPlatformDateTime", () => {
  it("labels the platform timezone explicitly", () => {
    const formatted = formatPlatformDateTime("2026-01-02T03:30:00Z");
    expect(formatted).toContain("IST");
    expect(formatted).toContain("9:00:00");
  });

  it("preserves an invalid backend value for diagnosis", () => {
    expect(formatPlatformDateTime("not-a-date")).toBe("not-a-date");
  });
});
