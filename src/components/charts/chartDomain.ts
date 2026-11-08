import type { ChartDomain } from "./chartTypes";

const MINIMUM_DOMAIN_MS = 1;

export function fullChartDomain(timestamps: number[]): ChartDomain | null {
  const valid = timestamps
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  if (!valid.length) return null;
  const start = valid[0];
  const end = valid[valid.length - 1];
  return start === end
    ? { start, end: start + MINIMUM_DOMAIN_MS }
    : { start, end };
}

export function clampChartDomain(
  domain: ChartDomain,
  bounds: ChartDomain,
  minimumSpan = MINIMUM_DOMAIN_MS,
): ChartDomain {
  const maxSpan = bounds.end - bounds.start;
  const span = Math.min(
    Math.max(domain.end - domain.start, minimumSpan),
    maxSpan,
  );
  const unclampedStart = domain.start;
  const start = Math.min(
    Math.max(unclampedStart, bounds.start),
    bounds.end - span,
  );
  return { start, end: start + span };
}

export function zoomChartDomain(
  domain: ChartDomain,
  bounds: ChartDomain,
  factor: number,
  anchor = 0.5,
  minimumSpan = MINIMUM_DOMAIN_MS,
): ChartDomain {
  if (!Number.isFinite(factor) || factor <= 0) return domain;
  const currentSpan = domain.end - domain.start;
  const nextSpan = currentSpan / factor;
  const safeAnchor = Math.min(Math.max(anchor, 0), 1);
  const anchorValue = domain.start + currentSpan * safeAnchor;
  return clampChartDomain(
    {
      start: anchorValue - nextSpan * safeAnchor,
      end: anchorValue + nextSpan * (1 - safeAnchor),
    },
    bounds,
    minimumSpan,
  );
}

export function panChartDomain(
  domain: ChartDomain,
  bounds: ChartDomain,
  fraction: number,
  minimumSpan = MINIMUM_DOMAIN_MS,
): ChartDomain {
  if (!Number.isFinite(fraction)) return domain;
  const shift = (domain.end - domain.start) * fraction;
  return clampChartDomain(
    { start: domain.start + shift, end: domain.end + shift },
    bounds,
    minimumSpan,
  );
}

export function nearestTimestamp(
  timestamps: number[],
  value: number,
): number | null {
  if (!timestamps.length || !Number.isFinite(value)) return null;
  return timestamps.reduce((nearest, timestamp) =>
    Math.abs(timestamp - value) < Math.abs(nearest - value)
      ? timestamp
      : nearest,
  );
}

export function adjacentTimestamp(
  timestamps: number[],
  activeTimestamp: number | null,
  direction: -1 | 1,
): number | null {
  if (!timestamps.length) return null;
  const active = activeTimestamp ?? timestamps[0];
  const nearest = nearestTimestamp(timestamps, active);
  const index = nearest === null ? 0 : timestamps.indexOf(nearest);
  return timestamps[
    Math.min(Math.max(index + direction, 0), timestamps.length - 1)
  ];
}
