import { defineConfig } from "vitest/config";
import path from "node:path";

// The tests do not depend on the shell they run in: the NEXT_PUBLIC_* bases of a build (stand-ins for a browser run) must not leak in.
// Leaking them changed every request URL the entry tests record, and made two tests in w1-entry.test.tsx fail.
delete process.env.NEXT_PUBLIC_API_BASE_URL;
delete process.env.NEXT_PUBLIC_WAWU_ID_BASE;

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  esbuild: { jsx: "automatic" },
  // `performance` is faked with the rest (the page measures waits on it, so a test that moves time must move it too).
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/support/clock-setup.ts"],
    fakeTimers: { toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "setImmediate", "clearImmediate", "Date", "performance"] },
  },
});
