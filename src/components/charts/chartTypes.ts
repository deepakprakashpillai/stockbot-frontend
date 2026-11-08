import type { ReactNode } from "react";

export type ChartDomain = {
  start: number;
  end: number;
};

export type ChartView = "chart" | "table";

export type ChartSeries = {
  id: string;
  label: string;
  color: string;
  description?: string;
};

export type ChartFrameProps = {
  title: string;
  description: string;
  children: ReactNode;
};
