import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/firestore-rules.test.ts"],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    pool: "forks",
    fileParallelism: false,
  },
});
