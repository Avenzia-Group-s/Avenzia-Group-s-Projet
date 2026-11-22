import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { projectRoot } from "./env.mjs";

export function parsePublication(text) {
  const config = JSON.parse(text.replace(/^\uFEFF/, ""));
  if (!config || typeof config !== "object" || Object.keys(config).length !== 1 || typeof config.apiUrl !== "string") {
    throw new Error("publication.json doit contenir uniquement le champ apiUrl, sans secret.");
  }
  const url = new URL(config.apiUrl);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
      ["localhost", "127.0.0.1", "[::1]", "0.0.0.0", "api.exemple.fr"].includes(url.hostname) ||
      /\.(invalid|example|test|localhost|local)$/.test(url.hostname) || /remplacer/i.test(url.hostname)) {
    throw new Error("Remplacez apiUrl dans publication.json par la vraie adresse HTTPS publique, sans /health ni /auth.");
  }
  return url.origin;
}

export async function verifyPublicApi(apiUrl, request = fetch) {
  const health = await request(apiUrl + "/health", { signal: AbortSignal.timeout(120_000), redirect: "error" });
  if (!health.ok || (await health.json()).ok !== true) throw new Error("L’API doit répondre {ok:true} sur " + apiUrl + "/health.");
  const response = await request(apiUrl + "/auth/discord/start", {
    method: "POST", headers: { "Content-Type": "application/json" }, redirect: "error",
    body: JSON.stringify({ codeChallenge: randomBytes(32).toString("base64url") }), signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error("L’API refuse le contrôle de connexion Discord : HTTP " + response.status);
  const authorization = new URL((await response.json()).url);
  const callback = apiUrl + "/auth/discord/callback";
  if (authorization.origin !== "https://discord.com" || authorization.pathname !== "/oauth2/authorize" ||
      authorization.searchParams.get("redirect_uri") !== callback) {
    throw new Error("L’API utilise encore une autre adresse de retour Discord. Dans Pterodactyl, serveur API → Fichiers → avenzia/.env.local, définissez API_PUBLIC_URL=" + apiUrl + ", puis redémarrez l’API.");
  }
  return callback;
}

function git(args) {
  const result = spawnSync("git", args, { cwd: projectRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.error || result.status !== 0) throw new Error("Git a échoué : " + (result.stderr || "vérifiez la connexion GitHub."));
  return result.stdout.trim();
}
function run(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: projectRoot, stdio: "inherit" });
  if (result.error || result.status !== 0) throw new Error("Étape interrompue : " + script);
}
export async function main(args = process.argv.slice(2)) {
  if (args.some(arg => !["--check", "--verify"].includes(arg))) throw new Error("Options possibles : --check ou --verify.");
  const apiUrl = parsePublication(readFileSync(resolve(projectRoot, "publication.json"), "utf8"));
  console.log("Adresse API : " + apiUrl);
  console.log("Redirection à enregistrer dans Discord Developer Portal → OAuth2 → Redirects : " + apiUrl + "/auth/discord/callback");
  if (args.includes("--check")) return;
  if (!args.includes("--verify")) {
    const otherChanges = git(["status", "--porcelain", "--untracked-files=all", "--", ".", ":(exclude)publication.json"]);
    if (otherChanges) throw new Error("Enregistrez les autres modifications du projet dans un commit avant publication. Seul publication.json est enregistré automatiquement.");
    const branch = git(["branch", "--show-current"]);
    if (!branch) throw new Error("Sélectionnez une branche Git avant publication.");
    if (!git(["ls-files", "--", ".github/workflows/release.yml"])) throw new Error("Workflow de publication manquant.");
  }
  console.log("Vérification de l’API et de son adresse de retour Discord…");
  await verifyPublicApi(apiUrl);
  console.log("API et adresse de retour vérifiées. L’ajout du Redirect dans le portail Discord reste à effectuer si nécessaire.");
  if (args.includes("--verify")) return;
  run("scripts/configure-updates.mjs", ["--api-url", apiUrl, "--variables-only"]);
  if (git(["status", "--porcelain", "--", "publication.json"])) {
    git(["add", "--", "publication.json"]);
    git(["commit", "-m", "config: set public API address", "--", "publication.json"]);
  }
  run("scripts/release.mjs", ["patch"]);
  console.log("Suivez la compilation dans https://github.com/" + process.env.GITHUB_REPO + "/actions");
  console.log("Une fois validée, la version sera disponible dans Releases et dans les mises à jour de l’application.");
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error("Publication interrompue : " + error.message); process.exitCode = 1; });
}
