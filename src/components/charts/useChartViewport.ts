import { useCallback, useEffect, useMemo, useState } from "react";

import {
  adjacentTimestamp,
  clampChartDomain,
  fullChartDomain,
  nearestTimestamp,
  panChartDomain,
  zoomChartDomain,
} from "./chartDomain";
import type { ChartDomain } from "./chartTypes";

export function useChartViewport(
  timestamps: number[],
  initialSeries: string[],
) {
  const orderedTimestamps = useMemo(
    () =>
      [...timestamps]
        .filter(Number.isFinite)
        .sort((left, right) => left - right),
    [timestamps],
  );
  const fullDomain = useMemo(
    () => fullChartDomain(orderedTimestamps),
    [orderedTimestamps],
  );
  const minimumSpan = useMemo(() => {
    if (!fullDomain || orderedTimestamps.length < 2) return 1;
    return Math.max(
      1,
      (fullDomain.end - fullDomain.start) /
        Math.min(20, orderedTimestamps.length - 1),
    );
  }, [fullDomain, orderedTimestamps.length]);
  const [visibleDomain, setVisibleDomain] = useState<ChartDomain | null>(
    fullDomain,
  );
  const [activeTimestamp, setActiveTimestamp] = useState<number | null>(null);
  const [visibleSeries, setVisibleSeries] = useState<string[]>(initialSeries);
  const initialSeriesKey = initialSeries.join("|");
  const stableInitialSeries = useMemo(
    () => initialSeries,
    // Series identities, rather than the caller's array allocation, define a preference change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialSeriesKey],
  );

  useEffect(() => {
    setVisibleDomain((current) => {
      if (!fullDomain) return null;
      return current
        ? clampChartDomain(current, fullDomain, minimumSpan)
        : fullDomain;
    });
    setActiveTimestamp((current) =>
      current === null ? null : nearestTimestamp(orderedTimestamps, current),
    );
  }, [fullDomain, minimumSpan, orderedTimestamps]);

  useEffect(() => {
    setVisibleSeries((current) => {
      const allowed = new Set(stableInitialSeries);
      const retained = current.filter((item) => allowed.has(item));
      return retained.length ? retained : stableInitialSeries;
    });
  }, [initialSeriesKey, stableInitialSeries]);

  const reset = useCallback(() => {
    setVisibleDomain(fullDomain);
    setActiveTimestamp(null);
  }, [fullDomain]);

  const zoom = useCallback(
    (factor: number, anchor = 0.5) => {
      if (!visibleDomain || !fullDomain) return;
      setVisibleDomain(
        zoomChartDomain(visibleDomain, fullDomain, factor, anchor, minimumSpan),
      );
    },
    [fullDomain, minimumSpan, visibleDomain],
  );

  const pan = useCallback(
    (fraction: number) => {
      if (!visibleDomain || !fullDomain) return;
      setVisibleDomain(
        panChartDomain(visibleDomain, fullDomain, fraction, minimumSpan),
      );
    },
    [fullDomain, minimumSpan, visibleDomain],
  );

  const selectDomain = useCallback(
    (domain: ChartDomain) => {
      if (!fullDomain) return;
      setVisibleDomain(clampChartDomain(domain, fullDomain, minimumSpan));
    },
    [fullDomain, minimumSpan],
  );

  const moveActive = useCallback(
    (direction: -1 | 1) => {
      setActiveTimestamp((current) =>
        adjacentTimestamp(orderedTimestamps, current, direction),
      );
    },
    [orderedTimestamps],
  );

  const toggleSeries = useCallback((id: string) => {
    setVisibleSeries((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }, []);

  return {
    fullDomain,
    visibleDomain,
    canZoom: Boolean(
      fullDomain && fullDomain.end - fullDomain.start > minimumSpan,
    ),
    activeTimestamp,
    visibleSeries,
    reset,
    zoom,
    pan,
    selectDomain,
    setActiveTimestamp,
    moveActive,
    toggleSeries,
    showAllSeries: () => setVisibleSeries(initialSeries),
  };
}
