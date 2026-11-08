import { describe, expect, it } from "vitest";

import {
  adjacentTimestamp,
  clampChartDomain,
  fullChartDomain,
  nearestTimestamp,
  panChartDomain,
  zoomChartDomain,
} from "./chartDomain";

describe("chartDomain", () => {
  const bounds = { start: 0, end: 1000 };

  it("normalizes a full domain and gives a single point a usable range", () => {
    expect(fullChartDomain([])).toBeNull();
    expect(fullChartDomain([700, 100, 300])).toEqual({ start: 100, end: 700 });
    expect(fullChartDomain([500])).toEqual({ start: 500, end: 501 });
  });

  it("clamps, zooms, and pans without leaving the full domain", () => {
    expect(clampChartDomain({ start: -100, end: 400 }, bounds)).toEqual({
      start: 0,
      end: 500,
    });
    expect(zoomChartDomain({ start: 200, end: 800 }, bounds, 2)).toEqual({
      start: 350,
      end: 650,
    });
    expect(panChartDomain({ start: 200, end: 600 }, bounds, 2)).toEqual({
      start: 600,
      end: 1000,
    });
  });

  it("finds deterministic nearest and adjacent timestamps", () => {
    const timestamps = [100, 200, 300];
    expect(nearestTimestamp(timestamps, 250)).toBe(200);
    expect(adjacentTimestamp(timestamps, 200, 1)).toBe(300);
    expect(adjacentTimestamp(timestamps, 100, -1)).toBe(100);
    expect(adjacentTimestamp(timestamps, 300, 1)).toBe(300);
  });
});
