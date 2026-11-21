import { env } from "../env.js";

const API = "https://discord.com/api/v10";

export class DiscordUnavailable extends Error {}

export interface DiscordUser { id: string; username: string; global_name?: string | null; avatar: string | null }
export interface GuildMember { roles: string[] }

export async function exchangeCode(code: string): Promise<string> {
  const res = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code", code, redirect_uri: `${env.API_PUBLIC_URL}/auth/discord/callback`,
    }),
  });
  if (res.status >= 500) throw new DiscordUnavailable();
  if (!res.ok) throw new Error("oauth_exchange_failed");
  return ((await res.json()) as { access_token: string }).access_token;
}

async function get<T>(path: string, auth: string): Promise<{ status: number; data?: T }> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: auth } });
  if (res.status >= 500 || res.status === 429) throw new DiscordUnavailable();
  return { status: res.status, data: res.ok ? ((await res.json()) as T) : undefined };
}

export const fetchMe = (token: string) => get<DiscordUser>("/users/@me", `Bearer ${token}`);
export const fetchMyMember = (token: string) =>
  get<GuildMember>(`/users/@me/guilds/${env.DISCORD_GUILD_ID}/member`, `Bearer ${token}`);

/** Vérification de secours via le token du bot. null = indisponible/non configuré. */
export async function fetchMemberAsBot(discordId: string): Promise<GuildMember | "absent" | null> {
  if (!env.DISCORD_BOT_TOKEN) return null;
  try {
    const r = await get<GuildMember>(`/guilds/${env.DISCORD_GUILD_ID}/members/${discordId}`, `Bot ${env.DISCORD_BOT_TOKEN}`);
    if (r.status === 404) return "absent";
    return r.data ?? null;
  } catch { return null; }
}

export const avatarUrl = (id: string, hash: string | null) =>
  hash ? `https://cdn.discordapp.com/avatars/${id}/${hash}.png?size=128` : null;

/** Envoie un MP via le bot. "closed" = l'utilisateur refuse les MP des membres du serveur. */
export async function sendDm(discordId: string, content: string): Promise<"ok" | "closed" | "unavailable"> {
  if (!env.DISCORD_BOT_TOKEN) return "unavailable";
  const headers = { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" };
  try {
    const ch = await fetch(`${API}/users/@me/channels`, { method: "POST", headers, body: JSON.stringify({ recipient_id: discordId }) });
    if (ch.status === 403) return "closed";
    if (!ch.ok) return "unavailable";
    const { id } = (await ch.json()) as { id: string };
    const msg = await fetch(`${API}/channels/${id}/messages`, { method: "POST", headers, body: JSON.stringify({ content, allowed_mentions: { parse: [] } }) });
    if (msg.ok) return "ok";
    const body = (await msg.json().catch(() => ({}))) as { code?: number };
    return msg.status === 403 || body.code === 50007 ? "closed" : "unavailable";
  } catch { return "unavailable"; }
}
