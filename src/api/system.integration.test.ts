// @vitest-environment node

import { describe, expect, it } from "vitest";

import { getSystemStatus } from "./system";

describe("live backend contract", () => {
  it.runIf(import.meta.env.VITE_LIVE_API_SMOKE === "1")(
    "reads the Phase 1 system endpoints through the generated client",
    async () => {
      const status = await getSystemStatus();

      expect(status.health.status).toBe("ok");
      expect(status.readiness.status).toBe("ready");
      expect(status.system.api_version).toBe("v1");
    },
  );
});
