import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState } from "react";
import { logout } from "../lib/auth";
import { inTauri } from "../lib/config";
import { useApp, type ThemeMode } from "../lib/store";
import { useUpdaterCtx } from "../hooks/UpdaterProvider";

const ACCENTS = ["#5865F2", "#9B59B6", "#1ABC9C", "#E67E22", "#E91E63", "#3498DB"];
const card = "rounded-2xl border border-line bg-surface p-5";

export function SettingsPage() {
  const { user, theme, accent, reduceMotion, menuCollapsed, setPref } = useApp();
  const up = useUpdaterCtx();
  const [version, setVersion] = useState("dev");
  useEffect(() => { if (inTauri) getVersion().then(setVersion); }, []);
  const modes: [ThemeMode, string][] = [["dark", "Sombre"], ["light", "Clair"], ["system", "Automatique"]];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold">Paramètres</h1>

      <section className={card}>
        <h2 className="font-semibold">Compte</h2>
        <p className="mt-2 text-sm">{user?.username} <span className="text-muted">· Discord {user?.discordId}</span></p>
        <p className="text-sm text-muted">Rôle global : {user?.globalRole}</p>
        <button onClick={logout} className="mt-3 rounded-full bg-danger px-4 py-2 text-sm font-semibold text-white">Se déconnecter</button>
      </section>

      <section className={card}>
        <h2 className="font-semibold">Apparence</h2>
        <div className="mt-3 flex gap-2" role="radiogroup" aria-label="Thème">
          {modes.map(([m, l]) => <button key={m} role="radio" aria-checked={theme === m} onClick={() => setPref("theme", m)} className={`rounded-full px-4 py-2 text-sm ${theme === m ? "bg-accent text-white" : "bg-surface2 text-muted hover:text-txt"}`}>{l}</button>)}
        </div>
        <div className="mt-4 flex gap-2">
          {ACCENTS.map((c) => <button key={c} aria-label={`Accent ${c}`} onClick={() => setPref("accent", c)} className={`h-8 w-8 rounded-full ${accent === c ? "ring-2 ring-txt ring-offset-2 ring-offset-surface" : ""}`} style={{ background: c }} />)}
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={menuCollapsed} onChange={(e) => setPref("menuCollapsed", e.target.checked)} />Menu latéral réduit</label>
        <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={reduceMotion} onChange={(e) => setPref("reduceMotion", e.target.checked)} />Animations réduites</label>
      </section>

      <section className={card}>
        <h2 className="font-semibold">Mises à jour</h2>
        <p className="mt-2 text-sm text-muted">Version installée : {version}</p>
        <button
          onClick={() => up.state.s === "error" && up.state.restartRequired ? up.restart() : up.state.s === "available" || (up.state.s === "error" && up.state.retryInstall) ? up.install() : up.checkNow()}
          disabled={["checking", "downloading", "installing", "restarting", "unsupported"].includes(up.state.s)}
          className="mt-3 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {up.state.s === "error" && up.state.restartRequired ? "Redémarrer Avenzia" : up.state.s === "available" ? "Installer la version " + up.state.version : up.state.s === "error" && up.state.retryInstall ? "Réessayer l’installation" : "Rechercher des mises à jour"}
        </button>
        <p className="mt-2 text-sm text-muted" role="status">
          {up.state.s === "checking" && "Recherche en cours…"}
          {up.state.s === "none" && "Vous êtes à jour."}
          {up.state.s === "unsupported" && "Les mises à jour s’installent depuis l’application desktop."}
          {up.state.s === "error" && up.state.msg}
          {up.state.s === "downloading" && (up.state.pct === null ? "Téléchargement en cours…" : "Téléchargement " + up.state.pct + " %")}
          {up.state.s === "installing" && "Installation en cours…"}
          {up.state.s === "restarting" && "Redémarrage en cours…"}
        </p>
        {up.state.s === "available" && up.state.notes && <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-muted">{up.state.notes}</pre>}
        {up.state.s === "error" && up.state.retryInstall && <button onClick={() => up.checkNow()} className="mt-2 text-sm text-accent">Rechercher une autre version</button>}
      </section>
    </div>
  );
}
