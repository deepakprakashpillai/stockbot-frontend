export type RunWorkspaceSelection =
  | { type: "none" }
  | { type: "signal"; id: string }
  | { type: "trade"; id: string }
  | { type: "event"; id: string }
  | { type: "equity"; id: string };

export type RunExplorerState = {
  selection: RunWorkspaceSelection;
  start?: string;
  end?: string;
  tab?: string;
  signalDecision?: "ACCEPTED" | "REJECTED";
  signalRejectionReason?: string;
  eventType?: string;
  liveFollow?: boolean;
};

const TYPES = new Set(["signal", "trade", "event", "equity"]);

export function readRunWorkspaceSelection(
  params: URLSearchParams,
): RunWorkspaceSelection {
  const type = params.get("selection");
  const id = params.get("record");
  return type && id && TYPES.has(type)
    ? { type: type as Exclude<RunWorkspaceSelection["type"], "none">, id }
    : { type: "none" };
}

export function writeRunWorkspaceSelection(
  params: URLSearchParams,
  selection: RunWorkspaceSelection,
) {
  const next = new URLSearchParams(params);
  if (selection.type === "none") {
    next.delete("selection");
    next.delete("record");
  } else {
    next.set("selection", selection.type);
    next.set("record", selection.id);
  }
  return next;
}

function validTimestamp(value: string | null) {
  return Boolean(value && !Number.isNaN(Date.parse(value)));
}

export function readRunExplorerState(
  params: URLSearchParams,
): RunExplorerState {
  const start = params.get("range_start");
  const end = params.get("range_end");
  const validRange =
    validTimestamp(start) && validTimestamp(end) && start! <= end!;
  const decision = params.get("signal_decision");
  return {
    selection: readRunWorkspaceSelection(params),
    start: validRange ? start! : undefined,
    end: validRange ? end! : undefined,
    tab: params.get("tab") ?? undefined,
    signalDecision:
      decision === "ACCEPTED" || decision === "REJECTED" ? decision : undefined,
    signalRejectionReason: params.get("signal_rejection") ?? undefined,
    eventType: params.get("event_type") ?? undefined,
    liveFollow: params.get("live_follow") === "false" ? false : undefined,
  };
}

export function writeRunExplorerState(
  params: URLSearchParams,
  state: Partial<RunExplorerState>,
) {
  let next = new URLSearchParams(params);
  if (state.selection) next = writeRunWorkspaceSelection(next, state.selection);
  const values: Array<[keyof RunExplorerState, string]> = [
    ["start", "range_start"],
    ["end", "range_end"],
    ["tab", "tab"],
    ["signalDecision", "signal_decision"],
    ["signalRejectionReason", "signal_rejection"],
    ["eventType", "event_type"],
  ];
  for (const [stateKey, parameterKey] of values) {
    if (!(stateKey in state)) continue;
    const value = state[stateKey];
    if (typeof value === "string" && value) next.set(parameterKey, value);
    else next.delete(parameterKey);
  }
  if ("liveFollow" in state) {
    if (state.liveFollow === false) next.set("live_follow", "false");
    else next.delete("live_follow");
  }
  return next;
}
