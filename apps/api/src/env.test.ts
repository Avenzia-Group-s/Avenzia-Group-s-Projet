import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  for (const [name, value] of Object.entries({
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    API_PUBLIC_URL: "http://localhost:3000", API_PORT: "3000", API_HOST: "127.0.0.1",
    DISCORD_CLIENT_ID: "123456789012345678", DISCORD_CLIENT_SECRET: "test-secret",
    DISCORD_BOT_TOKEN: "test-token", DISCORD_GUILD_ID: "123456789012345679",
    INTERNAL_API_SECRET: "x".repeat(48), TWO_FA_ENABLED: "true", API_TRUST_PROXY_HOPS: "0",
  })) vi.stubEnv(name, value);
});
afterEach(() => vi.unstubAllEnvs());

it("utilise le port et le domaine publics du service Render", async () => {
  vi.stubEnv("API_PORT", undefined);
  vi.stubEnv("PORT", "10000");
  vi.stubEnv("API_HOST", "0.0.0.0");
  vi.stubEnv("API_PUBLIC_URL", undefined);
  vi.stubEnv("RENDER_EXTERNAL_URL", "https://avenzia-test.onrender.com/");
  const { env } = await import("./env");
  expect(env.API_PORT).toBe(10000);
  expect(env.API_HOST).toBe("0.0.0.0");
  expect(env.API_PUBLIC_URL).toBe("https://avenzia-test.onrender.com");
});
it("conserve les réglages locaux explicites", async () => {
  vi.stubEnv("PORT", "10000");
  const { env } = await import("./env");
  expect(env.API_PORT).toBe(3000);
  expect(env.API_HOST).toBe("127.0.0.1");
  expect(env.API_PUBLIC_URL).toBe("http://localhost:3000");
});
