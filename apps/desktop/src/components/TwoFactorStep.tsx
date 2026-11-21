import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { ApiError } from "../lib/api";
import { resendTwoFactor, verifyTwoFactor } from "../lib/auth";

interface Props { initialResendMs: number; canResend: boolean; onCancel: () => void }

export function TwoFactorStep({ initialResendMs, canResend, onCancel }: Props) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "err" | "info"; text: string } | null>(null);
  const [cooldown, setCooldown] = useState(Math.ceil(initialResendMs / 1000));
  const [resendOk, setResendOk] = useState(canResend);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const submit = async () => {
    if (code.length !== 6 || busy) return;
    setBusy(true); setMsg(null);
    try { await verifyTwoFactor(code); setMsg({ kind: "info", text: "Code validé, ouverture de votre espace…" }); }
    catch (e) {
      setBusy(false); setCode(""); input.current?.focus();
      if (!(e instanceof ApiError)) return setMsg({ kind: "err", text: "Impossible de joindre le serveur Avenzia." });
      if (e.code === "invalid_code") setMsg({ kind: "err", text: `Code incorrect. Il vous reste ${e.data.remaining ?? "quelques"} essai(s).` });
      else if (e.code === "code_expired") setMsg({ kind: "err", text: "Ce code a expiré. Demandez-en un nouveau." });
      else setMsg({ kind: "err", text: "Vérification impossible. Réessayez." });
    }
    // En cas de succès, la boucle de connexion reçoit la session au prochain cycle : la modale disparaît d'elle-même.
  };

  const resend = async () => {
    setMsg(null);
    try {
      const r = await resendTwoFactor();
      setCooldown(Math.ceil(r.resendInMs / 1000)); setMsg({ kind: "info", text: "Un nouveau code vient d'être envoyé." });
    } catch (e) {
      if (e instanceof ApiError && e.code === "too_many_sends") { setResendOk(false); setMsg({ kind: "err", text: "Nombre maximal de codes atteint. Recommencez la connexion." }); }
      else if (e instanceof ApiError && e.code === "dm_closed") setMsg({ kind: "err", text: "Vos messages privés sont fermés : autorisez-les puis recommencez." });
      else setMsg({ kind: "err", text: "Envoi impossible pour le moment." });
    }
  };

  return (
    <>
      <h2 id="login-title" className="text-xl font-bold">Vérification en deux étapes</h2>
      <p className="mt-2 text-sm text-muted">Avenzia Bot vient de vous envoyer un code à 6 chiffres en message privé sur Discord.</p>
      <input ref={input} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(e) => e.key === "Enter" && submit()}
        inputMode="numeric" autoComplete="one-time-code" maxLength={6} aria-label="Code à 6 chiffres" placeholder="000000"
        className="mt-5 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-center text-2xl font-semibold tracking-[0.5em] outline-none focus:border-accent" />
      {msg && <p role={msg.kind === "err" ? "alert" : "status"} className={`mt-3 rounded-xl px-3 py-2 text-sm ${msg.kind === "err" ? "bg-danger/10 text-danger" : "bg-ok/10 text-ok"}`}>{msg.text}</p>}
      <button onClick={submit} disabled={code.length !== 6 || busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 font-semibold text-white transition hover:brightness-110 disabled:opacity-60">
        {busy && <Loader2 className="animate-spin" size={18} />}Valider le code
      </button>
      <div className="mt-3 flex justify-between text-sm">
        <button onClick={resend} disabled={cooldown > 0 || !resendOk} className="text-accent disabled:text-muted">{cooldown > 0 ? `Renvoyer le code (${cooldown} s)` : "Renvoyer le code"}</button>
        <button onClick={onCancel} className="text-muted hover:text-txt">Annuler</button>
      </div>
      <p className="mt-4 text-xs text-muted">Le code est valable 5 minutes. Vous ne recevez rien ? Vérifiez que les messages privés des membres du serveur Avenzia sont autorisés.</p>
    </>
  );
}
