import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { prisma, type User } from "@avenzia/database";
import { env } from "./env.js";
import { sha256Hex } from "./lib/crypto.js";
import { authRoutes } from "./routes/auth.js";
import { projectRoutes } from "./routes/projects.js";
import { internalRoutes } from "./routes/internal.js";

declare module "fastify" {
  interface FastifyInstance { requireAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void> }
  interface FastifyRequest { user?: User; sessionId?: string }
}

const app = Fastify({
  trustProxy: (_address, hop) => hop < env.API_TRUST_PROXY_HOPS,
  logger: {
    level: "info",
    redact: ["req.headers.authorization", "req.headers['x-internal-secret']"],
    serializers: {
      req(request) { return { method: request.method, url: request.url?.split("?")[0] }; },
    },
  },
  bodyLimit: 1_000_000,
});

app.setErrorHandler((err: Error & { statusCode?: number }, req, reply) => {
  req.log.error({ err: err.message }, "request error");
  reply.code(err.statusCode ?? 500).send({ error: err.statusCode && err.statusCode < 500 ? err.message : "internal_error" });
});

await app.register(helmet);
// Tauri envoie ces origines ; pas de cookies, auth par Bearer => pas de CSRF classique.
await app.register(cors, { origin: ["http://tauri.localhost", "tauri://localhost", "http://localhost:1420", "http://127.0.0.1:1420"], methods: ["GET", "POST", "PATCH", "DELETE"] });
await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });

app.decorate("requireAuth", async (req: FastifyRequest, reply: FastifyReply) => {
  const h = req.headers.authorization;
  const token = h?.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return reply.code(401).send({ error: "unauthorized" });
  const s = await prisma.session.findUnique({ where: { tokenHash: sha256Hex(token) }, include: { user: true } });
  if (!s || s.revokedAt || s.expiresAt < new Date()) return reply.code(401).send({ error: "unauthorized" });
  req.user = s.user; req.sessionId = s.id;
});

app.get("/health", async () => ({ ok: true }));
await app.register(authRoutes);
await app.register(projectRoutes);
await app.register(internalRoutes);



await prisma.$connect();
await app.listen({ port: env.API_PORT, host: env.API_HOST });

async function shutdown() {
  await app.close();
  await prisma.$disconnect();
}
process.once("SIGTERM", () => { void shutdown(); });
process.once("SIGINT", () => { void shutdown(); });
