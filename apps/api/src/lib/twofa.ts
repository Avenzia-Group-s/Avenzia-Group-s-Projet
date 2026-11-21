import { createHmac, randomInt } from "node:crypto";
import { safeEqual } from "./crypto.js";

export const CODE_TTL_MS = 5 * 60_000;
export const MAX_ATTEMPTS = 5;
export const MAX_SENDS = 3;
export const RESEND_COOLDOWN_MS = 60_000;

export const generateCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

/** HMAC lié au flux : un hash fuité ne vaut rien ailleurs, et le code reste inutilisable sans le secret serveur. */
export const hashCode = (secret: string, state: string, code: string) =>
  createHmac("sha256", secret).update(`${state}:${code}`).digest("hex");

export const verifyCode = (secret: string, state: string, code: string, expectedHash: string) =>
  safeEqual(hashCode(secret, state, code), expectedHash);

export const dmMessage = (code: string) =>
  `🔐 **Code de connexion Avenzia : \`${code}\`**\nValable 5 minutes. Si vous n'êtes pas à l'origine de cette connexion, ignorez ce message et ne partagez jamais ce code : Avenzia ne vous le demandera jamais ailleurs que dans l'application.`;
