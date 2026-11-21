import { invoke } from "@tauri-apps/api/core";
import { inTauri } from "./config";

// En production le jeton est dans le coffre du système (Windows Credential Manager) via Rust.
// Le repli localStorage n'existe qu'en dev navigateur.
export async function saveToken(t: string) { if (inTauri) await invoke("store_token", { token: t }); else if (import.meta.env.DEV) localStorage.setItem("dev_token", t); }
export async function loadToken(): Promise<string | null> {
  if (inTauri) return (await invoke<string | null>("get_token")) ?? null;
  return import.meta.env.DEV ? localStorage.getItem("dev_token") : null;
}
export async function clearToken() { if (inTauri) await invoke("clear_token"); else localStorage.removeItem("dev_token"); }
