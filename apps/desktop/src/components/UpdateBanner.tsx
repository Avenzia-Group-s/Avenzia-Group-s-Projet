import { useEffect } from "react";
import { Download } from "lucide-react";
import { useUpdaterCtx } from "../hooks/UpdaterProvider";

export function UpdateBanner() {
  const u = useUpdaterCtx();
  useEffect(() => { void u.checkNow(); }, []); // vérification au démarrage
  const s = u.state;
  if (s.s === "available") return (
    <div className="flex items-center justify-between bg-accent px-4 py-2 text-sm text-white">
      <span>Version {s.update.version} disponible.</span>
      <button onClick={() => u.install(s.update)} className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 font-semibold hover:bg-white/30"><Download size={14} />Mettre à jour</button>
    </div>
  );
  if (s.s === "downloading") return <div className="bg-accent px-4 py-2 text-sm text-white">Téléchargement… {s.pct}%</div>;
  return null;
}
