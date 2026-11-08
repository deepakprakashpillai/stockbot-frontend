import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useSearchParams } from "react-router-dom";

import { AppShell } from "../components/AppShell";
const Dashboard = lazy(() =>
  import("../features/dashboard/Dashboard").then((module) => ({
    default: module.Dashboard,
  })),
);
const BacktestHistoryPage = lazy(() =>
  import("../features/backtests/BacktestHistoryPage").then((module) => ({
    default: module.BacktestHistoryPage,
  })),
);
const BacktestResultPage = lazy(() =>
  import("../features/backtests/BacktestResultPage").then((module) => ({
    default: module.BacktestResultPage,
  })),
);
const ComparisonsPage = lazy(() =>
  import("../features/backtests/ComparisonsPage").then((module) => ({
    default: module.ComparisonsPage,
  })),
);
const ExperimentsPage = lazy(() =>
  import("../features/backtests/ExperimentsPage").then((module) => ({
    default: module.ExperimentsPage,
  })),
);
const DatasetsPage = lazy(() =>
  import("../features/datasets/DatasetsPage").then((module) => ({
    default: module.DatasetsPage,
  })),
);
const DatasetExplorerPage = lazy(() =>
  import("../features/datasetExplorer/DatasetExplorerPage").then((module) => ({
    default: module.DatasetExplorerPage,
  })),
);
import { SystemStatusPage } from "../features/system/SystemStatusPage";
const BacktestStudio = lazy(() =>
  import("../features/studio/BacktestStudio").then((module) => ({
    default: module.BacktestStudio,
  })),
);

export function AppRouter() {
  return (
    <Suspense fallback={<p role="status">Loading workspace…</p>}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />

          {/* New Unified Workflow */}
          <Route path="studio" element={<BacktestStudio />} />

          {/* Library Assets */}
          <Route path="library" element={<LibraryRoute />} />
          <Route
            path="datasets"
            element={<Navigate to="/library?tab=datasets" replace />}
          />
          <Route
            path="algorithms"
            element={<Navigate to="/library?tab=algorithms" replace />}
          />

          {/* Results & History */}
          <Route path="backtests" element={<Navigate to="/studio" replace />} />
          <Route path="backtests/history" element={<BacktestHistoryPage />} />
          <Route path="backtests/:runId" element={<BacktestResultPage />} />
          <Route path="comparisons" element={<ComparisonsPage />} />
          <Route path="experiments" element={<ExperimentsPage />} />

          {import.meta.env.DEV && (
            <Route path="dev/system" element={<SystemStatusPage />} />
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

function LibraryRoute() {
  const [params] = useSearchParams();
  return params.get("explorer") === "1" ? (
    <DatasetExplorerPage />
  ) : (
    <DatasetsPage />
  );
}
