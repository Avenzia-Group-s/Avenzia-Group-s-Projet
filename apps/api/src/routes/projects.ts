import type { FastifyInstance } from "fastify";
import { prisma, type Project, type ProjectMembership, type User } from "@avenzia/database";
import { CreateProjectSchema, canCreateProject, type PublicProject } from "@avenzia/shared";
import { audit, refreshRolesIfStale } from "../lib/access.js";

const toPublic = (p: Project & { memberships: ProjectMembership[] }): PublicProject => ({
  id: p.id, name: p.name, description: p.description, icon: p.icon, color: p.color, status: p.status,
  myRole: p.memberships[0]?.projectRole ?? "READER", // moindre privilège par défaut
});

export async function projectRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.requireAuth);

  // L'accès est calculé côté serveur, à chaque requête, depuis les rôles Discord mappés.
  const accessible = async (user: User) => {
    const u = await refreshRolesIfStale(user);
    return { roles: u.discordRoleIds, userId: u.id };
  };

  app.get("/projects", async (req) => {
    const { roles, userId } = await accessible(req.user!);
    const projects = await prisma.project.findMany({
      where: { status: { not: "ARCHIVED" }, mappings: { some: { discordRoleId: { in: roles } } } },
      include: { memberships: { where: { userId } } },
      orderBy: { createdAt: "asc" },
    });
    return { projects: projects.map(toPublic) };
  });

  app.get("/projects/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { roles, userId } = await accessible(req.user!);
    const p = await prisma.project.findFirst({
      where: { id, mappings: { some: { discordRoleId: { in: roles } } } },
      include: { memberships: { where: { userId } } },
    });
    if (!p) return reply.code(404).send({ error: "not_found" }); // même réponse que "n'existe pas"
    return { project: toPublic(p) };
  });

  app.post("/projects", async (req, reply) => {
    const user = req.user!;
    if (!canCreateProject(user.globalRole)) return reply.code(403).send({ error: "forbidden" });
    const body = CreateProjectSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "bad_request", details: body.error.flatten().fieldErrors });
    const taken = await prisma.discordRoleMapping.findUnique({ where: { discordRoleId: body.data.discordRoleId } });
    if (taken) return reply.code(409).send({ error: "role_already_mapped" });
    const { discordRoleId, ...data } = body.data;
    const project = await prisma.project.create({
      data: { ...data, createdById: user.id, mappings: { create: { discordRoleId } }, memberships: { create: { userId: user.id, projectRole: "MANAGER" } } },
      include: { memberships: { where: { userId: user.id } } },
    });
    await audit(user.id, "project.create", project.id, { name: project.name });
    return reply.code(201).send({ project: toPublic(project) });
  });
}
