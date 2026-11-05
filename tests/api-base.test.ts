import { afterEach, describe, expect, it, vi } from "vitest";

async function base() {
  vi.resetModules();
  return (await import("@/lib/api/config")).API_BASE;
}
afterEach(() => vi.unstubAllEnvs());

describe("API_BASE", () => {
  it("defaults to /api/v1 when the variable is not set", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", undefined as unknown as string);
    expect(await base()).toBe("/api/v1");
  });
  it("an empty variable (as in .env.example) still gives /api/v1", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
    expect(await base()).toBe("/api/v1");
  });
  it("a set variable wins", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://127.0.0.1:4000/api/v1");
    expect(await base()).toBe("http://127.0.0.1:4000/api/v1");
  });
});
