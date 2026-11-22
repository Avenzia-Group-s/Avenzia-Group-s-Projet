import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign, createHash } from "node:crypto";
import { verifyUpdate } from "./verify-update.mjs";

function fixture(algorithm = "ED", version) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const bytes = Buffer.from("Avenzia test installer");
  const id = Buffer.from("0102030405060708", "hex");
  const rawPublic = publicKey.export({ type: "spki", format: "der" }).subarray(-32);
  const publicPacket = Buffer.concat([Buffer.from("Ed"), id, rawPublic]).toString("base64");
  const key = Buffer.from("untrusted comment: test\n" + publicPacket + "\n").toString("base64");
  const payload = algorithm === "ED" ? createHash("blake2b512").update(bytes).digest() : bytes;
  const signature = sign(null, payload, privateKey);
  const packet = Buffer.concat([Buffer.from(algorithm), id, signature]).toString("base64");
  const comment = "timestamp:test" + (version ? "\tversion:" + version : "");
  const global = sign(null, Buffer.concat([signature, Buffer.from(comment)]), privateKey).toString("base64");
  const signed = Buffer.from("untrusted comment: test\n" + packet + "\ntrusted comment: " + comment + "\n" + global + "\n").toString("base64");
  return { bytes, key, signed };
}
test("verifie une signature Minisign prehachee", () => {
  const f = fixture();
  assert.doesNotThrow(() => verifyUpdate(f.bytes, f.signed, f.key));
});
test("verifie une signature Minisign Ed25519 historique", () => {
  const f = fixture("Ed");
  assert.doesNotThrow(() => verifyUpdate(f.bytes, f.signed, f.key));
});
test("rejette un installateur modifie", () => {
  const f = fixture();
  assert.throws(() => verifyUpdate(Buffer.from("modified"), f.signed, f.key));
});
test("rejette une autre cle", () => {
  const f = fixture();
  assert.throws(() => verifyUpdate(f.bytes, f.signed, fixture().key));
});
test("rejette un commentaire de signature modifie", () => {
  const f = fixture();
  const modified = Buffer.from(Buffer.from(f.signed, "base64").toString().replace("timestamp:test", "timestamp:fake")).toString("base64");
  assert.throws(() => verifyUpdate(f.bytes, modified, f.key));
});
test("rejette une signature mal formee", () => {
  const f = fixture();
  assert.throws(() => verifyUpdate(f.bytes, "invalid", f.key));
});

test("verifie la version liee cryptographiquement a la signature", () => {
  const f = fixture("ED", "0.1.1");
  assert.doesNotThrow(() => verifyUpdate(f.bytes, f.signed, f.key, "0.1.1"));
  assert.throws(() => verifyUpdate(f.bytes, f.signed, f.key, "9.0.0"));
});
test("rejette une signature sans version quand la version est exigee", () => {
  const f = fixture();
  assert.throws(() => verifyUpdate(f.bytes, f.signed, f.key, "0.1.1"));
});
