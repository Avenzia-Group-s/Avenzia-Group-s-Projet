import { z } from "zod";

const optId = z.string().regex(/^\d{15,25}$/).optional().or(z.literal("").transform(() => undefined));
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  API_PUBLIC_URL: z.string().url().transform(value => value.replace(/\/$/, "")),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_CLIENT_SECRET: z.string().min(1),
  DISCORD_BOT_TOKEN: z.string().optional(),
  DISCORD_GUILD_ID: z.string().regex(/^\d{15,25}$/),
  DISCORD_INVITE_URL: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  ROLE_FOUNDER_ID: optId,
  ROLE_COFOUNDER_ID: optId,
  ROLE_STAFF_ID: optId,
  INTERNAL_API_SECRET: z.string().min(32, "INTERNAL_API_SECRET doit faire au moins 32 caractères"),
  SESSION_TTL_DAYS: z.coerce.number().default(30),
  TWO_FA_ENABLED: z.enum(["true", "false"]).default("true").transform((v) => v === "true"),
}).superRefine((v, ctx) => {
  if (v.TWO_FA_ENABLED && !v.DISCORD_BOT_TOKEN) ctx.addIssue({ code: "custom", path: ["DISCORD_BOT_TOKEN"], message: "Requis pour envoyer le code 2FA par message privé" });
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Configuration invalide (.env.local ou .env à la racine) :\n", parsed.error.flatten().fieldErrors);
  process.exit(1);
}
export const env = parsed.data;
