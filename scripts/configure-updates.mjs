import "./env.mjs";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { projectRoot } from "./env.mjs";

const repo = process.env.GITHUB_REPO;
if (!repo || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) throw new Error("GITHUB_REPO doit contenir organisation/depot.");
const credentials = spawnSync("git", ["credential", "fill"], {
  input: "protocol=https\nhost=github.com\n\n", encoding: "utf8",
  env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "Never" },
});
const tokenLine = credentials.stdout?.split("\n").find(line => line.startsWith("password="));
const token = process.env.GH_TOKEN || tokenLine?.slice("password=".length).trim();
if (!token) throw new Error("Connectez Git à GitHub, ou fournissez GH_TOKEN avec les droits Secrets et Variables du dépôt.");
const headers = {
  Authorization: "Bearer " + token, Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "Avenzia-config",
};
const base = "https://api.github.com/repos/" + repo + "/actions";
async function request(path, options = {}) {
  const response = await fetch(base + path, {
    ...options, headers: { ...headers, "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) throw new Error("Configuration GitHub refusée : HTTP " + response.status + ". Vérifiez vos droits Secrets et Variables.");
  return response.status === 204 ? null : response.json();
}
if (process.argv.includes("--check")) {
  const result = await request("/secrets");
  for (const name of ["TAURI_SIGNING_PRIVATE_KEY", "TAURI_SIGNING_PRIVATE_KEY_PASSWORD"]) {
    console.log(name + " : " + (result.secrets.some(secret => secret.name === name) ? "configuré" : "absent"));
  }
  const variables = await request("/variables");
  for (const name of ["VITE_API_URL", "RELEASE_TARGET"]) {
    console.log(name + " : " + (variables.variables.find(variable => variable.name === name)?.value || "absent"));
  }
} else {
  const position = process.argv.indexOf("--api-url");
  const api = position >= 0 ? process.argv[position + 1] : process.env.VITE_API_URL;
  const url = new URL(api || "");
  const local = process.argv.includes("--local-test");
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
      (local ? !loopback || !["http:", "https:"].includes(url.protocol) : loopback || url.protocol !== "https:") ||
      url.hostname.endsWith(".example") || url.hostname === "api.exemple.fr") {
    throw new Error("Utilisez une API HTTPS publique ou --local-test avec localhost.");
  }
  if (!process.argv.includes("--variables-only")) {
    const password = process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD;
    const keyFile = join(projectRoot, ".keys/updater.key");
    if (!password || !existsSync(keyFile)) throw new Error("Clé locale de signature ou mot de passe absent.");
    const dependencyRoot = join(projectRoot, ".tools/github-config");
    const require = createRequire(join(dependencyRoot, "package.json"));
    let sodium;
    try { sodium = require("libsodium-wrappers"); }
    catch {
      const npm = process.env.npm_execpath || join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
      const installed = spawnSync(process.execPath, [npm, "install", "--prefix", dependencyRoot, "--no-save", "--ignore-scripts", "--no-audit", "--no-fund", "libsodium-wrappers"], {
        stdio: ["ignore", "pipe", "pipe"], env: process.env,
      });
      if (installed.error || installed.status !== 0) throw new Error("Installation de l’outil de chiffrement impossible.");
      sodium = require("libsodium-wrappers");
    }
    await sodium.ready;
    const publicKey = await request("/secrets/public-key");
    for (const [name, value] of [
      ["TAURI_SIGNING_PRIVATE_KEY", readFileSync(keyFile, "utf8").trim()],
      ["TAURI_SIGNING_PRIVATE_KEY_PASSWORD", password],
    ]) {
      const encrypted = sodium.crypto_box_seal(Buffer.from(value), Buffer.from(publicKey.key, "base64"));
      await request("/secrets/" + name, { method: "PUT", body: JSON.stringify({
        encrypted_value: Buffer.from(encrypted).toString("base64"), key_id: publicKey.key_id,
      }) });
      console.log("Secret GitHub configuré : " + name);
    }

  } else {
    const configured = await request("/secrets");
    for (const name of ["TAURI_SIGNING_PRIVATE_KEY", "TAURI_SIGNING_PRIVATE_KEY_PASSWORD"]) {
      if (!configured.secrets.some(secret => secret.name === name)) throw new Error("Secret GitHub manquant : " + name + ". Lancez scripts\\configure-updates.bat pour configurer la signature.");
    }
  }
  const variables = await request("/variables");
  for (const [name, value] of [["VITE_API_URL", url.origin], ["RELEASE_TARGET", local ? "local" : "public"]]) {
    const exists = variables.variables.some(variable => variable.name === name);
    await request("/variables" + (exists ? "/" + name : ""), {
      method: exists ? "PATCH" : "POST", body: JSON.stringify({ name, value }),
    });
  }
  console.log("Configuration GitHub prête. Adresse API : " + url.origin);
  console.log("Mode de publication : " + (local ? "test sur votre PC" : "API publique"));
}
