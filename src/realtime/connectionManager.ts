import { getRuntimeConfig } from "../lib/config";
import { authenticatedFetch } from "../api/client";
import type {
  RealtimeConnectionState,
  RealtimeEvent,
  RealtimeEventHandler,
  RealtimeSnapshotRequired,
} from "./types";

type WebSocketFactory = (url: string) => WebSocket;
type TicketProvider = () => Promise<string>;
type Timer = ReturnType<typeof setTimeout>;

type Subscription = {
  handlers: Set<RealtimeEventHandler>;
  lastSequence: number;
};

export type RealtimeManagerOptions = {
  websocketUrl?: string;
  createSocket?: WebSocketFactory;
  getTicket?: TicketProvider;
  random?: () => number;
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
  baseReconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
};

const MAX_MESSAGE_BYTES = 256 * 1024;
const MAX_EVENT_IDS = 2_000;
const MAX_CHANNELS = 100;
const MAX_HANDLERS_PER_CHANNEL = 50;

function websocketUrlWithTicket(baseUrl: string, ticket: string) {
  const url = new URL(baseUrl);
  url.searchParams.set("ticket", ticket);
  return url.toString();
}

function isRealtimeEvent(value: unknown): value is RealtimeEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  return (
    typeof event.event_id === "string" &&
    Number.isSafeInteger(event.sequence) &&
    Number(event.sequence) >= 0 &&
    typeof event.type === "string" &&
    typeof event.channel === "string" &&
    typeof event.timestamp === "string" &&
    Boolean(event.data) &&
    typeof event.data === "object" &&
    !Array.isArray(event.data)
  );
}

function isSnapshotRequired(value: unknown): value is RealtimeSnapshotRequired {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  return (
    message.type === "snapshot_required" &&
    typeof message.channel === "string" &&
    Number.isSafeInteger(message.after_sequence) &&
    Number.isSafeInteger(message.latest_sequence) &&
    typeof message.reason === "string"
  );
}

async function requestRealtimeTicket() {
  const { apiBaseUrl } = getRuntimeConfig();
  const response = await authenticatedFetch(
    `${apiBaseUrl}/api/v1/realtime/tickets`,
    {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    },
  );
  if (!response.ok) throw new Error("Could not obtain a realtime ticket.");
  const body = (await response.json()) as { ticket?: unknown };
  if (typeof body.ticket !== "string" || !body.ticket) {
    throw new Error("The realtime ticket response was invalid.");
  }
  return body.ticket;
}

export class RealtimeConnectionManager {
  private readonly websocketUrl: string;
  private readonly createSocket: WebSocketFactory;
  private readonly getTicket: TicketProvider;
  private readonly random: () => number;
  private readonly heartbeatIntervalMs: number;
  private readonly heartbeatTimeoutMs: number;
  private readonly baseReconnectDelayMs: number;
  private readonly maxReconnectDelayMs: number;
  private readonly subscriptions = new Map<string, Subscription>();
  private readonly stateHandlers = new Set<
    (state: RealtimeConnectionState) => void
  >();
  private readonly seenEventIds = new Set<string>();
  private readonly seenEventIdOrder: string[] = [];
  private socket: WebSocket | null = null;
  private connecting = false;
  private state: RealtimeConnectionState = "idle";
  private generation = 0;
  private reconnectAttempt = 0;
  private reconnectTimer: Timer | null = null;
  private heartbeatTimer: Timer | null = null;
  private heartbeatDeadline: Timer | null = null;
  private intentionallyClosed = false;

  constructor(options: RealtimeManagerOptions = {}) {
    this.websocketUrl = options.websocketUrl ?? getRuntimeConfig().websocketUrl;
    this.createSocket = options.createSocket ?? ((url) => new WebSocket(url));
    this.getTicket = options.getTicket ?? requestRealtimeTicket;
    this.random = options.random ?? Math.random;
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 25_000;
    this.heartbeatTimeoutMs = options.heartbeatTimeoutMs ?? 10_000;
    this.baseReconnectDelayMs = options.baseReconnectDelayMs ?? 500;
    this.maxReconnectDelayMs = options.maxReconnectDelayMs ?? 10_000;
  }

  get connectionState() {
    return this.state;
  }

  subscribe(channel: string, handler: RealtimeEventHandler) {
    if (!channel || channel.length > 200) {
      throw new Error("Realtime channel is invalid.");
    }
    let subscription = this.subscriptions.get(channel);
    const isNewChannel = !subscription;
    if (!subscription) {
      if (this.subscriptions.size >= MAX_CHANNELS) {
        throw new Error("Realtime channel limit reached.");
      }
      subscription = { handlers: new Set(), lastSequence: 0 };
      this.subscriptions.set(channel, subscription);
    }
    if (subscription.handlers.size >= MAX_HANDLERS_PER_CHANNEL) {
      throw new Error("Realtime listener limit reached.");
    }
    subscription.handlers.add(handler);
    this.intentionallyClosed = false;
    if (isNewChannel && this.socket?.readyState === WebSocket.OPEN) {
      this.sendSubscription(channel, subscription.lastSequence);
    } else {
      void this.connect();
    }

    let active = true;
    return () => {
      if (!active) return;
      active = false;
      const current = this.subscriptions.get(channel);
      current?.handlers.delete(handler);
      if (current && current.handlers.size === 0) {
        this.subscriptions.delete(channel);
        if (this.socket?.readyState === WebSocket.OPEN) {
          this.send({ action: "unsubscribe", channel });
        }
      }
      if (this.subscriptions.size === 0) this.disconnect();
    };
  }

  onStateChange(handler: (state: RealtimeConnectionState) => void) {
    this.stateHandlers.add(handler);
    handler(this.state);
    return () => {
      this.stateHandlers.delete(handler);
    };
  }

  disconnect() {
    this.intentionallyClosed = true;
    this.generation += 1;
    this.connecting = false;
    this.clearTimers();
    const socket = this.socket;
    this.socket = null;
    socket?.close(1000, "No active subscriptions");
    this.setState("idle");
  }

  private async connect() {
    if (
      this.subscriptions.size === 0 ||
      this.connecting ||
      this.socket?.readyState === WebSocket.CONNECTING ||
      this.socket?.readyState === WebSocket.OPEN
    ) {
      return;
    }
    const generation = ++this.generation;
    this.connecting = true;
    this.setState(this.reconnectAttempt > 0 ? "reconnecting" : "connecting");
    try {
      const ticket = await this.getTicket();
      this.connecting = false;
      if (generation !== this.generation || this.subscriptions.size === 0)
        return;
      const socket = this.createSocket(
        websocketUrlWithTicket(this.websocketUrl, ticket),
      );
      this.socket = socket;
      socket.onopen = () => {
        if (generation !== this.generation) return socket.close();
        this.reconnectAttempt = 0;
        this.setState("connected");
        for (const [channel, subscription] of this.subscriptions) {
          this.sendSubscription(channel, subscription.lastSequence);
        }
        this.scheduleHeartbeat();
      };
      socket.onmessage = (message) => this.handleMessage(message.data);
      socket.onerror = () => this.setState("degraded");
      socket.onclose = () => {
        if (this.socket === socket) this.socket = null;
        this.clearHeartbeat();
        if (!this.intentionallyClosed && this.subscriptions.size > 0) {
          this.scheduleReconnect();
        }
      };
    } catch {
      this.connecting = false;
      if (generation === this.generation && this.subscriptions.size > 0) {
        this.setState("degraded");
        this.scheduleReconnect();
      }
    }
  }

  private handleMessage(raw: unknown) {
    if (typeof raw !== "string" || raw.length > MAX_MESSAGE_BYTES) return;
    let message: unknown;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    if (
      message &&
      typeof message === "object" &&
      (message as { type?: unknown }).type === "pong"
    ) {
      this.markActivity();
      return;
    }
    if (isSnapshotRequired(message)) {
      const subscription = this.subscriptions.get(message.channel);
      if (!subscription) return;
      subscription.lastSequence = Math.max(
        subscription.lastSequence,
        message.latest_sequence,
      );
      this.markActivity();
      this.deliver(subscription, message);
      return;
    }
    if (!isRealtimeEvent(message)) return;
    const subscription = this.subscriptions.get(message.channel);
    if (message.contract_version !== "1.2.0") {
      this.setState("degraded");
      if (subscription)
        this.deliver(subscription, {
          type: "snapshot_required",
          channel: message.channel,
          after_sequence: subscription.lastSequence,
          latest_sequence: subscription.lastSequence,
          reason: "UNSUPPORTED_CONTRACT_VERSION",
        });
      return;
    }
    if (
      !subscription ||
      message.sequence <= subscription.lastSequence ||
      this.seenEventIds.has(message.event_id)
    ) {
      return;
    }
    subscription.lastSequence = message.sequence;
    this.markActivity();
    this.rememberEventId(message.event_id);
    this.deliver(subscription, message);
  }

  private deliver(
    subscription: Subscription,
    message: Parameters<RealtimeEventHandler>[0],
  ) {
    for (const handler of [...subscription.handlers]) {
      try {
        handler(message);
      } catch {
        // One feature listener must not prevent delivery to other subscribers.
      }
    }
  }

  private rememberEventId(eventId: string) {
    this.seenEventIds.add(eventId);
    this.seenEventIdOrder.push(eventId);
    if (this.seenEventIdOrder.length > MAX_EVENT_IDS) {
      const oldest = this.seenEventIdOrder.shift();
      if (oldest) this.seenEventIds.delete(oldest);
    }
  }

  private sendSubscription(channel: string, afterSequence: number) {
    if (afterSequence > 0) {
      this.send({ action: "resume", channel, after_sequence: afterSequence });
    } else {
      this.send({ action: "subscribe", channels: [channel] });
    }
  }

  private send(payload: Record<string, unknown>) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    }
  }

  private scheduleHeartbeat() {
    this.clearHeartbeat();
    this.heartbeatTimer = setTimeout(() => {
      this.send({ action: "ping" });
      this.heartbeatDeadline = setTimeout(() => {
        this.setState("degraded");
        this.socket?.close(4000, "Heartbeat timeout");
      }, this.heartbeatTimeoutMs);
    }, this.heartbeatIntervalMs);
  }

  private markActivity() {
    if (this.heartbeatDeadline) clearTimeout(this.heartbeatDeadline);
    this.heartbeatDeadline = null;
    this.scheduleHeartbeat();
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || this.intentionallyClosed) return;
    this.setState("reconnecting");
    const exponential = Math.min(
      this.maxReconnectDelayMs,
      this.baseReconnectDelayMs * 2 ** this.reconnectAttempt,
    );
    this.reconnectAttempt += 1;
    const delay = Math.round(exponential * (0.75 + this.random() * 0.5));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }

  private setState(state: RealtimeConnectionState) {
    if (this.state === state) return;
    this.state = state;
    for (const handler of [...this.stateHandlers]) handler(state);
  }

  private clearHeartbeat() {
    if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer);
    if (this.heartbeatDeadline) clearTimeout(this.heartbeatDeadline);
    this.heartbeatTimer = null;
    this.heartbeatDeadline = null;
  }

  private clearTimers() {
    this.clearHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }
}

export const realtimeConnectionManager = new RealtimeConnectionManager();
