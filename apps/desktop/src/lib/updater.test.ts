import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { createUpdater, type UpdateState } from "./updater";

vi.mock("@tauri-apps/plugin-updater", () => ({ check: vi.fn() }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: vi.fn() }));
vi.mock("./config", () => ({ inTauri: true }));

const makeUpdate = () => ({
  version: "0.1.1", body: "Corrections", close: vi.fn().mockResolvedValue(undefined),
  download: vi.fn().mockResolvedValue(undefined), install: vi.fn().mockResolvedValue(undefined),
});
const asNative = (update: ReturnType<typeof makeUpdate>) => update as unknown as Update;
beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.useRealTimers());

describe("Mises à jour signées", () => {
  it("annonce la version et ferme la ressource après démontage", async () => {
    const update = makeUpdate();
    vi.mocked(check).mockResolvedValue(asNative(update));
    const state = vi.fn();
    const updater = createUpdater(state);
    await updater.checkNow();
    expect(state).toHaveBeenLastCalledWith({ s: "available", version: "0.1.1", notes: "Corrections" });
    updater.dispose();
    expect(update.close).toHaveBeenCalledOnce();
  });
  it("fusionne les recherches simultanées", async () => {
    let finish!: (value: null) => void;
    vi.mocked(check).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const updater = createUpdater(vi.fn());
    const first = updater.checkNow();
    await updater.checkNow();
    expect(check).toHaveBeenCalledOnce();
    finish(null);
    await first;
    updater.dispose();
  });
  it("télécharge avant d’installer et bloque les doubles clics", async () => {
    const update = makeUpdate();
    let downloaded!: () => void;
    update.download.mockImplementation(() => new Promise<void>(resolve => { downloaded = resolve; }));
    vi.mocked(check).mockResolvedValue(asNative(update));
    const updater = createUpdater(vi.fn());
    await updater.checkNow();
    const first = updater.install();
    await updater.install();
    expect(update.download).toHaveBeenCalledOnce();
    expect(update.install).not.toHaveBeenCalled();
    downloaded();
    await first;
    expect(update.install).toHaveBeenCalledOnce();
    expect(relaunch).toHaveBeenCalledOnce();
    updater.dispose();
  });
  it("permet de réessayer après une erreur de téléchargement", async () => {
    const update = makeUpdate();
    update.download.mockRejectedValueOnce(new Error("signature invalid"));
    vi.mocked(check).mockResolvedValue(asNative(update));
    const state = vi.fn();
    const updater = createUpdater(state);
    await updater.checkNow();
    await updater.install();
    expect(state).toHaveBeenLastCalledWith(expect.objectContaining({ s: "error", retryInstall: true }));
    expect(update.install).not.toHaveBeenCalled();
    await updater.install();
    expect(update.install).toHaveBeenCalledOnce();
    updater.dispose();
  });
  it("affiche une progression indéterminée si la taille manque", async () => {
    const update = makeUpdate();
    const state = vi.fn();
    update.download.mockImplementation(async (callback?: unknown) => {
      (callback as (event: unknown) => void)({ event: "Progress", data: { chunkLength: 100 } });
    });
    vi.mocked(check).mockResolvedValue(asNative(update));
    const updater = createUpdater(state);
    await updater.checkNow();
    await updater.install();
    expect(state).toHaveBeenCalledWith({ s: "downloading", version: "0.1.1", pct: null });
    updater.dispose();
  });
  it("libère une recherche terminée après le démontage", async () => {
    const update = makeUpdate();
    let finish!: (value: Update) => void;
    vi.mocked(check).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const state = vi.fn();
    const updater = createUpdater(state);
    const running = updater.checkNow();
    updater.dispose();
    finish(asNative(update));
    await running;
    expect(update.close).toHaveBeenCalledOnce();
    expect(state).not.toHaveBeenCalledWith(expect.objectContaining({ s: "available" }));
  });
  it("annule l’installation après démontage pendant le téléchargement", async () => {
    const update = makeUpdate();
    let finish!: () => void;
    update.download.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    vi.mocked(check).mockResolvedValue(asNative(update));
    const updater = createUpdater(vi.fn());
    await updater.checkNow();
    const running = updater.install();
    updater.dispose();
    finish();
    await running;
    expect(update.install).not.toHaveBeenCalled();
    expect(update.close).toHaveBeenCalledOnce();
  });
  it("distingue le navigateur d’une application à jour", async () => {
    const states: UpdateState[] = [];
    const updater = createUpdater(state => states.push(state), false);
    await updater.checkNow();
    expect(states).toEqual([{ s: "unsupported" }]);
    expect(check).not.toHaveBeenCalled();
  });
  it("réessaie uniquement le redémarrage après une installation réussie", async () => {
    const update = makeUpdate();
    vi.mocked(check).mockResolvedValue(asNative(update));
    vi.mocked(relaunch).mockRejectedValueOnce(new Error("restart failed")).mockResolvedValueOnce(undefined);
    const state = vi.fn();
    const updater = createUpdater(state);
    await updater.checkNow();
    await updater.install();
    expect(state).toHaveBeenLastCalledWith(expect.objectContaining({ s: "error", restartRequired: true }));
    await updater.restart();
    expect(update.download).toHaveBeenCalledOnce();
    expect(update.install).toHaveBeenCalledOnce();
    expect(relaunch).toHaveBeenCalledTimes(2);
    updater.dispose();
  });

});
