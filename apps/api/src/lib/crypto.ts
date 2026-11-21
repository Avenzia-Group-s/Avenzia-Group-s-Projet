import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const sha256Hex = (v: string) => createHash("sha256").update(v).digest("hex");
export const sha256B64Url = (v: string) => createHash("sha256").update(v).digest("base64url");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const randomHex = (bytes = 32) => randomBytes(bytes).toString("hex");

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
