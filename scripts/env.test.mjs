import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";


const source = readFileSync(new URL("./env.mjs", import.meta.url), "utf8");
function check(files, inherited, expected) {
  const directory = mkdtempSync(join(tmpdir(), "avenzia-env-test-"));
  try {
    mkdirSync(join(directory, "scripts"));
    writeFileSync(join(directory, "scripts/env.mjs"), source);
    for (const [name, contents] of Object.entries(files)) writeFileSync(join(directory, name), contents);
    const env = { ...process.env };
    delete env.AVENZIA_TEST_SETTING;
    if (inherited !== undefined) env.AVENZIA_TEST_SETTING = inherited;
    const result = spawnSync(process.execPath, [
      "--import", "./scripts/env.mjs",
      "--input-type=module", "-e", "console.log(process.env.AVENZIA_TEST_SETTING || '')",
    ], { cwd: directory, env, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), expected);
  } finally {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    rmSync(directory, { recursive: true, force: true });
  }
}
test(".env est charge depuis la racine", () => check({ ".env": "AVENZIA_TEST_SETTING=base" }, undefined, "base"));
test(".env.local a priorite et accepte le BOM", () => check({
  ".env": "AVENZIA_TEST_SETTING=base", ".env.local": "\uFEFFAVENZIA_TEST_SETTING=local",
}, undefined, "local"));
test("les variables systeme ont priorite", () => check({ ".env.local": "AVENZIA_TEST_SETTING=local" }, "systeme", "systeme"));
test("les fichiers restent facultatifs en CI", () => check({}, "github", "github"));
