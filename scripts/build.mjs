// Build sécurisé + publication GitHub Releases. Lancé par build.bat (toolchain locale).
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import "./env.mjs";

const root = resolve(import.meta.dirname, "..");
const flags = new Set(process.argv.slice(2));


const desktop = join(root, "apps/desktop");
const tauriConf = join(desktop, "src-tauri/tauri.conf.json");
const cargoToml = join(desktop, "src-tauri/Cargo.toml");
const pkgJson = join(desktop, "package.json");
const keyFile = join(root, ".keys/updater.key");
const log = (m) => console.log(`\n==> ${m}`);
const die = (m) => { console.error(`\n[ERREUR] ${m}`); process.exit(1); };

function run(cmd, args, opts = {}) {
  let executable = cmd;
  if (cmd === "npm" || cmd === "npx") {
    const npmCli = process.env.npm_execpath || join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
    args = [cmd === "npm" ? npmCli : join(dirname(npmCli), "npx-cli.js"), ...args];
    executable = process.execPath;
  }
  const result = spawnSync(executable, args, { stdio: "inherit", cwd: root, ...opts });
  if (result.error || result.status !== 0) die(`Commande échouée : ${cmd}`);
}
const out = (cmd, args) => spawnSync(cmd, args, { cwd: root, encoding: "utf8" }).stdout?.trim() ?? "";

// ---------- Pré-vérifications (avant toute modification) ----------
const release = !flags.has("--no-release");
const repo = process.env.GITHUB_REPO, ghToken = process.env.GITHUB_TOKEN;
if (!existsSync(keyFile)) die("Clé de signature absente (.keys/updater.key). Lancez scripts\\setup.bat.");
if (!process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD) die("TAURI_SIGNING_PRIVATE_KEY_PASSWORD manquant dans .env.local.");
if (release) {
  if (!ghToken || !repo || repo === "OWNER/REPO") die("GITHUB_TOKEN / GITHUB_REPO manquants dans .env.local (ou utilisez --no-release).");
  if (readFileSync(tauriConf, "utf8").includes("REPLACE_BY_SETUP")) die("Clé publique non configurée dans tauri.conf.json.");
}

run("node", ["scripts/prepare-desktop.mjs", ...(release ? ["--public"] : [])]);

// ---------- Version ----------
const readVersion = () => JSON.parse(readFileSync(tauriConf, "utf8")).version;
function bumpPatch() {
  const [a, b, c] = readVersion().split(".").map(Number);
  const next = `${a}.${b}.${c + 1}`;
  const sub = (file, re, rep) => writeFileSync(file, readFileSync(file, "utf8").replace(re, rep));
  sub(tauriConf, /("version":\s*")[^"]+(")/, `$1${next}$2`);
  sub(cargoToml, /^(version\s*=\s*")[^"]+(")/m, `$1${next}$2`);
  sub(pkgJson, /("version":\s*")[^"]+(")/, `$1${next}$2`);
  return next;
}
if (!flags.has("--no-bump")) { const v = bumpPatch(); log(`Nouvelle version : ${v}`); }
const version = readVersion();
const tag = `v${version}`;

// ---------- Build reproductible ----------
log("Installation des dépendances (lockfile strict)");
run("npm", [existsSync(join(root, "package-lock.json")) ? "ci" : "install", "--ignore-scripts"]);
run("npm", ["run", "db:generate"]);
log("Audit des dépendances de production (niveau high)");
run("npm", ["audit", "--omit=dev", "--audit-level=high"]);
log("Vérification des types + tests");
run("npm", ["run", "typecheck"]);
run("npm", ["test"]);

run("npx", ["tauri", "icon", "app-icon.png", "--output", "src-tauri/icons"], { cwd: desktop });
log("Compilation Tauri (signée)");
const locked = existsSync(join(desktop, "src-tauri/Cargo.lock")) ? ["--", "--locked"] : [];
run("npx", ["tauri", "build", "--config", join(root, ".tools/tauri-build.json"), ...locked], {
  cwd: desktop,
  env: { ...process.env, TAURI_SIGNING_PRIVATE_KEY: readFileSync(keyFile, "utf8").trim(), TAURI_SIGNING_PRIVATE_KEY_PASSWORD: process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD },
});

const bundle = join(desktop, "src-tauri/target/release/bundle/nsis");
const installerName = `Avenzia_${version}_x64-setup.exe`;
const installer = join(bundle, installerName), sigFile = `${installer}.sig`;
if (!existsSync(installer) || !existsSync(sigFile)) die(`Artefacts introuvables dans ${bundle}`);
console.log(`\n[OK] Build réussi : ${installerName}`);
if (!release) process.exit(0);

// ---------- Commit de version + push (le tag GitHub pointera sur ce commit) ----------
if (!flags.has("--no-git")) {
  log("Commit de la version");
  run("git", ["add", "apps/desktop/package.json", "apps/desktop/src-tauri/tauri.conf.json", "apps/desktop/src-tauri/Cargo.toml", "apps/desktop/src-tauri/Cargo.lock", "package-lock.json"]);
  run("git", ["commit", "-m", `release ${tag}`]);
  run("git", ["push"]);
}

// ---------- Publication GitHub Releases ----------
const H = { Authorization: `Bearer ${ghToken}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "avenzia-release" };
async function gh(url, init = {}) {
  const r = await fetch(url, { ...init, headers: { ...H, ...init.headers } });
  if (!r.ok) die(`GitHub ${init.method ?? "GET"} ${url} -> ${r.status} ${await r.text()}`);
  return r.json();
}
const installerBuf = readFileSync(installer);
const signature = readFileSync(sigFile, "utf8").trim();
const notes = out("git", ["log", "-n", "15", "--pretty=format:- %s"]) || "Mise à jour d'Avenzia.";
const latest = {
  version, notes, pub_date: new Date().toISOString(),
  platforms: { "windows-x86_64": { signature, url: `https://github.com/${repo}/releases/download/${tag}/${installerName}` } },
};
const sums = `${createHash("sha256").update(installerBuf).digest("hex")}  ${installerName}\n`;

log(`Création de la release ${tag} (brouillon)`);
const rel = await gh(`https://api.github.com/repos/${repo}/releases`, {
  method: "POST", body: JSON.stringify({ tag_name: tag, name: `Avenzia ${version}`, body: notes, draft: true }),
});
const upload = async (name, data, type = "application/octet-stream") => {
  log(`Envoi de ${name}`);
  await gh(`${rel.upload_url.replace(/\{.*$/, "")}?name=${encodeURIComponent(name)}`, { method: "POST", headers: { "Content-Type": type }, body: data });
};
await upload(installerName, installerBuf);
await upload(`${installerName}.sig`, signature, "text/plain");
await upload("SHA256SUMS.txt", sums, "text/plain");
await upload("latest.json", JSON.stringify(latest, null, 2), "application/json"); // en dernier : le manifeste référence un installateur déjà en ligne

await gh(rel.url, { method: "PATCH", body: JSON.stringify({ draft: false }) }); // publication atomique
console.log(`\n[OK] Release publiée : ${rel.html_url}`);
