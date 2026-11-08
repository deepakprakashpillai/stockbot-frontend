import { AlertTriangle, Clock } from "lucide-react";

import type { BacktestRun, RunEvent } from "../../api/backtests";
import { ApiError } from "../../api/system";
import { formatPlatformDateTime } from "../../lib/dateTime";
import { RunEvidencePanel } from "./RunEvidencePanel";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Props = {
  run: BacktestRun;
  events: RunEvent[];
  loaded: boolean;
  error: unknown;
  hasNextPage: boolean;
  loadingNextPage: boolean;
  filter: string;
  selectedEventId?: string;
  onFilterChange: (value: string) => void;
  onSelectEvent: (id: string) => void;
  onLoadMore: () => void;
};

export function RunSystemActivity({
  run,
  events,
  loaded,
  error,
  hasNextPage,
  loadingNextPage,
  filter,
  selectedEventId,
  onFilterChange,
  onSelectEvent,
  onLoadMore,
}: Props) {
  return (
    <div id="section-audit" className="mt-6">
      <RunEvidencePanel run={run} />
      <details
        open={Boolean(selectedEventId || filter)}
        className="mt-6 rounded-xl border border-border p-4"
      >
        <summary className="cursor-pointer text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
          System activity · progress and worker events
        </summary>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Durable Run Events</CardTitle>
            <CardDescription>
              Real-time lifecycle and progress markers
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error instanceof ApiError && (
              <div className="bg-destructive/10 text-destructive border border-destructive/20 p-4 rounded-lg flex items-start gap-3 my-4">
                <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-sm">{error.message}</p>
                  {error.requestId && (
                    <p className="text-xs mt-1 opacity-80">
                      Request ID: {error.requestId}
                    </p>
                  )}
                </div>
              </div>
            )}
            <label className="mb-4 grid max-w-xs gap-1 text-xs font-medium text-muted-foreground">
              Event type
              <input
                aria-label="Event type filter"
                value={filter}
                onChange={(event) => onFilterChange(event.target.value)}
                placeholder="Exact event type"
                className="h-9 rounded-md border border-border bg-surface px-2 text-foreground"
              />
            </label>
            {loaded && events.length === 0 && (
              <div className="p-8 text-center text-muted-foreground border border-dashed border-border rounded-lg">
                No events recorded yet.
              </div>
            )}
            {events.length > 0 && (
              <div className="relative pl-6 space-y-6 before:absolute before:inset-y-0 before:left-2.5 before:w-px before:bg-border my-6">
                {events.map((event) => (
                  <div
                    key={event.id}
                    id={`event-${event.id}`}
                    data-selected={
                      selectedEventId === event.id ? "true" : undefined
                    }
                    className="relative cursor-pointer rounded-lg data-[selected=true]:bg-brand/10"
                    onClick={() => onSelectEvent(event.id)}
                    onKeyDown={(keyboardEvent) => {
                      if (
                        keyboardEvent.key === "Enter" ||
                        keyboardEvent.key === " "
                      ) {
                        keyboardEvent.preventDefault();
                        onSelectEvent(event.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="absolute -left-6 mt-1.5 h-2 w-2 rounded-full bg-brand shadow-[0_0_8px_var(--brand)]" />
                    <div className="bg-surface/40 border border-border rounded-lg p-3 inline-block min-w-[280px]">
                      <div className="flex items-center justify-between gap-4 mb-1">
                        <span className="font-bold text-sm text-foreground">
                          {event.event_type}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded">
                          Seq: {event.sequence}
                        </span>
                      </div>
                      <time className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatPlatformDateTime(event.created_at)}
                      </time>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {hasNextPage && (
              <div className="flex justify-center mt-2">
                <Button
                  variant="outline"
                  onClick={onLoadMore}
                  disabled={loadingNextPage}
                >
                  {loadingNextPage ? "Loading…" : "Load more events"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </details>
    </div>
  );
}
