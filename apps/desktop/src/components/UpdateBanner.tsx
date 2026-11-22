import { Download, RefreshCw } from "lucide-react";
import { useUpdaterCtx } from "../hooks/UpdaterProvider";

export function UpdateBanner() {
  const updater = useUpdaterCtx();
  const state = updater.state;
  if (state.s === "available") return (
    <div role="status" className="flex shrink-0 items-center justify-between gap-4 bg-accent px-4 py-2 text-sm text-white">
      <span>Version {state.version} disponible.</span>
      <button onClick={() => updater.install()} className="flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 font-semibold hover:bg-white/30">
        <Download size={14} />Mettre à jour
      </button>
    </div>
  );
  if (state.s === "downloading" || state.s === "installing" || state.s === "restarting") return (
    <div role="status" className="shrink-0 bg-accent px-4 py-2 text-sm text-white">
      {state.s === "downloading" && (state.pct === null ? "Téléchargement de la mise à jour…" : "Téléchargement de la mise à jour " + state.pct + " %")}
      {state.s === "installing" && "Installation de la mise à jour…"}
      {state.s === "restarting" && "Redémarrage d’Avenzia…"}
    </div>
  );
  if (state.s === "error") return (
    <div role="status" className="flex shrink-0 items-center justify-between gap-4 border-b border-line bg-surface px-4 py-2 text-sm text-muted">
      <span>{state.msg}</span>
      <button onClick={() => state.restartRequired ? updater.restart() : state.retryInstall ? updater.install() : updater.checkNow()} className="flex shrink-0 items-center gap-2 rounded-full px-3 py-1 text-txt hover:bg-surface2">
        <RefreshCw size={14} />{state.restartRequired ? "Redémarrer Avenzia" : "Réessayer"}
      </button>
    </div>
  );
  return null;
}
