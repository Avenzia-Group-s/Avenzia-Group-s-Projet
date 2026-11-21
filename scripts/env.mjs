import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { parseEnv } from "node:util";

export const projectRoot = fileURLToPath(new URL("../", import.meta.url));
export const envFiles = [".env", ".env.local"].filter(name =>
  existsSync(join(projectRoot, name)),
);
const values = {};
for (const name of envFiles) {
  Object.assign(values, parseEnv(readFileSync(join(projectRoot, name), "utf8").replace(/^\uFEFF/, "")));
}
// Les variables fournies par le système ou GitHub Actions ont priorité.
for (const [name, value] of Object.entries(values)) {
  if (process.env[name] === undefined) process.env[name] = value;
}
