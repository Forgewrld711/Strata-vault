import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // Tests hit the live API server — run sequentially so session state is predictable.
    singleFork: true,
    testTimeout: 15_000,
  },
});
