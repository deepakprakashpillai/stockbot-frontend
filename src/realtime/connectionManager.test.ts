import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RealtimeConnectionManager } from "./connectionManager";

class FakeSocket {
  static instances: FakeSocket[] = [];
  readyState: number = WebSocket.CONNECTING;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }

  open() {
    this.readyState = WebSocket.OPEN;
    this.onopen?.();
  }

  send(payload: string) {
    this.sent.push(payload);
  }

  receive(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent<string>);
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.();
  }
}

function createManager() {
  return new RealtimeConnectionManager({
    websocketUrl: "ws://example.test/api/v1/ws",
    createSocket: (url) => new FakeSocket(url) as unknown as WebSocket,
    getTicket: vi.fn().mockResolvedValue("short lived ticket"),
    random: () => 0,
    heartbeatIntervalMs: 60_000,
    baseReconnectDelayMs: 100,
    maxReconnectDelayMs: 1_000,
  });
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("RealtimeConnectionManager", () => {
  beforeEach(() => {
    FakeSocket.instances = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("multiplexes features over one ticket-authenticated socket", async () => {
    const manager = createManager();
    const stopFirst = manager.subscribe("backtest:first", vi.fn());
    const stopSecond = manager.subscribe("backtest:second", vi.fn());
    await flushPromises();

    expect(FakeSocket.instances).toHaveLength(1);
    expect(FakeSocket.instances[0].url).toContain("ticket=short+lived+ticket");
    FakeSocket.instances[0].open();
    expect(
      FakeSocket.instances[0].sent.map((value) => JSON.parse(value)),
    ).toEqual([
      { action: "subscribe", channels: ["backtest:first"] },
      { action: "subscribe", channels: ["backtest:second"] },
    ]);

    stopFirst();
    expect(
      FakeSocket.instances[0].sent.map((value) => JSON.parse(value)).at(-1),
    ).toEqual({
      action: "unsubscribe",
      channel: "backtest:first",
    });
    stopSecond();
    expect(manager.connectionState).toBe("idle");
  });

  it("deduplicates events and resumes from the latest sequence", async () => {
    const manager = createManager();
    const handler = vi.fn();
    const stop = manager.subscribe("backtest:run-1", handler);
    await flushPromises();
    const first = FakeSocket.instances[0];
    first.open();
    const event = {
      contract_version: "1.2.0",
      event_id: "event-1",
      sequence: 7,
      type: "backtest.progress",
      channel: "backtest:run-1",
      timestamp: "2026-08-05T10:00:00Z",
      data: { progress: 50 },
    };
    first.receive(event);
    first.receive(event);
    first.receive({ ...event, event_id: "event-stale", sequence: 6 });
    expect(handler).toHaveBeenCalledTimes(1);
    first.receive({
      type: "snapshot_required",
      channel: "backtest:run-1",
      after_sequence: 7,
      latest_sequence: 9,
      reason: "REPLAY_LIMIT_EXCEEDED",
    });
    expect(handler).toHaveBeenCalledTimes(2);

    first.close();
    await vi.advanceTimersByTimeAsync(100);
    await flushPromises();
    expect(FakeSocket.instances).toHaveLength(2);
    const second = FakeSocket.instances[1];
    second.open();
    expect(second.sent.map((value) => JSON.parse(value))).toContainEqual({
      action: "resume",
      channel: "backtest:run-1",
      after_sequence: 9,
    });
    second.receive({ ...event, event_id: "event-2", sequence: 10 });
    expect(handler).toHaveBeenCalledTimes(3);
    stop();
  });

  it("removes a channel and closes the socket during cleanup", async () => {
    const manager = createManager();
    const stop = manager.subscribe("backtest:run-1", vi.fn());
    await flushPromises();
    const socket = FakeSocket.instances[0];
    socket.open();
    stop();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(FakeSocket.instances).toHaveLength(1);
    expect(socket.readyState).toBe(WebSocket.CLOSED);
  });

  it("requests a saved snapshot when the server contract is incompatible", async () => {
    const manager = createManager();
    const handler = vi.fn();
    const stop = manager.subscribe("backtest:run-1", handler);
    await flushPromises();
    const socket = FakeSocket.instances[0];
    socket.open();
    socket.receive({
      contract_version: "9.0.0",
      event_id: "unknown",
      sequence: 100,
      type: "backtest.completed",
      channel: "backtest:run-1",
      timestamp: "2026-10-17T00:00:00Z",
      data: {},
    });
    expect(manager.connectionState).toBe("degraded");
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "snapshot_required",
        reason: "UNSUPPORTED_CONTRACT_VERSION",
        after_sequence: 0,
      }),
    );
    stop();
  });
});
