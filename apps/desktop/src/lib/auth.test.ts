import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import capabilities from "../../src-tauri/capabilities/default.json";
import { openUrl } from "@tauri-apps/plugin-opener";
import { api } from "./api";
import { loginWithDiscord } from "./auth";

vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
vi.mock("./config", () => ({ inTauri: true, API_URL: "http://localhost:3000" }));
vi.mock("./api", async (importOriginal) => ({
  ...await importOriginal<typeof import("./api")>(),
  api: vi.fn(),
}));
vi.mock("./secureStore", () => ({ saveToken: vi.fn(), loadToken: vi.fn(), clearToken: vi.fn() }));
vi.mock("./pkce", () => ({
  createPkcePair: vi.fn(async () => ({ verifier: "test-verifier", challenge: "test-challenge" })),
}));

const start = {
  state: "test-state",
  url: "https://discord.com/oauth2/authorize?client_id=123",
  inviteUrl: null,
};
beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.useRealTimers());

describe("Connexion Discord depuis Tauri", () => {
  it("autorise explicitement l’URL OAuth dans les permissions natives", () => {
    expect(capabilities.permissions).toContainEqual({
      identifier: "opener:allow-open-url",
      allow: [{ url: "https://discord.com/oauth2/authorize*" }],
    });
  });

  it("identifie un refus d’ouverture du navigateur", async () => {
    vi.mocked(api).mockResolvedValueOnce(start);
    vi.mocked(openUrl).mockRejectedValueOnce(new Error("URL not allowed"));
    await expect(loginWithDiscord(new AbortController().signal, { onTwoFactor: vi.fn() }))
      .rejects.toMatchObject({ reason: "browser" });
    expect(api).toHaveBeenCalledTimes(1);
  });

  it("interroge le flux OAuth après l’ouverture du navigateur", async () => {
    vi.useFakeTimers();
    vi.mocked(api).mockResolvedValueOnce(start).mockResolvedValueOnce({ status: "error", error: "not_member" });
    vi.mocked(openUrl).mockResolvedValueOnce(undefined);
    const result = expect(loginWithDiscord(new AbortController().signal, { onTwoFactor: vi.fn() }))
      .rejects.toMatchObject({ reason: "not_member" });
    await vi.advanceTimersByTimeAsync(2000);
    await result;
    expect(openUrl).toHaveBeenCalledWith(start.url);
    expect(api).toHaveBeenLastCalledWith("/auth/discord/exchange", expect.any(Object));
  });
});
