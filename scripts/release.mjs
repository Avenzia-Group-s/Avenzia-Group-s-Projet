import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

function git(args) {
  const result = spawnSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.error || result.status !== 0) throw new Error("Git a échoué : " + (result.stderr || "vérifiez votre connexion GitHub."));
  return result.stdout.trim();
}
const action = process.argv[2] || "patch";
if (!["major", "minor", "patch"].includes(action)) throw new Error("Utilisez major, minor ou patch.");
if (git(["status", "--porcelain"])) throw new Error("Enregistrez vos modifications dans un commit avant de préparer une version.");
const branch = git(["branch", "--show-current"]);
if (!branch) throw new Error("Une branche Git doit être sélectionnée.");
let next = JSON.parse(readFileSync("apps/desktop/package.json", "utf8")).version;
let tag = "v" + next;
const prepared = git(["tag", "--points-at", "HEAD"]).split("\n").includes(tag);
const alreadyPushed = prepared && !!git(["ls-remote", "--tags", "origin", "refs/tags/" + tag]);
if (!prepared || alreadyPushed) {
  const version = spawnSync(process.execPath, ["scripts/version.mjs", action], { stdio: "inherit" });
  if (version.status !== 0) process.exit(1);
  next = JSON.parse(readFileSync("apps/desktop/package.json", "utf8")).version;
  tag = "v" + next;
  git(["add", "--", "package.json", "package-lock.json", "apps/desktop/package.json", "apps/desktop/src-tauri/Cargo.toml", "apps/desktop/src-tauri/Cargo.lock", "apps/desktop/src-tauri/tauri.conf.json"]);
  git(["commit", "-m", "release " + tag]);
  git(["tag", tag]);
}
console.log("Version préparée. Envoi vers GitHub…");
git(["push", "origin", branch]);
git(["push", "origin", tag]);
console.log("Compilation signée lancée pour " + tag + ". Résultat dans GitHub Actions.");
