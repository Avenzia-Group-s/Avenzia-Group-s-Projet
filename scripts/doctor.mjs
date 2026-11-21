import { envFiles } from "./env.mjs";

console.log("Configuration chargée depuis " + (envFiles.join(" puis ") || "les variables système"));
const required = [
  "DATABASE_URL", "API_PUBLIC_URL", "DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET",
  "DISCORD_GUILD_ID", "DISCORD_BOT_TOKEN", "INTERNAL_API_SECRET",
];
const errors = required.filter(name => !process.env[name]?.trim()).map(name => name + " est vide.");
for (const name of ["DISCORD_CLIENT_ID", "DISCORD_GUILD_ID"]) {
  if (process.env[name] && !/^\d{15,25}$/.test(process.env[name])) errors.push(name + " doit être un identifiant Discord.");
}
if (process.env.INTERNAL_API_SECRET && process.env.INTERNAL_API_SECRET.length < 32) {
  errors.push("INTERNAL_API_SECRET doit contenir au moins 32 caractères.");
}
const port = Number(process.env.API_PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push("API_PORT est invalide.");
for (const name of ["API_PUBLIC_URL", "API_URL", "VITE_API_URL"]) {
  if (!process.env[name]) continue;
  try {
    const url = new URL(process.env[name]);
    if (url.hostname.endsWith(".example") || url.hostname === "api.exemple.fr") errors.push(name + " contient encore une adresse de démonstration.");
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error();
  } catch { errors.push(name + " doit être une URL HTTP ou HTTPS sans identifiants."); }
}
if (errors.length) {
  errors.forEach(error => console.error("[ERREUR] " + error));
  console.error("Renseignez le fichier .env.local à la racine du projet.");
  process.exit(1);
}
console.log("[OK] Réglages obligatoires présents. Aucun secret affiché.");
if (!process.argv.includes("--config-only")) {
  try {
    const base = process.env.API_URL || "http://127.0.0.1:" + port;
    const response = await fetch(base.replace(/\/$/, "") + "/health", { signal: AbortSignal.timeout(5000) });
    if (!response.ok || (await response.json()).ok !== true) throw new Error();
    console.log("[OK] API joignable.");
  } catch { console.log("[INFO] API indisponible. Lancez scripts\\start-dev.bat --services."); }
  try {
    const headers = { Authorization: "Bot " + process.env.DISCORD_BOT_TOKEN };
    const identity = await fetch("https://discord.com/api/v10/users/@me", { headers, signal: AbortSignal.timeout(5000) });
    if (!identity.ok) throw new Error("Token Discord refusé.");
    const bot = await identity.json();
    if (bot.id !== process.env.DISCORD_CLIENT_ID) throw new Error("Le token et DISCORD_CLIENT_ID désignent deux applications différentes.");
    const guild = await fetch("https://discord.com/api/v10/guilds/" + process.env.DISCORD_GUILD_ID, { headers, signal: AbortSignal.timeout(5000) });
    if (!guild.ok) throw new Error("Serveur Discord inaccessible. Vérifiez DISCORD_GUILD_ID et installez le bot avec les scopes bot et applications.commands.");
    console.log("[OK] Token Discord et accès au serveur.");
  } catch (error) {
    console.error("[ERREUR] " + (error instanceof Error ? error.message : "Discord indisponible."));
    process.exitCode = 1;
  }

}
