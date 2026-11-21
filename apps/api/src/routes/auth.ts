import type { FastifyInstance } from "fastify";
import { prisma } from "@avenzia/database";
import { AuthExchangeSchema, AuthStartSchema, computeGlobalRole } from "@avenzia/shared";
import { env } from "../env.js";
import { randomHex, randomToken, safeEqual, sha256B64Url, sha256Hex } from "../lib/crypto.js";
import { DiscordUnavailable, exchangeCode, fetchMe, fetchMyMember } from "../lib/discord.js";
import { audit, refreshRolesIfStale, roleCfg, toPublicUser } from "../lib/access.js";
import { CODE_TTL_MS, MAX_ATTEMPTS, MAX_SENDS, RESEND_COOLDOWN_MS, dmMessage, generateCode, hashCode, verifyCode } from "../lib/twofa.js";
import { sendDm } from "../lib/discord.js";
import { z } from "zod";

const VerifySchema = AuthExchangeSchema.extend({ code: z.string().regex(/^\d{6}$/) });

/** Charge un flux ET prouve que l'appelant est celui qui l'a démarré (PKCE). */
async function authedFlow(body: unknown) {
  const b = AuthExchangeSchema.safeParse(body);
  if (!b.success) return null;
  const flow = await prisma.authFlow.findUnique({ where: { state: b.data.state } });
  if (!flow || flow.expiresAt < new Date() || flow.consumedAt) return null;
  if (!safeEqual(sha256B64Url(b.data.codeVerifier), flow.codeChallenge)) return null;
  return flow;
}

const FLOW_TTL_MS = 10 * 60_000;
const page = (msg: string) =>
  `<!doctype html><meta charset="utf-8"><title>Avenzia</title><body style="font-family:system-ui;background:#1E1F22;color:#F2F3F5;display:grid;place-items:center;height:100vh;margin:0"><p>${msg}</p>`;

export async function authRoutes(app: FastifyInstance) {
  const strict = { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } };

  app.post("/auth/discord/start", strict, async (req, reply) => {
    const body = AuthStartSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "bad_request" });
    const state = randomHex(32);
    await prisma.authFlow.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await prisma.authFlow.create({ data: { state, codeChallenge: body.data.codeChallenge, expiresAt: new Date(Date.now() + FLOW_TTL_MS) } });
    const url = new URL("https://discord.com/oauth2/authorize");
    url.search = new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID, response_type: "code", scope: "identify guilds.members.read",
      redirect_uri: `${env.API_PUBLIC_URL}/auth/discord/callback`, state,
    }).toString();
    return { state, url: url.toString(), inviteUrl: env.DISCORD_INVITE_URL ?? null };
  });

  app.get("/auth/discord/callback", strict, async (req, reply) => {
    const q = req.query as { code?: string; state?: string; error?: string };
    reply.type("text/html");
    if (!q.state || !/^[a-f0-9]{64}$/.test(q.state)) return reply.code(400).send(page("Requête invalide."));
    const flow = await prisma.authFlow.findUnique({ where: { state: q.state } });
    if (!flow || flow.expiresAt < new Date() || flow.userId || flow.error) return reply.code(400).send(page("Connexion expirée. Retournez dans Avenzia et réessayez."));

    const fail = async (error: string, msg: string) => {
      await prisma.authFlow.update({ where: { state: flow.state }, data: { error } });
      return reply.send(page(msg));
    };
    if (q.error || !q.code) return fail("denied", "Autorisation refusée. Vous pouvez fermer cette fenêtre.");

    try {
      const token = await exchangeCode(q.code);
      const me = await fetchMe(token);
      if (!me.data) return fail("failed", "Connexion impossible.");
      const member = await fetchMyMember(token);
      if (member.status === 404 || member.status === 403 || !member.data) return fail("not_member", "Accès non autorisé. Vous pouvez fermer cette fenêtre.");

      const roles = member.data.roles;
      const user = await prisma.user.upsert({
        where: { discordId: me.data.id },
        create: { discordId: me.data.id, username: me.data.global_name ?? me.data.username, avatar: me.data.avatar, discordRoleIds: roles, globalRole: computeGlobalRole(roles, roleCfg()) },
        update: { username: me.data.global_name ?? me.data.username, avatar: me.data.avatar, discordRoleIds: roles, globalRole: computeGlobalRole(roles, roleCfg()), rolesCheckedAt: new Date() },
      });
      if (!env.TWO_FA_ENABLED) {
        await prisma.authFlow.update({ where: { state: flow.state }, data: { userId: user.id } });
        return reply.send(page("Connexion réussie. Vous pouvez fermer cette fenêtre et revenir dans Avenzia."));
      }
      // A2F : le code part en MP via le bot AVANT toute ouverture de session. Échec d'envoi = pas de connexion.
      const code = generateCode();
      const sent = await sendDm(user.discordId, dmMessage(code));
      if (sent === "closed") return fail("dm_closed", "Impossible de vous envoyer un message privé. Fermez cette fenêtre et lisez le message dans Avenzia.");
      if (sent === "unavailable") return fail("unavailable", "Connexion impossible pour le moment.");
      await prisma.authFlow.update({ where: { state: flow.state }, data: {
        pendingUserId: user.id, codeHash: hashCode(env.INTERNAL_API_SECRET, flow.state, code),
        codeExpiresAt: new Date(Date.now() + CODE_TTL_MS), sends: 1, lastSentAt: new Date(), attempts: 0,
      } });
      await audit(user.id, "auth.2fa.sent", user.id);
      return reply.send(page("Étape 1 validée. Un code vous a été envoyé en message privé sur Discord. Retournez dans Avenzia pour le saisir."));
    } catch (e) {
      req.log.warn({ err: e instanceof Error ? e.message : "unknown" }, "oauth callback failed");
      return fail(e instanceof DiscordUnavailable ? "unavailable" : "failed", "Connexion impossible pour le moment.");
    }
  });

  // L'app desktop interroge ici avec le code_verifier PKCE : seul celui qui a lancé le flux obtient la session.
  app.post("/auth/discord/exchange", { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } }, async (req, reply) => {
    const body = AuthExchangeSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "bad_request" });
    const flow = await prisma.authFlow.findUnique({ where: { state: body.data.state } });
    if (!flow || flow.expiresAt < new Date() || flow.consumedAt) return reply.code(400).send({ error: "expired" });
    if (!safeEqual(sha256B64Url(body.data.codeVerifier), flow.codeChallenge)) return reply.code(400).send({ error: "bad_verifier" });
    if (flow.error) { await prisma.authFlow.delete({ where: { state: flow.state } }); return { status: "error", error: flow.error }; }
    if (!flow.userId) {
      if (!flow.pendingUserId) return { status: "pending" };
      const nextResend = Math.max(0, (flow.lastSentAt?.getTime() ?? 0) + RESEND_COOLDOWN_MS - Date.now());
      return { status: "2fa_required", resendInMs: nextResend, canResend: flow.sends < MAX_SENDS };
    }

    const claimed = await prisma.authFlow.updateMany({ where: { state: flow.state, consumedAt: null }, data: { consumedAt: new Date() } });
    if (claimed.count !== 1) return reply.code(400).send({ error: "expired" });

    const token = randomToken(32);
    await prisma.session.create({ data: { tokenHash: sha256Hex(token), userId: flow.userId, expiresAt: new Date(Date.now() + env.SESSION_TTL_DAYS * 86_400_000) } });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: flow.userId } });
    await audit(user.id, "auth.login", user.id);
    return { status: "ok", token, user: toPublicUser(user) };
  });

  app.post("/auth/2fa/verify", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req, reply) => {
    const b = VerifySchema.safeParse(req.body);
    const flow = b.success ? await authedFlow(b.data) : null;
    if (!b.success || !flow || !flow.pendingUserId || flow.userId || flow.error || !flow.codeHash) return reply.code(400).send({ error: "invalid_request" });
    if (!flow.codeExpiresAt || flow.codeExpiresAt < new Date()) return reply.code(400).send({ error: "code_expired" });

    // Compteur atomique AVANT la comparaison : pas de brute-force par requêtes parallèles.
    const slot = await prisma.authFlow.updateMany({ where: { state: flow.state, userId: null, error: null, attempts: { lt: MAX_ATTEMPTS } }, data: { attempts: { increment: 1 } } });
    if (slot.count !== 1) {
      await prisma.authFlow.update({ where: { state: flow.state }, data: { error: "too_many_attempts" } });
      await audit(flow.pendingUserId, "auth.2fa.locked", flow.pendingUserId);
      return reply.code(429).send({ error: "too_many_attempts" });
    }
    if (!verifyCode(env.INTERNAL_API_SECRET, flow.state, b.data.code, flow.codeHash)) {
      const remaining = MAX_ATTEMPTS - (flow.attempts + 1);
      await audit(flow.pendingUserId, "auth.2fa.failed", flow.pendingUserId);
      if (remaining <= 0) { await prisma.authFlow.update({ where: { state: flow.state }, data: { error: "too_many_attempts" } }); return reply.code(429).send({ error: "too_many_attempts" }); }
      return reply.code(401).send({ error: "invalid_code", remaining });
    }
    // Code à usage unique : on l'efface, puis la session sera délivrée par /auth/discord/exchange.
    const ok = await prisma.authFlow.updateMany({ where: { state: flow.state, userId: null }, data: { userId: flow.pendingUserId, codeHash: null } });
    return ok.count === 1 ? { ok: true } : reply.code(400).send({ error: "invalid_request" });
  });

  app.post("/auth/2fa/resend", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, reply) => {
    const flow = await authedFlow(req.body);
    if (!flow || !flow.pendingUserId || flow.userId || flow.error) return reply.code(400).send({ error: "invalid_request" });
    if (flow.sends >= MAX_SENDS) return reply.code(429).send({ error: "too_many_sends" });
    if (flow.lastSentAt && Date.now() - flow.lastSentAt.getTime() < RESEND_COOLDOWN_MS) return reply.code(429).send({ error: "cooldown" });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: flow.pendingUserId } });
    const code = generateCode();
    const sent = await sendDm(user.discordId, dmMessage(code));
    if (sent !== "ok") return reply.code(502).send({ error: sent === "closed" ? "dm_closed" : "unavailable" });
    await prisma.authFlow.update({ where: { state: flow.state }, data: {
      codeHash: hashCode(env.INTERNAL_API_SECRET, flow.state, code), codeExpiresAt: new Date(Date.now() + CODE_TTL_MS),
      sends: { increment: 1 }, lastSentAt: new Date(), attempts: 0,
    } });
    await audit(user.id, "auth.2fa.resent", user.id);
    return { ok: true, resendInMs: RESEND_COOLDOWN_MS };
  });

  app.get("/auth/session", { preHandler: app.requireAuth }, async (req) => {
    const u = await refreshRolesIfStale(req.user!);
    return { user: toPublicUser(u) };
  });

  app.post("/auth/logout", { preHandler: app.requireAuth }, async (req) => {
    await prisma.session.update({ where: { id: req.sessionId! }, data: { revokedAt: new Date() } });
    return { ok: true };
  });
}
