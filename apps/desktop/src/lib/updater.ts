import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { inTauri } from "./config";

export type UpdateState =
  | { s: "idle" | "checking" | "none" | "unsupported" }
  | { s: "available"; version: string; notes: string }
  | { s: "downloading"; version: string; pct: number | null }
  | { s: "installing" | "restarting"; version: string }
  | { s: "error"; msg: string; retryInstall: boolean; restartRequired?: boolean };

export function createUpdater(onChange: (state: UpdateState) => void, supported = inTauri) {
  let update: Update | null = null;
  let busy = false;
  let disposed = false;
  let installedVersion = "";

  const emit = (state: UpdateState) => { if (!disposed) onChange(state); };
  const close = () => {
    const previous = update;
    update = null;
    if (previous) void previous.close().catch(() => {});
  };

  async function checkNow() {
    if (busy || disposed) return;
    if (!supported) { emit({ s: "unsupported" }); return; }
    busy = true;
    close();
    emit({ s: "checking" });
    try {
      const found = await check({ timeout: 15_000 });
      if (disposed) {
        if (found) await found.close().catch(() => {});
        return;
      }
      update = found;
      emit(found
        ? { s: "available", version: found.version, notes: found.body || "" }
        : { s: "none" });
    } catch {
      emit({ s: "error", msg: "La recherche de mise à jour a échoué. Vérifiez votre connexion et réessayez.", retryInstall: false });
    } finally { busy = false; }
  }

  async function install() {
    if (busy || disposed || !update) return;
    const candidate = update;
    busy = true;
    let total = 0;
    let received = 0;
    emit({ s: "downloading", version: candidate.version, pct: null });
    try {
      // Le plugin vérifie la signature avant d’autoriser l’installation.
      await candidate.download(event => {
        if (event.event === "Started") total = event.data.contentLength || 0;
        if (event.event === "Progress") received += event.data.chunkLength;
        emit({
          s: "downloading", version: candidate.version,
          pct: total ? Math.min(100, Math.round(received / total * 100)) : null,
        });
      }, { timeout: 120_000 });
      if (disposed) return;
      emit({ s: "installing", version: candidate.version });
      await candidate.install();
      installedVersion = candidate.version;
    } catch {
      emit({ s: "error", msg: "La mise à jour n’a pas pu être installée. Réessayez ou recherchez une nouvelle version.", retryInstall: true });
    } finally {
      busy = false;
      if (disposed) close();
    }
    if (installedVersion && !disposed) await restart();
  }

  async function restart() {
    if (busy || disposed || !installedVersion) return;
    busy = true;
    emit({ s: "restarting", version: installedVersion });
    try { await relaunch(); }
    catch { emit({ s: "error", msg: "La mise à jour est installée. Redémarrez Avenzia pour l’utiliser.", retryInstall: false, restartRequired: true }); }
    finally { busy = false; if (disposed) close(); }
  }

  return {
    checkNow,
    install,
    restart,
    dispose() {
      disposed = true;
      if (!busy) close();
    },
  };
}
