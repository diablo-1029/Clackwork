import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Runs the balance simulation (npm run simulate). Kept apart from the test suite: it prints a report and asserts nothing.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/sim/**/*.sim.ts"],
    testTimeout: 120_000,
  },
});
