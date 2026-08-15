import { and, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { getDb, schema } from "./db";
import {
  allowedEmailDomainsFromEnv,
  assertPasswordOk,
  isEmailDomainAllowed,
  otpExpiryIso,
} from "./identity";
import {
  OTP_PUBLIC_SENT,
  consumeOtp,
  issueOtp,
  requireEmailDelivery,
  sendOtpMail,
} from "./otp";
import { nowISO } from "./utils";

const GENERIC = OTP_PUBLIC_SENT;

function emailAllowed(email: string): boolean {
  return isEmailDomainAllowed(email, allowedEmailDomainsFromEnv());
}

export async function startSignup(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const mail = requireEmailDelivery();
  if (mail) return { ok: false, error: mail };

  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!name || !email.includes("@")) {
    return { ok: false, error: "Name and a valid email are required." };
  }
  if (!emailAllowed(email)) {
    return { ok: true, message: GENERIC };
  }
  const pw = assertPasswordOk(input.password, email);
  if (pw) return { ok: false, error: pw };

  const db = getDb();
  const existing = db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .get();
  if (existing) {
    return { ok: true, message: GENERIC };
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  db.delete(schema.pendingSignups)
    .where(eq(schema.pendingSignups.email, email))
    .run();
  db.insert(schema.pendingSignups)
    .values({
      email,
      name,
      passwordHash,
      expiresAt: otpExpiryIso(),
      createdAt: nowISO(),
    })
    .run();

  const { code } = issueOtp({ email, purpose: "signup" });
  const sent = await sendOtpMail({ to: email, purpose: "signup", code });
  if (!sent.ok) return { ok: false, error: sent.error };
  return { ok: true, message: GENERIC };
}

export async function confirmSignup(input: { email: string; code: string }) {
  const email = input.email.trim().toLowerCase();
  const check = consumeOtp({ email, purpose: "signup", code: input.code });
  if (!check.ok) return check;

  const db = getDb();
  const pending = db
    .select()
    .from(schema.pendingSignups)
    .where(eq(schema.pendingSignups.email, email))
    .get();
  if (!pending) return { ok: false as const, error: "Code is invalid or expired." };

  const already = db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .get();
  db.delete(schema.pendingSignups)
    .where(eq(schema.pendingSignups.email, email))
    .run();
  if (already) return { ok: false as const, error: "Code is invalid or expired." };

  const now = nowISO();
  const id = randomUUID();
  db.insert(schema.users)
    .values({
      id,
      name: pending.name,
      email,
      passwordHash: pending.passwordHash,
      isAdmin: false,
      emailVerifiedAt: now,
      createdAt: now,
    })
    .run();
  db.insert(schema.preferenceProfiles)
    .values({ userId: id, updatedAt: now })
    .run();

  return { ok: true as const, email, passwordReady: true };
}

export async function resendSignup(emailRaw: string) {
  const mail = requireEmailDelivery();
  if (mail) return { ok: false as const, error: mail };
  const email = emailRaw.trim().toLowerCase();
  const pending = getDb()
    .select()
    .from(schema.pendingSignups)
    .where(eq(schema.pendingSignups.email, email))
    .get();
  if (!pending) return { ok: true as const, message: GENERIC };
  const { code } = issueOtp({ email, purpose: "signup" });
  const sent = await sendOtpMail({ to: email, purpose: "signup", code });
  if (!sent.ok) return { ok: false as const, error: sent.error };
  return { ok: true as const, message: GENERIC };
}

export async function startReset(emailRaw: string) {
  const mail = requireEmailDelivery();
  if (mail) return { ok: false as const, error: mail };
  const email = emailRaw.trim().toLowerCase();
  const user = getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .get();
  if (!user?.passwordHash || !user.emailVerifiedAt) {
    return { ok: true as const, message: GENERIC };
  }
  const { code } = issueOtp({ email, purpose: "reset", userId: user.id });
  const sent = await sendOtpMail({ to: email, purpose: "reset", code });
  if (!sent.ok) return { ok: false as const, error: sent.error };
  return { ok: true as const, message: GENERIC };
}

export async function confirmReset(input: {
  email: string;
  code: string;
  newPassword: string;
}) {
  const email = input.email.trim().toLowerCase();
  const pw = assertPasswordOk(input.newPassword, email);
  if (pw) return { ok: false as const, error: pw };
  const check = consumeOtp({ email, purpose: "reset", code: input.code });
  if (!check.ok) return check;
  const db = getDb();
  const user = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .get();
  if (!user) return { ok: false as const, error: "Code is invalid or expired." };
  const passwordHash = await bcrypt.hash(input.newPassword, 10);
  db.update(schema.users)
    .set({ passwordHash, emailVerifiedAt: user.emailVerifiedAt || nowISO() })
    .where(eq(schema.users.id, user.id))
    .run();
  return { ok: true as const };
}

export async function startStepUp(userId: string) {
  const mail = requireEmailDelivery();
  if (mail) return { ok: false as const, error: mail };
  const user = getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .get();
  if (!user?.email) return { ok: false as const, error: "Account not found." };
  const { code } = issueOtp({
    email: user.email,
    purpose: "stepup",
    userId: user.id,
  });
  const sent = await sendOtpMail({ to: user.email, purpose: "stepup", code });
  if (!sent.ok) return { ok: false as const, error: sent.error };
  return { ok: true as const, message: GENERIC };
}

export function verifyStepUp(email: string, code: string) {
  return consumeOtp({
    email: email.trim().toLowerCase(),
    purpose: "stepup",
    code,
  });
}

export function upsertOAuthUser(input: {
  email: string;
  name: string;
  provider: string;
  providerAccountId: string;
  emailVerified?: boolean;
}) {
  const email = input.email.trim().toLowerCase();
  if (email && !emailAllowed(email)) return null;
  const db = getDb();
  const now = nowISO();

  const linked = db
    .select()
    .from(schema.oauthAccounts)
    .where(
      and(
        eq(schema.oauthAccounts.provider, input.provider),
        eq(schema.oauthAccounts.providerAccountId, input.providerAccountId)
      )
    )
    .get();

  if (linked) {
    const owner = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, linked.userId))
      .get();
    if (!owner || owner.blockedAt) return null;
    if (email) {
      const emailOwner = db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, email))
        .get();
      if (emailOwner && emailOwner.id !== owner.id) return null;
    }
    return owner;
  }

  if (!email) return null;
  if (!input.emailVerified) return null;

  const existing = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .get();

  let user = existing;
  if (existing) {
    if (existing.blockedAt) return null;
    const hasPassword = Boolean(existing.passwordHash);
    if (hasPassword) return null;
  } else {
    const id = randomUUID();
    db.insert(schema.users)
      .values({
        id,
        name: input.name.trim() || email.split("@")[0] || "Member",
        email,
        passwordHash: "",
        isAdmin: false,
        emailVerifiedAt: now,
        createdAt: now,
      })
      .run();
    db.insert(schema.preferenceProfiles)
      .values({ userId: id, updatedAt: now })
      .run();
    user = db.select().from(schema.users).where(eq(schema.users.id, id)).get();
  }

  if (!user) return null;
  db.insert(schema.oauthAccounts)
    .values({
      id: randomUUID(),
      userId: user.id,
      provider: input.provider,
      providerAccountId: input.providerAccountId,
    })
    .run();
  return user;
}

export function deleteUserAccount(userId: string) {
  const db = getDb();
  db.delete(schema.oauthAccounts)
    .where(eq(schema.oauthAccounts.userId, userId))
    .run();
  db.delete(schema.users).where(eq(schema.users.id, userId)).run();
}

export function listLinkedProviders(userId: string) {
  return getDb()
    .select({ provider: schema.oauthAccounts.provider })
    .from(schema.oauthAccounts)
    .where(eq(schema.oauthAccounts.userId, userId))
    .all()
    .map((r) => r.provider);
}
