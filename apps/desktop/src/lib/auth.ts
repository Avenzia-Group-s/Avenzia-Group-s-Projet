import { openUrl } from "@tauri-apps/plugin-opener";
import { api, ApiError } from "./api";
import { inTauri } from "./config";
import { createPkcePair } from "./pkce";
import { saveToken, loadToken, clearToken } from "./secureStore";
import { useApp } from "./store";
import type { PublicProject, PublicUser } from "@avenzia/shared";

export type LoginFailure = "denied" | "dm_closed" | "too_many_attempts" | "not_member" | "failed" | "unavailable" | "timeout" | "network" | "cancelled";
export class LoginError extends Error { constructor(public reason: LoginFailure, public inviteUrl?: string | null) { super(reason); } }

const sleep = (ms: number, s: AbortSignal) => new Promise<void>((res, rej) => {
  const t = setTimeout(res, ms); s.addEventListener("abort", () => { clearTimeout(t); rej(new LoginError("cancelled")); }, { once: true });
});

let flowCtx: { state: string; verifier: string } | null = null;
export interface LoginHooks { onTwoFactor: (info: { resendInMs: number; canResend: boolean }) => void }

export async function loginWithDiscord(signal: AbortSignal, hooks: LoginHooks) {
  const { verifier, challenge } = await createPkcePair();
  let start: { state: string; url: string; inviteUrl: string | null };
  try { start = await api("/auth/discord/start", { method: "POST", body: JSON.stringify({ codeChallenge: challenge }), token: "" }); }
  catch { throw new LoginError("network"); }
  flowCtx = { state: start.state, verifier };

  try {
    if (inTauri) await openUrl(start.url); else window.open(start.url, "_blank");

    let notified = false;
    const deadline = Date.now() + 10 * 60_000;
    while (Date.now() < deadline) {
      await sleep(2000, signal);
      const r = await api<{ status: "pending" | "2fa_required" | "error" | "ok"; error?: string; token?: string; user?: PublicUser; resendInMs?: number; canResend?: boolean }>(
        "/auth/discord/exchange", { method: "POST", token: "", body: JSON.stringify({ state: start.state, codeVerifier: verifier }) },
      ).catch((e) => { if (e instanceof ApiError && e.status === 400) throw new LoginError("timeout"); return null; });
      if (!r || r.status === "pending") continue;
      if (r.status === "2fa_required") {
        if (!notified) { notified = true; hooks.onTwoFactor({ resendInMs: r.resendInMs ?? 0, canResend: r.canResend ?? true }); }
        continue;
      }
      if (r.status === "error") throw new LoginError((r.error as LoginFailure) ?? "failed", start.inviteUrl);
      await saveToken(r.token!);
      useApp.getState().set({ token: r.token!, user: r.user! });
      await refreshProjects();
      return;
    }
    throw new LoginError("timeout");
  } finally { flowCtx = null; }
}

const ctx = () => { if (!flowCtx) throw new ApiError(400, "invalid_request"); return { state: flowCtx.state, codeVerifier: flowCtx.verifier }; };
export const verifyTwoFactor = (code: string) => api<{ ok: true }>("/auth/2fa/verify", { method: "POST", token: "", body: JSON.stringify({ ...ctx(), code }) });
export const resendTwoFactor = () => api<{ ok: true; resendInMs: number }>("/auth/2fa/resend", { method: "POST", token: "", body: JSON.stringify(ctx()) });

export async function refreshProjects() {
  const { projects } = await api<{ projects: PublicProject[] }>("/projects");
  useApp.getState().set({ projects });
}

/** Au démarrage : session valide => on entre directement. Retourne true si connecté. */
export async function restoreSession(): Promise<boolean> {
  const token = await loadToken();
  if (!token) return false;
  try {
    const { user } = await api<{ user: PublicUser }>("/auth/session", { token });
    useApp.getState().set({ token, user });
    await refreshProjects();
    return true;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) await clearToken();
    return false;
  }
}

export async function logout() {
  await api("/auth/logout", { method: "POST" }).catch(() => {});
  await clearToken();
  useApp.getState().set({ token: null, user: null, projects: [], currentSpace: "home", currentModule: "dashboard" });
}
