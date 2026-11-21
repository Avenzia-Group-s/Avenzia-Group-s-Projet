import { prisma } from "@avenzia/database";
import { computeGlobalRole, type PublicUser } from "@avenzia/shared";
import { env } from "../env.js";
import { avatarUrl, fetchMemberAsBot } from "./discord.js";

export const roleCfg = () => ({ founder: env.ROLE_FOUNDER_ID, coFounder: env.ROLE_COFOUNDER_ID, staff: env.ROLE_STAFF_ID });

export async function applyRoles(discordId: string, roleIds: string[]) {
  return prisma.user.updateMany({
    where: { discordId },
    data: { discordRoleIds: roleIds, globalRole: computeGlobalRole(roleIds, roleCfg()), rolesCheckedAt: new Date() },
  });
}

/** Vérification de secours : si le bot a raté un événement, on relit Discord. En cas d'échec, on ne donne AUCUN nouvel accès. */
const STALE_MS = 15 * 60_000;
export async function refreshRolesIfStale<U extends { id: string; discordId: string; rolesCheckedAt: Date; discordRoleIds: string[] }>(u: U) {
  if (Date.now() - u.rolesCheckedAt.getTime() < STALE_MS) return u;
  const m = await fetchMemberAsBot(u.discordId);
  if (m === null) return u; // conservateur : on garde l'état connu
  const roles = m === "absent" ? [] : m.roles;
  await applyRoles(u.discordId, roles);
  return prisma.user.findUniqueOrThrow({ where: { id: u.id } }) as unknown as U;
}

export const toPublicUser = (u: { id: string; discordId: string; username: string; avatar: string | null; globalRole: PublicUser["globalRole"] }): PublicUser => ({
  id: u.id, discordId: u.discordId, username: u.username,
  avatarUrl: avatarUrl(u.discordId, u.avatar), globalRole: u.globalRole,
});

export async function audit(actorId: string | null, action: string, target?: string, meta?: object) {
  await prisma.auditLog.create({ data: { actorId, action, target, meta: meta as never } });
}
