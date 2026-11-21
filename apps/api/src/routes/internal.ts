import type { FastifyInstance } from "fastify";
import { prisma } from "@avenzia/database";
import { InternalBulkSyncSchema, InternalMemberLeftSchema, InternalMemberRolesSchema } from "@avenzia/shared";
import { env } from "../env.js";
import { safeEqual } from "../lib/crypto.js";
import { applyRoles, audit } from "../lib/access.js";

/** Routes réservées au bot, protégées par un secret partagé (jamais présent dans le client desktop). */
export async function internalRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (req, reply) => {
    const h = req.headers["x-internal-secret"];
    if (typeof h !== "string" || !safeEqual(h, env.INTERNAL_API_SECRET)) return reply.code(401).send({ error: "unauthorized" });
  });

  app.post("/internal/member-roles", async (req, reply) => {
    const b = InternalMemberRolesSchema.safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: "bad_request" });
    await applyRoles(b.data.discordId, b.data.roleIds);
    return { ok: true };
  });

  app.post("/internal/member-left", async (req, reply) => {
    const b = InternalMemberLeftSchema.safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: "bad_request" });
    await applyRoles(b.data.discordId, []);
    const u = await prisma.user.findUnique({ where: { discordId: b.data.discordId } });
    if (u) await prisma.session.updateMany({ where: { userId: u.id, revokedAt: null }, data: { revokedAt: new Date() } });
    return { ok: true };
  });

  app.post("/internal/sync", async (req, reply) => {
    const b = InternalBulkSyncSchema.safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: "bad_request" });
    for (const m of b.data.members) await applyRoles(m.discordId, m.roleIds);
    await audit(null, "discord.sync", undefined, { members: b.data.members.length });
    return { ok: true, count: b.data.members.length };
  });

  app.get("/internal/user/:discordId/projects", async (req) => {
    const { discordId } = req.params as { discordId: string };
    const u = await prisma.user.findUnique({ where: { discordId } });
    if (!u) return { projects: [] };
    const projects = await prisma.project.findMany({
      where: { status: { not: "ARCHIVED" }, mappings: { some: { discordRoleId: { in: u.discordRoleIds } } } },
      select: { name: true, status: true },
    });
    return { projects };
  });
}
