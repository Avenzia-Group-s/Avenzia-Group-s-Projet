import { z } from "zod";

export const GLOBAL_ROLES = ["FOUNDER", "CO_FOUNDER", "STAFF", "MEMBER"] as const;
export type GlobalRole = (typeof GLOBAL_ROLES)[number];

export const PROJECT_ROLES = ["MANAGER", "CONTRIBUTOR", "READER"] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const PERMISSIONS = [
  "project.view", "project.settings", "project.members",
  "task.create", "task.edit", "task.delete",
  "note.create", "note.edit", "note.delete_own",
  "docs.manage", "spec.edit", "spec.validate",
  "event.create", "announce.publish",
  "channel.manage", "message.send", "message.moderate",
  "mention.here", "mention.everyone",
  "idea.create", "idea.moderate", "export.data",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

// Refus par défaut : tout ce qui n'est pas listé est interdit.
const ROLE_PERMISSIONS: Record<ProjectRole, readonly Permission[]> = {
  MANAGER: PERMISSIONS,
  CONTRIBUTOR: [
    "project.view", "task.create", "task.edit", "note.create", "note.edit",
    "note.delete_own", "event.create", "message.send", "idea.create", "export.data",
  ],
  READER: ["project.view"],
};

export function hasProjectPermission(role: ProjectRole | null | undefined, perm: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
}

export const canCreateProject = (r: GlobalRole) => r === "FOUNDER" || r === "CO_FOUNDER";
export const canInitiateDmWithoutRequest = (r: GlobalRole) => r !== "MEMBER";
export const isAdminRole = canCreateProject;

export function computeGlobalRole(
  roleIds: readonly string[],
  cfg: { founder?: string; coFounder?: string; staff?: string },
): GlobalRole {
  const has = (id?: string) => !!id && roleIds.includes(id);
  if (has(cfg.founder)) return "FOUNDER";
  if (has(cfg.coFounder)) return "CO_FOUNDER";
  if (has(cfg.staff)) return "STAFF";
  return "MEMBER";
}

/** Un projet est accessible UNIQUEMENT via un rôle Discord mappé. Aucun passe-droit (Staff inclus). */
export function hasProjectAccess(userRoleIds: readonly string[], mappedRoleIds: readonly string[]): boolean {
  return mappedRoleIds.some((r) => userRoleIds.includes(r));
}

// ---------- Schémas ----------
const snowflake = z.string().regex(/^\d{15,25}$/);
const b64url = z.string().regex(/^[A-Za-z0-9_-]{43,128}$/);

export const AuthStartSchema = z.object({ codeChallenge: b64url });
export const AuthExchangeSchema = z.object({ state: z.string().length(64), codeVerifier: b64url });

export const CreateProjectSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(500).default(""),
  icon: z.string().max(32).default("folder"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#5865F2"),
  discordRoleId: snowflake,
});

export const InternalMemberRolesSchema = z.object({ discordId: snowflake, roleIds: z.array(snowflake).max(250) });
export const InternalMemberLeftSchema = z.object({ discordId: snowflake });
export const InternalBulkSyncSchema = z.object({
  members: z.array(InternalMemberRolesSchema).max(5000),
});

export interface PublicUser {
  id: string; discordId: string; username: string; avatarUrl: string | null; globalRole: GlobalRole;
}
export interface PublicProject {
  id: string; name: string; description: string; icon: string; color: string; status: string; myRole: ProjectRole;
}
