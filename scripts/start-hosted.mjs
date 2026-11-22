import "./env.mjs";
import { spawn, spawnSync } from "node:child_process";
import { join } from "node:path";
import { projectRoot } from "./env.mjs";

const port = process.env.PORT || process.env.SERVER_PORT || process.env.API_PORT || "3000";
process.env.API_PORT = port;
process.env.API_HOST = "0.0.0.0";
process.env.API_PUBLIC_URL ||= process.env.RENDER_EXTERNAL_URL || "";
process.env.API_URL = "http://127.0.0.1:" + port;
if (!process.env.DATABASE_URL || !process.env.API_PUBLIC_URL) {
  throw new Error("DATABASE_URL et l’adresse publique de l’API sont nécessaires au déploiement.");
}
const migration = spawnSync(process.execPath, [
  join(projectRoot, "node_modules/prisma/build/index.js"), "migrate", "deploy",
  "--schema", join(projectRoot, "packages/database/prisma/schema.prisma"),
], { cwd: projectRoot, stdio: "inherit", env: process.env });
if (migration.error || migration.status !== 0) process.exit(1);

const children = new Set();
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => {
    for (const child of children) child.kill("SIGKILL");
  }, 10_000).unref();
}
function start(name, entry) {
  const child = spawn(process.execPath, ["--import", "tsx", entry], {
    cwd: projectRoot, env: process.env, stdio: "inherit", windowsHide: true,
  });
  children.add(child);
  child.once("error", () => {
    console.error("Démarrage impossible du service " + name + ".");
    children.delete(child);
    stop(1);
  });
  child.once("exit", code => {
    children.delete(child);
    if (!stopping) {
      console.error("Le service " + name + " s’est arrêté. Redémarrage requis.");
      stop(code || 1);
    }
  });
}
start("API", "apps/api/src/server.ts");
start("bot", "apps/discord-bot/src/index.ts");
process.once("SIGTERM", () => stop(0));
process.once("SIGINT", () => stop(0));
