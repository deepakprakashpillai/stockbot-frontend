import { useEffect, useRef, useState } from "react";

import { realtimeConnectionManager } from "./connectionManager";
import type {
  RealtimeConnectionState,
  RealtimeMessage,
  RealtimeEventHandler,
} from "./types";

export function useRealtimeChannel(
  channel: string | null,
  onEvent: RealtimeEventHandler,
) {
  const handlerRef = useRef(onEvent);
  const [connectionState, setConnectionState] =
    useState<RealtimeConnectionState>(
      realtimeConnectionManager.connectionState,
    );
  const [lastEvent, setLastEvent] = useState<RealtimeMessage | null>(null);

  handlerRef.current = onEvent;

  useEffect(
    () => realtimeConnectionManager.onStateChange(setConnectionState),
    [],
  );

  useEffect(() => {
    if (!channel) return;
    return realtimeConnectionManager.subscribe(channel, (event) => {
      setLastEvent(event);
      handlerRef.current(event);
    });
  }, [channel]);

  return { connectionState, lastEvent };
}
