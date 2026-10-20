import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
    env: {
      ALLOW_LEGACY_REQUESTER_HEADER: "true",
    },
  },
});
