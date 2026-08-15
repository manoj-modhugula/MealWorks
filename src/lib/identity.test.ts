import { describe, expect, it } from "vitest";
import {
  assertPasswordOk,
  generateOtpCode,
  hashOtp,
  isEmailDomainAllowed,
  isOtpExpired,
  otpMatches,
  remainingOtpAttempts,
} from "./identity";

describe("assertPasswordOk", () => {
  it("rejects passwords shorter than 10", () => {
    expect(assertPasswordOk("Short1!", "ada@office.com")).toMatch(/10/);
  });

  it("rejects the word password", () => {
    expect(assertPasswordOk("Password12", "ada@office.com")).toMatch(/common/i);
  });

  it("rejects the email local part", () => {
    expect(assertPasswordOk("adaadaada1", "ada@office.com")).toMatch(/email/i);
  });

  it("accepts a long unique password", () => {
    expect(assertPasswordOk("correct-horse-battery", "ada@office.com")).toBeNull();
  });
});

describe("isEmailDomainAllowed", () => {
  it("allows any inbox when the allowlist is empty", () => {
    expect(isEmailDomainAllowed("anyone@gmail.com", [])).toBe(true);
  });

  it("allows a listed office domain", () => {
    expect(isEmailDomainAllowed("ada@Office.com", ["office.com"])).toBe(true);
  });

  it("rejects a domain outside the allowlist", () => {
    expect(isEmailDomainAllowed("ada@gmail.com", ["office.com"])).toBe(false);
  });
});

describe("otp primitives", () => {
  it("generates a 6-digit code", () => {
    const code = generateOtpCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it("hashes so the raw code is not recoverable from the hash", () => {
    const hash = hashOtp("123456");
    expect(hash).not.toContain("123456");
    expect(hash.length).toBeGreaterThan(20);
  });

  it("matches only the original code", () => {
    const hash = hashOtp("482910");
    expect(otpMatches("482910", hash)).toBe(true);
    expect(otpMatches("000000", hash)).toBe(false);
  });

  it("expires after the deadline", () => {
    const expires = new Date("2026-08-13T12:10:00.000Z").toISOString();
    expect(isOtpExpired(expires, new Date("2026-08-13T12:09:59.000Z"))).toBe(
      false
    );
    expect(isOtpExpired(expires, new Date("2026-08-13T12:10:00.000Z"))).toBe(
      true
    );
  });

  it("locks after 5 failed attempts", () => {
    expect(remainingOtpAttempts(0)).toBe(5);
    expect(remainingOtpAttempts(4)).toBe(1);
    expect(remainingOtpAttempts(5)).toBe(0);
  });
});
