import {
  Client, GatewayIntentBits, MessageFlags, PermissionFlagsBits, REST, Routes,
  SlashCommandBuilder, type ChatInputCommandInteraction,
} from "discord.js";
import { api } from "./api.js";

const token = process.env.DISCORD_BOT_TOKEN, clientId = process.env.DISCORD_CLIENT_ID, guildId = process.env.DISCORD_GUILD_ID;
if (!token || !clientId || !guildId || (process.env.INTERNAL_API_SECRET?.length ?? 0) < 32) {
  console.error("Vérifiez DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID et INTERNAL_API_SECRET dans le fichier racine .env.local. Lancez npm run doctor.");
  process.exit(1);
}

// GuildMembers est un intent PRIVILÉGIÉ : à activer dans le Developer Portal.
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

const command = new SlashCommandBuilder().setName("avenzia").setDescription("Commandes Avenzia")
  .addSubcommand((s) => s.setName("aide").setDescription("Liste des commandes"))
  .addSubcommand((s) => s.setName("ping").setDescription("Vérifie que le bot répond"))
  .addSubcommand((s) => s.setName("projets").setDescription("Vos projets accessibles"))
  .addSubcommand((s) => s.setName("statut").setDescription("État du service Avenzia"))
  .addSubcommand((s) => s.setName("sync").setDescription("Resynchronise les accès (admin)"));

client.once("ready", async () => {
  try {
    await new REST().setToken(token).put(Routes.applicationGuildCommands(clientId, guildId), { body: [command.toJSON()] });
  } catch {
    console.error("Enregistrement des commandes impossible. Vérifiez le serveur Discord et l’installation du bot avec applications.commands.");
    client.destroy();
    process.exitCode = 1;
    return;
  }
  console.log(`Avenzia Bot connecté : ${client.user?.tag}`);
});

// --- Synchronisation des rôles (événements) ---
client.on("guildMemberUpdate", async (oldM, m) => {
  if (m.guild.id !== guildId) return;
  const before = oldM.partial ? null : [...oldM.roles.cache.keys()].sort().join();
  const after = [...m.roles.cache.keys()].sort().join();
  if (before === after) return; // évite les envois inutiles / boucles
  await api("/internal/member-roles", { discordId: m.id, roleIds: [...m.roles.cache.keys()].filter((r) => r !== m.guild.id) }).catch((e) => console.error(e.message));
});
client.on("guildMemberRemove", async (m) => {
  if (m.guild.id !== guildId) return;
  await api("/internal/member-left", { discordId: m.id }).catch((e) => console.error(e.message));
});
client.on("guildMemberAdd", async (m) => {
  if (m.guild.id !== guildId) return;
  await api("/internal/member-roles", { discordId: m.id, roleIds: [...m.roles.cache.keys()].filter((r) => r !== m.guild.id) }).catch(() => {});
});

const cooldown = new Map<string, number>();

client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand() || i.commandName !== "avenzia") return;
  const last = cooldown.get(i.user.id) ?? 0;
  if (Date.now() - last < 2000) return void i.reply({ content: "Doucement, réessayez dans un instant.", flags: MessageFlags.Ephemeral });
  cooldown.set(i.user.id, Date.now());
  try { await handle(i); } catch (e) {
    console.error(e);
    const msg = { content: "Erreur : le service Avenzia est injoignable.", flags: MessageFlags.Ephemeral } as const;
    i.deferred || i.replied ? await i.followUp(msg) : await i.reply(msg);
  }
});

async function handle(i: ChatInputCommandInteraction) {
  const eph = MessageFlags.Ephemeral;
  switch (i.options.getSubcommand()) {
    case "ping": return void i.reply({ content: `Pong ! ${Math.round(client.ws.ping)} ms`, flags: eph });
    case "aide": return void i.reply({ content: "`/avenzia ping` · `projets` · `statut` · `sync` (admin)", flags: eph });
    case "statut": {
      await i.deferReply({ flags: eph });
      const ok = await fetch(`${process.env.API_URL ?? "http://localhost:3000"}/health`).then((r) => r.ok).catch(() => false);
      return void i.editReply(ok ? "API Avenzia : en ligne." : "API Avenzia : injoignable.");
    }
    case "projets": {
      await i.deferReply({ flags: eph });
      const r = await api<{ projects: { name: string; status: string }[] }>(`/internal/user/${i.user.id}/projects`);
      return void i.editReply(r.projects.length ? r.projects.map((p) => `• ${p.name} (${p.status})`).join("\n") : "Aucun projet accessible.");
    }
    case "sync": {
      if (!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return void i.reply({ content: "Réservé aux administrateurs.", flags: eph });
      await i.deferReply({ flags: eph });
      const members = await i.guild!.members.fetch();
      const payload = [...members.values()].filter((m) => !m.user.bot).map((m) => ({ discordId: m.id, roleIds: [...m.roles.cache.keys()].filter((r) => r !== i.guild!.id) }));
      for (let k = 0; k < payload.length; k += 1000) await api("/internal/sync", { members: payload.slice(k, k + 1000) });
      return void i.editReply(`Synchronisation terminée : ${payload.length} membres.`);
    }
  }
}

try {
  await client.login(token);
} catch (error) {
  const message = error instanceof Error ? error.message : "";
  console.error(message.includes("disallowed intents")
    ? "Discord refuse les intents. Activez Bot > Privileged Gateway Intents > Server Members Intent dans le Developer Portal, enregistrez et relancez le bot."
    : "Connexion Discord impossible. Vérifiez le token du bot et votre connexion Internet.");
  client.destroy();
  process.exitCode = 1;
}
