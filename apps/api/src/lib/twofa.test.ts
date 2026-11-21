import { describe, expect, it } from "vitest";
import { generateCode, hashCode, verifyCode } from "./twofa";

describe("2FA", () => {
  it("génère 6 chiffres", () => { for (let i = 0; i < 200; i++) expect(generateCode()).toMatch(/^\d{6}$/); });
  it("accepte le bon code, refuse les autres", () => {
    const h = hashCode("secret", "state1", "123456");
    expect(verifyCode("secret", "state1", "123456", h)).toBe(true);
    expect(verifyCode("secret", "state1", "123457", h)).toBe(false);
    expect(verifyCode("secret", "state2", "123456", h)).toBe(false);
    expect(verifyCode("autre", "state1", "123456", h)).toBe(false);
  });
});
