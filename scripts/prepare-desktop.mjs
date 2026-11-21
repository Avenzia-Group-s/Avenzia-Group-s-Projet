import "./env.mjs";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { projectRoot } from "./env.mjs";

const isPublic = process.argv.includes("--public");
const address = process.env.VITE_API_URL || "http://localhost:3000";
const url = new URL(address);
if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
    url.pathname !== "/" || url.search || url.hash) {
  throw new Error("VITE_API_URL doit contenir uniquement une origine HTTP ou HTTPS.");
}
if (url.hostname.endsWith(".example") || url.hostname === "api.exemple.fr") {
  throw new Error("Remplacez l’adresse de démonstration VITE_API_URL par votre API.");
}
if (isPublic && (url.protocol !== "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) {
  throw new Error("La publication exige une vraie adresse API HTTPS accessible aux utilisateurs.");
}
const config = JSON.parse(readFileSync(join(projectRoot, "apps/desktop/src-tauri/tauri.conf.json"), "utf8").replace(/^\uFEFF/, ""));
const csp = config.app.security.csp.replace(/connect-src[^;]*/, match => match + " " + url.origin);
const override = { app: { security: { csp } } };
if (process.argv.includes("--unsigned")) override.bundle = { createUpdaterArtifacts: false };
mkdirSync(join(projectRoot, ".tools"), { recursive: true });
writeFileSync(join(projectRoot, ".tools/tauri-build.json"), JSON.stringify(override, null, 2));
console.log("Configuration de compilation prête pour " + url.origin);
