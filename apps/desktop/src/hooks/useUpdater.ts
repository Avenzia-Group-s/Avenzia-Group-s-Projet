import { useCallback, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { inTauri } from "../lib/config";

export type UpdateState =
  | { s: "idle" } | { s: "checking" } | { s: "none" }
  | { s: "available"; update: Update } | { s: "downloading"; pct: number } | { s: "error"; msg: string };

export function useUpdater() {
  const [state, setState] = useState<UpdateState>({ s: "idle" });

  const checkNow = useCallback(async () => {
    if (!inTauri) return setState({ s: "none" });
    setState({ s: "checking" });
    try {
      // La signature minisign est vérifiée par le plugin avec la clé publique de tauri.conf.json.
      const update = await check();
      setState(update ? { s: "available", update } : { s: "none" });
    } catch (e) { setState({ s: "error", msg: e instanceof Error ? e.message : String(e) }); }
  }, []);

  const install = useCallback(async (update: Update) => {
    let total = 0, got = 0;
    setState({ s: "downloading", pct: 0 });
    try {
      await update.downloadAndInstall((ev) => {
        if (ev.event === "Started") total = ev.data.contentLength ?? 0;
        if (ev.event === "Progress") { got += ev.data.chunkLength; setState({ s: "downloading", pct: total ? Math.round((got / total) * 100) : 0 }); }
      });
      await relaunch();
    } catch (e) { setState({ s: "error", msg: e instanceof Error ? e.message : String(e) }); }
  }, []);

  return { state, checkNow, install };
}
