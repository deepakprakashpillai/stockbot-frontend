import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

async function sha256(path) {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

const manifest = JSON.parse(await readFile("contracts/backend-contract.json"));
const openapi = JSON.parse(await readFile("contracts/backend-openapi.json"));
const websocket = JSON.parse(
  await readFile("contracts/backend-websocket-v1.json"),
);
const actualOpenapiChecksum = await sha256("contracts/backend-openapi.json");
const actualWebsocketChecksum = await sha256(
  "contracts/backend-websocket-v1.json",
);

if (
  manifest.apiVersion !== openapi.info.version ||
  manifest.openapiChecksum !== actualOpenapiChecksum
) {
  throw new Error("Pinned OpenAPI contract manifest is stale.");
}
if (
  manifest.websocketVersion !== websocket.contract_version ||
  manifest.websocketChecksum !== actualWebsocketChecksum
) {
  throw new Error("Pinned WebSocket contract manifest is stale.");
}
if (
  websocket.demo_invariants?.mode !== "PLATFORM_DEMO" ||
  websocket.demo_invariants?.unit !== "DEMO_UNITS" ||
  websocket.demo_invariants?.synthetic !== true ||
  websocket.demo_invariants?.financial_pnl_available !== false
) {
  throw new Error("Pinned WebSocket contract lost the demo safety invariants.");
}

console.log(
  `Contracts verified: REST ${manifest.apiVersion}, WebSocket ${manifest.websocketVersion}.`,
);
