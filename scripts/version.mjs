import { readFileSync, writeFileSync } from "node:fs";

const files = ["package.json", "apps/desktop/package.json", "apps/desktop/src-tauri/tauri.conf.json"];
const documents = files.map(file => JSON.parse(readFileSync(file, "utf8")));
const current = documents[2].version;
const cargoPath = "apps/desktop/src-tauri/Cargo.toml";
const cargo = readFileSync(cargoPath, "utf8");
if (!documents.every(document => document.version === current) ||
    !new RegExp('^version\\s*=\\s*"' + current.replaceAll(".", "\\.") + '"', "m").test(cargo)) {
  throw new Error("Les versions de l’application doivent être synchronisées avant une publication.");
}
const action = process.argv[2] || "--check";
if (action === "--check") {
  if (process.env.GITHUB_REF_TYPE === "tag" && process.env.GITHUB_REF_NAME !== "v" + current) {
    throw new Error("Le tag GitHub ne correspond pas à la version de l’application.");
  }
  console.log("Versions synchronisées : " + current);
} else {
  const parts = current.split(".").map(Number);
  if (parts.length !== 3 || parts.some(value => !Number.isInteger(value))) throw new Error("Version numérique majeure.mineure.correctif attendue.");
  const position = ["major", "minor", "patch"].indexOf(action);
  if (position < 0) throw new Error("Utilisez major, minor, patch ou --check.");
  parts[position]++;
  for (let index = position + 1; index < parts.length; index++) parts[index] = 0;
  const next = parts.join(".");
  documents.forEach((document, index) => {
    document.version = next;
    writeFileSync(files[index], JSON.stringify(document, null, 2) + "\n");
  });
  writeFileSync(cargoPath, cargo.replace(/^(version\s*=\s*")[^"]+(")/m, (_match, before, after) => before + next + after));
  const lockPath = "apps/desktop/src-tauri/Cargo.lock";
  const lock = readFileSync(lockPath, "utf8");
  writeFileSync(lockPath, lock.replace(/(\[\[package\]\]\r?\nname = "avenzia"\r?\nversion = ")[^"]+(")/, (_match, before, after) => before + next + after));
  const npmLock = JSON.parse(readFileSync("package-lock.json", "utf8"));
  npmLock.version = next;
  npmLock.packages[""].version = next;
  npmLock.packages["apps/desktop"].version = next;
  writeFileSync("package-lock.json", JSON.stringify(npmLock, null, 2) + "\n");
  console.log("Nouvelle version : " + next);
}
