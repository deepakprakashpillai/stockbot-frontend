import { copyFile, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const source = process.env.BACKEND_OPENAPI_PATH;
const websocketSource = process.env.BACKEND_WEBSOCKET_PATH;
if (!source || !websocketSource) {
  throw new Error(
    "Set BACKEND_OPENAPI_PATH and BACKEND_WEBSOCKET_PATH to the backend contract files.",
  );
}

const destination = resolve("contracts/backend-openapi.json");
await copyFile(resolve(source), destination);
const content = await readFile(destination);
const checksum = createHash("sha256").update(content).digest("hex");
const document = JSON.parse(content);
const websocketDestination = resolve("contracts/backend-websocket-v1.json");
await copyFile(resolve(websocketSource), websocketDestination);
const websocketContent = await readFile(websocketDestination);
const websocketChecksum = createHash("sha256")
  .update(websocketContent)
  .digest("hex");
const websocketDocument = JSON.parse(websocketContent);
await writeFile(
  "contracts/backend-contract.json",
  `${JSON.stringify(
    {
      apiVersion: document.info.version,
      openapiChecksum: checksum,
      websocketVersion: websocketDocument.contract_version,
      websocketChecksum,
    },
    null,
    2,
  )}\n`,
);
await writeFile(
  "contracts/backend-websocket-v1.sha256",
  `${websocketChecksum}  backend-websocket-v1.json\n`,
);
await writeFile(
  "contracts/backend-openapi.sha256",
  `${checksum}  backend-openapi.json\n`,
);
