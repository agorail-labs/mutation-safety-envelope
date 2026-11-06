import { configDefaults, defineConfig } from "vitest/config";

// The compiled output under dist/ contains build copies of the test
// files; vitest must never collect them (they resolve fixture paths
// relative to dist/ and double-count the suite). Older vitest
// majors excluded dist/ by default; pin the exclusion explicitly.
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "dist/**"],
  },
});
