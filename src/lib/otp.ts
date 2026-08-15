import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getDb, schema } from "./db";
import { isEmailConfigured, sendEmail } from "./email";
import {
  generateOtpCode,
  hashOtp,
  isOtpExpired,
  otpExpiryIso,
  otpMatches,
  remainingOtpAttempts,
} from "./identity";
import { nowISO } from "./utils";

export type OtpPurpose = "signup" | "reset" | "stepup";

export const OTP_PUBLIC_SENT =
  "If this email can be used, we sent a code.";

export const OTP_SEND_FAILED = "Couldn’t send the code. Try again.";

export function requireEmailDelivery(): string | null {
  if (isEmailConfigured()) return null;
  return "Email delivery is not configured. Set SMTP_* before creating or recovering accounts.";
}

export function issueOtp(input: {
  email: string;
  purpose: OtpPurpose;
  userId?: string | null;
}): { code: string; expiresAt: string } {
  const db = getDb();
  const email = input.email.trim().toLowerCase();
  db.delete(schema.emailOtps)
    .where(
      and(
        eq(schema.emailOtps.email, email),
        eq(schema.emailOtps.purpose, input.purpose)
      )
    )
    .run();

  const code = generateOtpCode();
  const expiresAt = otpExpiryIso();
  db.insert(schema.emailOtps)
    .values({
      id: randomUUID(),
      email,
      userId: input.userId ?? null,
      purpose: input.purpose,
      otpHash: hashOtp(code),
      expiresAt,
      attemptCount: 0,
      createdAt: nowISO(),
    })
    .run();
  return { code, expiresAt };
}

export function consumeOtp(input: {
  email: string;
  purpose: OtpPurpose;
  code: string;
}): { ok: true } | { ok: false; error: string } {
  const db = getDb();
  const email = input.email.trim().toLowerCase();
  const row = db
    .select()
    .from(schema.emailOtps)
    .where(
      and(
        eq(schema.emailOtps.email, email),
        eq(schema.emailOtps.purpose, input.purpose)
      )
    )
    .get();

  if (!row) return { ok: false, error: "Code is invalid or expired." };
  if (isOtpExpired(row.expiresAt)) {
    db.delete(schema.emailOtps).where(eq(schema.emailOtps.id, row.id)).run();
    return { ok: false, error: "Code is invalid or expired." };
  }
  if (remainingOtpAttempts(row.attemptCount) <= 0) {
    db.delete(schema.emailOtps).where(eq(schema.emailOtps.id, row.id)).run();
    return { ok: false, error: "Too many attempts. Request a new code." };
  }
  if (!otpMatches(input.code, row.otpHash)) {
    db.update(schema.emailOtps)
      .set({ attemptCount: row.attemptCount + 1 })
      .where(eq(schema.emailOtps.id, row.id))
      .run();
    return { ok: false, error: "Code is invalid or expired." };
  }
  db.delete(schema.emailOtps).where(eq(schema.emailOtps.id, row.id)).run();
  return { ok: true };
}

export async function sendOtpMail(input: {
  to: string;
  purpose: OtpPurpose;
  code: string;
}) {
  const label =
    input.purpose === "signup"
      ? "Confirm your MealWorks email"
      : input.purpose === "reset"
        ? "Reset your MealWorks password"
        : "Confirm a MealWorks account change";
  const text = `Your MealWorks code is ${input.code}. It expires in 10 minutes. If you did not request this, ignore this email.`;
  const html = `<p style="font:16px/1.5 sans-serif">Your MealWorks code is <strong style="letter-spacing:0.12em">${input.code}</strong>.</p><p style="font:14px/1.5 sans-serif;color:#555">It expires in 10 minutes. If you did not request this, you can ignore this email.</p>`;
  const sent = await sendEmail({
    to: input.to,
    subject: label,
    text,
    html,
  });
  if (!sent.ok) return { ok: false as const, error: OTP_SEND_FAILED };
  return sent;
}
