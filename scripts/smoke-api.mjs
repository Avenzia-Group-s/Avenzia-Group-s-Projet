import "./env.mjs";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { join } from "node:path";
import { projectRoot } from "./env.mjs";

const port = process.env.SMOKE_API_PORT || "3101";
const origin = "http://127.0.0.1:" + port;
const secret = "avenzia-smoke-secret-" + "x".repeat(32);
const challenge = "S".repeat(43);
const child = spawn(process.execPath, ["--import", "tsx", "apps/api/src/server.ts"], {
  cwd: projectRoot, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env, API_PORT: port, API_HOST: "127.0.0.1", API_PUBLIC_URL: origin,
    DISCORD_CLIENT_ID: "123456789012345678", DISCORD_CLIENT_SECRET: "smoke-only",
    DISCORD_BOT_TOKEN: "smoke-only", DISCORD_GUILD_ID: "123456789012345679",
    INTERNAL_API_SECRET: secret, TWO_FA_ENABLED: "true",
  },
});
let logs = "";
child.stdout.on("data", chunk => { logs += chunk; });
child.stderr.on("data", chunk => { logs += chunk; });
let flowState;
try {
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    if (child.exitCode !== null) throw new Error("L’API de test s’est arrêtée avant son démarrage.");
    try {
      const response = await fetch(origin + "/health", { signal: AbortSignal.timeout(1000) });
      if (response.ok) { ready = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(ready, "L’API de test doit démarrer.");
  const health = await fetch(origin + "/health", { headers: { Origin: "http://tauri.localhost" } });
  assert.equal(health.headers.get("access-control-allow-origin"), "http://tauri.localhost");
  assert.deepEqual(await health.json(), { ok: true });
  assert.equal((await fetch(origin + "/projects")).status, 401);
  const internal = origin + "/internal/user/123456789012345678/projects";
  assert.equal((await fetch(internal)).status, 401);
  const authorized = await fetch(internal, { headers: { "x-internal-secret": secret } });
  assert.equal(authorized.status, 200);
  assert.ok(Array.isArray((await authorized.json()).projects));
  const start = await fetch(origin + "/auth/discord/start", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ codeChallenge: challenge }),
  });
  assert.equal(start.status, 200);
  const body = await start.json();
  flowState = body.state;
  const redirect = new URL(body.url);
  assert.equal(redirect.hostname, "discord.com");
  assert.equal(redirect.searchParams.get("redirect_uri"), origin + "/auth/discord/callback");
  const exchange = await fetch(origin + "/auth/discord/exchange", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state: flowState, codeVerifier: "W".repeat(43) }),
  });
  assert.equal(exchange.status, 400);
  console.log("API/PostgreSQL, CORS, routes protégées et refus PKCE vérifiés.");
} catch (error) {
  // Les réponses de test ne contiennent aucun identifiant OAuth réel.
  console.error(error instanceof Error ? error.message : "Test API échoué.");
  if (logs.includes("Can't reach database")) console.error("PostgreSQL indisponible pour le test.");
  process.exitCode = 1;
} finally {
  if (child.exitCode === null) {
    const stopped = once(child, "exit");
    child.kill("SIGTERM");
    const timeout = setTimeout(() => child.kill("SIGKILL"), 5000);
    await stopped;
    clearTimeout(timeout);
  }
  if (flowState) {
    const { prisma } = await import("../packages/database/src/index.ts");
    try { await prisma.authFlow.deleteMany({ where: { state: flowState, codeChallenge: challenge } }); }
    finally { await prisma.$disconnect(); }
  }
}
