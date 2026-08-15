import { createHash, randomInt, timingSafeEqual } from "crypto";

const MIN_PASSWORD = 10;
const OTP_ATTEMPTS = 5;

const COMMON = new Set([
  "password",
  "password1",
  "password12",
  "password123",
  "1234567890",
  "qwertyuiop",
]);

/** Returns an error message, or null if the password is acceptable. */
export function assertPasswordOk(password: string, email: string): string | null {
  if (!password || password.length < MIN_PASSWORD) {
    return `Use at least ${MIN_PASSWORD} characters.`;
  }
  const folded = password.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (COMMON.has(password.toLowerCase()) || COMMON.has(folded)) {
    return "That password is too common.";
  }
  const local = email.split("@")[0]?.toLowerCase() || "";
  if (local.length >= 3 && password.toLowerCase().includes(local)) {
    return "Do not include your email in the password.";
  }
  return null;
}

export function isEmailDomainAllowed(
  email: string,
  allowedDomains: string[]
): boolean {
  if (!allowedDomains.length) return true;
  const domain = email.split("@")[1]?.trim().toLowerCase();
  if (!domain) return false;
  const allow = new Set(allowedDomains.map((d) => d.trim().toLowerCase()).filter(Boolean));
  return allow.has(domain);
}

export function allowedEmailDomainsFromEnv(
  raw = process.env.ALLOWED_EMAIL_DOMAINS
): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,\s]+/)
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashOtp(code: string): string {
  return createHash("sha256").update(code.trim(), "utf8").digest("hex");
}

export function otpMatches(code: string, hash: string): boolean {
  const next = hashOtp(code);
  if (next.length !== hash.length) return false;
  try {
    return timingSafeEqual(Buffer.from(next, "hex"), Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

export function isOtpExpired(expiresAt: string, now = new Date()): boolean {
  return now.getTime() >= new Date(expiresAt).getTime();
}

export function remainingOtpAttempts(attemptCount: number): number {
  return Math.max(0, OTP_ATTEMPTS - attemptCount);
}

export function otpExpiryIso(now = new Date(), minutes = 10): string {
  return new Date(now.getTime() + minutes * 60_000).toISOString();
}

export const OTP_MAX_ATTEMPTS = OTP_ATTEMPTS;
export const MIN_PASSWORD_LENGTH = MIN_PASSWORD;
