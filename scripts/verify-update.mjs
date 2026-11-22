import { createHash, createPublicKey, verify } from "node:crypto";

export function verifyUpdate(binary, encodedSignature, encodedPublicKey, expectedVersion) {
  const publicLines = Buffer.from(encodedPublicKey.trim(), "base64").toString("utf8").split(/\r?\n/);
  const signatureLines = Buffer.from(encodedSignature.trim(), "base64").toString("utf8").split(/\r?\n/);
  const publicPacket = Buffer.from(publicLines[1] || "", "base64");
  const packet = Buffer.from(signatureLines[1] || "", "base64");
  const globalSignature = Buffer.from(signatureLines[3] || "", "base64");
  const trustedPrefix = "trusted comment: ";
  if (publicPacket.length !== 42 || packet.length !== 74 || globalSignature.length !== 64 ||
      !signatureLines[2]?.startsWith(trustedPrefix) ||
      !["Ed", "ED"].includes(publicPacket.subarray(0, 2).toString()) ||
      !["Ed", "ED"].includes(packet.subarray(0, 2).toString())) {
    throw new Error("Format de signature de mise à jour invalide.");
  }
  if (!publicPacket.subarray(2, 10).equals(packet.subarray(2, 10))) {
    throw new Error("La clé de signature diffère de la clé publique installée.");
  }
  const key = createPublicKey({
    key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), publicPacket.subarray(10)]),
    format: "der", type: "spki",
  });
  const payload = packet.subarray(0, 2).toString() === "ED"
    ? createHash("blake2b512").update(binary).digest() : binary;
  const signature = packet.subarray(10);
  const comment = Buffer.from(signatureLines[2].slice(trustedPrefix.length), "utf8");
  if (!verify(null, payload, key, signature) ||
      !verify(null, Buffer.concat([signature, comment]), key, globalSignature)) {
    throw new Error("Signature de mise à jour non valide.");
  }
  if (expectedVersion) {
    const field = comment.toString("utf8").split("\t").find(value => value.startsWith("version:"));
    if (!field || field.slice("version:".length).replace(/^v/, "") !== expectedVersion.replace(/^v/, "")) {
      throw new Error("La version annoncée ne correspond pas à la version signée.");
    }
  }
}
