import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Public API surface drift guard (Stable Release Engineering Program,
// Phase 2). The committed snapshot docs/api/public-api.snapshot.json
// is the reviewed public surface of src/index.ts. Any change to
// exported names — addition or removal — fails this test until the
// snapshot is regenerated and the change is reviewed as a deliberate
// API change (see docs/API-INVENTORY.md).
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

describe("public API surface", () => {
  it("matches the reviewed snapshot", () => {
    const out = execFileSync(
      process.execPath,
      [join(root, "scripts", "api-surface.mjs"), join(root, "src", "index.ts"), "--check", join(root, "docs", "api", "public-api.snapshot.json")],
      { encoding: "utf8" },
    );
    expect(out).toContain("API surface matches");
  });
});
