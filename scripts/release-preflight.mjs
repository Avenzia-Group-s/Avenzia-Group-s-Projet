import { readFileSync } from "node:fs";
const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
const version = JSON.parse(readFileSync("apps/desktop/package.json", "utf8")).version;
const response = await fetch("https://api.github.com/repos/" + repo + "/releases/tags/v" + version, {
  headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "User-Agent": "Avenzia-release" },
});
if (response.status !== 404) {
  if (!response.ok) throw new Error("Vérification de la release refusée : HTTP " + response.status);
  if (!(await response.json()).draft) throw new Error("Cette version est déjà publiée. Préparez une nouvelle version.");
}
console.log("Version disponible pour une publication.");
