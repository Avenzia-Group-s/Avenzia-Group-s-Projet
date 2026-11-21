import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { LoginError, loginWithDiscord, type LoginFailure } from "../lib/auth";
import { TwoFactorStep } from "./TwoFactorStep";

const MESSAGES: Record<LoginFailure, string> = {
  denied: "Vous avez refusé l'autorisation. Réessayez pour continuer.",
  dm_closed: "Impossible de vous envoyer le code : autorisez les messages privés des membres du serveur Avenzia (Discord > Confidentialité du serveur), puis réessayez.",
  too_many_attempts: "Trop de codes incorrects. Recommencez la connexion.",
  not_member: "",
  failed: "La connexion a échoué. Réessayez.",
  unavailable: "Discord est momentanément indisponible. Réessayez dans quelques minutes.",
  timeout: "La connexion a expiré. Réessayez.",
  network: "Impossible de joindre le serveur Avenzia. Vérifiez votre connexion.",
  cancelled: "",
};

const DiscordGlyph = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.2.5a18 18 0 0 0-6.4 0L8.6 3a19.7 19.7 0 0 0-4.9 1.5C.6 9 0 13.5.3 17.9a19.9 19.9 0 0 0 6 3l.5-.7a13 13 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l.5.7a19.8 19.8 0 0 0 6-3c.4-5.100-.7-9.600-3.200-13.500ZM8.500 15.300c-1 0-1.800-.9-1.800-2s.8-2 1.800-2 1.800.9 1.800 2-.8 2-1.800 2Zm7 0c-1 0-1.800-.9-1.800-2s.8-2 1.800-2 1.800.9 1.800 2-.8 2-1.800 2Z" /></svg>
);

export function LoginModal() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<LoginError | null>(null);
  const abort = useRef<AbortController | null>(null);
  const [twoFa, setTwoFa] = useState<{ resendInMs: number; canResend: boolean } | null>(null);

  const start = async () => {
    setErr(null); setTwoFa(null); setBusy(true);
    abort.current = new AbortController();
    try { await loginWithDiscord(abort.current.signal, { onTwoFactor: setTwoFa }); }
    catch (e) { if (!(e instanceof LoginError && e.reason === "cancelled")) setErr(e instanceof LoginError ? e : new LoginError("failed")); }
    finally { setBusy(false); setTwoFa(null); }
  };

  const notMember = err?.reason === "not_member";
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="login-title" className="pop relative w-[420px] max-w-[92vw] rounded-3xl border border-line bg-surface p-8 text-center shadow-2xl">
      {twoFa ? (
        <TwoFactorStep initialResendMs={twoFa.resendInMs} canResend={twoFa.canResend} onCancel={() => abort.current?.abort()} />
      ) : notMember ? (
        <>
          <h2 id="login-title" className="text-xl font-bold">Accès non autorisé</h2>
          <p className="mt-2 text-sm text-muted">Vous devez être membre du serveur Discord Avenzia pour accéder à cette application.</p>
          {err?.inviteUrl && <a href={err.inviteUrl} target="_blank" rel="noreferrer" className="mt-5 inline-block rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white">Rejoindre le serveur</a>}
          <button onClick={() => setErr(null)} className="mt-4 block w-full text-sm text-muted hover:text-txt">Retour</button>
        </>
      ) : (
        <>
          <h2 id="login-title" className="text-xl font-bold">Bienvenue sur Avenzia !</h2>
          <p className="mt-2 text-sm text-muted">Veuillez vous connecter avec l'application Discord pour accéder à votre espace de travail.</p>
          {err && MESSAGES[err.reason] && <p role="alert" className="mt-4 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{MESSAGES[err.reason]}</p>}
          <button onClick={start} disabled={busy} className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 font-semibold text-white transition hover:brightness-110 disabled:opacity-70">
            {busy ? <Loader2 className="animate-spin" size={20} /> : <DiscordGlyph />}
            {busy ? "En attente de Discord…" : "Se connecter avec Discord"}
          </button>
          {busy && <button onClick={() => abort.current?.abort()} className="mt-3 text-sm text-muted hover:text-txt">Annuler</button>}
          <p className="mt-4 text-xs italic text-muted">Une connexion Discord est nécessaire pour accéder à Avenzia.</p>
        </>
      )}
    </div>
  );
}
