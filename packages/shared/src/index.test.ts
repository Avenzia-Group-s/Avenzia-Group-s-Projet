import { describe, expect, it } from "vitest";
import {
  canCreateProject, canInitiateDmWithoutRequest, computeGlobalRole,
  hasProjectAccess, hasProjectPermission, CreateProjectSchema,
} from "./index";

describe("permissions", () => {
  it("refuse par défaut", () => {
    expect(hasProjectPermission(null, "project.view")).toBe(false);
    expect(hasProjectPermission("READER", "task.create")).toBe(false);
    expect(hasProjectPermission("CONTRIBUTOR", "mention.everyone")).toBe(false);
    expect(hasProjectPermission("MANAGER", "mention.everyone")).toBe(true);
  });
  it("création de projet réservée Fondateur / Co-fondateur", () => {
    expect(canCreateProject("FOUNDER")).toBe(true);
    expect(canCreateProject("CO_FOUNDER")).toBe(true);
    expect(canCreateProject("STAFF")).toBe(false);
    expect(canCreateProject("MEMBER")).toBe(false);
  });
  it("MP sans demande : staff et plus", () => {
    expect(canInitiateDmWithoutRequest("STAFF")).toBe(true);
    expect(canInitiateDmWithoutRequest("MEMBER")).toBe(false);
  });
  it("le Staff n'obtient aucun accès projet automatique", () => {
    const role = computeGlobalRole(["staff"], { staff: "staff" });
    expect(role).toBe("STAFF");
    expect(hasProjectAccess(["staff"], ["coucou"])).toBe(false);
    expect(hasProjectAccess(["staff", "coucou"], ["coucou"])).toBe(true);
  });
  it("valide un projet", () => {
    expect(CreateProjectSchema.safeParse({ name: "Coucou", discordRoleId: "123456789012345678" }).success).toBe(true);
    expect(CreateProjectSchema.safeParse({ name: "x", discordRoleId: "abc" }).success).toBe(false);
  });
});
