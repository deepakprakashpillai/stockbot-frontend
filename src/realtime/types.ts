export type RealtimeConnectionState =
  "idle" | "connecting" | "connected" | "reconnecting" | "degraded";

export type RealtimeEvent = {
  contract_version: string;
  event_id: string;
  sequence: number;
  type: string;
  channel: string;
  timestamp: string;
  data: Record<string, unknown>;
};

export type RealtimeSnapshotRequired = {
  type: "snapshot_required";
  channel: string;
  after_sequence: number;
  latest_sequence: number;
  reason: string;
};

export type RealtimeMessage = RealtimeEvent | RealtimeSnapshotRequired;
export type RealtimeEventHandler = (event: RealtimeMessage) => void;
