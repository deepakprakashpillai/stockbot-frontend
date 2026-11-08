import { Fragment } from "react";
import { useQuery } from "@tanstack/react-query";

import { ApiError, getSystemStatus } from "../../api/system";

export function SystemStatusPage() {
  const status = useQuery({
    queryKey: ["system-status"],
    queryFn: getSystemStatus,
  });

  return (
    <section className="page-card">
      <p className="eyebrow">Development only</p>
      <h1>System status</h1>
      {status.isPending && <p>Checking the backend…</p>}
      {status.isError && (
        <p role="alert">
          {status.error.message}
          {status.error instanceof ApiError && status.error.requestId
            ? ` Request ID: ${status.error.requestId}`
            : ""}
        </p>
      )}
      {status.data && (
        <dl className="status-list">
          <dt>Health</dt>
          <dd>{status.data.health.status}</dd>
          <dt>Readiness</dt>
          <dd>{status.data.readiness.status}</dd>
          <dt>Service</dt>
          <dd>{status.data.system.service}</dd>
          <dt>API version</dt>
          <dd>{status.data.system.api_version}</dd>
          <dt>Environment</dt>
          <dd>{status.data.system.environment}</dd>
          {Object.entries(status.data.readiness.checks).map(([name, value]) => (
            <Fragment key={name}>
              <dt>{name}</dt>
              <dd>{value}</dd>
            </Fragment>
          ))}
        </dl>
      )}
    </section>
  );
}
