import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { verifyUpdate } from "./verify-update.mjs";
import { resolveInstaller } from "./release-manifest.mjs";

const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
const releaseId = process.argv[2];
if (!repo || !token || !/^\d+$/.test(releaseId || "")) throw new Error("Contexte GitHub de publication incomplet.");
const headers = {
  Authorization: "Bearer " + token, Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "Avenzia-release",
};
async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
  if (!response.ok) throw new Error("GitHub refuse la publication : HTTP " + response.status);
  return response;
}
const base = "https://api.github.com/repos/" + repo;
const release = await (await request(base + "/releases/" + releaseId)).json();
const config = JSON.parse(readFileSync("apps/desktop/src-tauri/tauri.conf.json", "utf8"));
if (!release.draft || release.tag_name !== "v" + config.version) throw new Error("La release à publier doit être le brouillon de la version courante.");
function asset(name) {
  const found = release.assets.find(entry => entry.name === name);
  if (!found) throw new Error("Artefact de release manquant : " + name);
  return found;
}
async function contents(entry) {
  return Buffer.from(await (await request(entry.url, { headers: { Accept: "application/octet-stream" } })).arrayBuffer());
}
const manifest = JSON.parse((await contents(asset("latest.json"))).toString("utf8"));
if (manifest.version !== config.version) throw new Error("Version du manifeste incorrecte.");
const targets = Object.entries(manifest.platforms || {}).filter(([name]) => name.startsWith("windows-x86_64"));
if (!targets.length) throw new Error("Plateforme Windows manquante dans le manifeste.");
const verified = new Map();
for (const [, target] of targets) {
  const { installer, publicUrl } = resolveInstaller(release, target, repo);
  target.url = publicUrl;
  const signature = (await contents(asset(installer.name + ".sig"))).toString("utf8").trim();
  if (signature !== target.signature) throw new Error("Signature du manifeste différente du fichier .sig.");
  if (!verified.has(installer.name)) {
    const binary = await contents(installer);
    verifyUpdate(binary, signature, config.plugins.updater.pubkey, config.version);
    verified.set(installer.name, createHash("sha256").update(binary).digest("hex"));
  }
}
const manifestAsset = asset("latest.json");
await request(manifestAsset.url, { method: "DELETE" });
await request(release.upload_url.replace(/\{.*$/, "") + "?name=latest.json", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify(manifest, null, 2) + "\n",
});
const sums = [...verified].map(([name, hash]) => hash + "  " + name).join("\n") + "\n";
const previousSums = release.assets.find(entry => entry.name === "SHA256SUMS.txt");
const sameSums = previousSums && (await contents(previousSums)).toString("utf8") === sums;
if (previousSums && !sameSums) await request(previousSums.url, { method: "DELETE" });
if (!sameSums) {
  const upload = release.upload_url.replace(/\{.*$/, "") + "?name=SHA256SUMS.txt";
  await request(upload, { method: "POST", headers: { "Content-Type": "text/plain" }, body: sums });
}
await request(base + "/releases/" + releaseId, {
  method: "PATCH", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ draft: false }),
});
console.log("Release signée, vérifiée et publiée : " + release.html_url);
