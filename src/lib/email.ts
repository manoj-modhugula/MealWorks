/**
 * SMTP email (iCloud, Gmail, etc.) via Nodemailer.
 * Configure with SMTP_HOST / SMTP_USER / SMTP_PASS / EMAIL_FROM.
 */

import nodemailer from "nodemailer";

export function isEmailConfigured() {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim()
  );
}

function fromAddress() {
  const user = process.env.SMTP_USER?.trim();
  const host = (process.env.SMTP_HOST || "").toLowerCase();
  // iCloud only accepts the authenticated mailbox, often without a display name.
  if (user && host.includes("mail.me.com")) return user;
  const configured = process.env.EMAIL_FROM?.trim();
  if (user && configured) {
    const angle = configured.match(/<([^>]+)>/);
    const configuredAddr = (angle?.[1] || configured).trim().toLowerCase();
    if (configuredAddr !== user.toLowerCase()) {
      return `MealWorks <${user}>`;
    }
  }
  if (configured) return configured;
  if (user) return `MealWorks <${user}>`;
  return "MealWorks <noreply@localhost>";
}

function createTransport() {
  const host = process.env.SMTP_HOST!.trim();
  const port = Number(process.env.SMTP_PORT || "587");
  const secure =
    process.env.SMTP_SECURE === "true" ||
    process.env.SMTP_SECURE === "1" ||
    port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER!.trim(),
      // App passwords may be pasted with spaces/hyphens
      pass: process.env.SMTP_PASS!.replace(/\s+/g, ""),
    },
  });
}

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type SendEmailResult =
  | { ok: true; messageId?: string }
  | { ok: false; error: string };

export async function sendEmail(
  input: SendEmailInput
): Promise<SendEmailResult> {
  if (!isEmailConfigured()) {
    return { ok: false, error: "Email not configured (set SMTP_* in .env)" };
  }
  const host = (process.env.SMTP_HOST || "").toLowerCase();
  if (host.includes("mail.me.com")) {
    console.warn(
      "[email] iCloud SMTP often rejects OTP mail (HM108). Use smtp.gmail.com with a Gmail app password."
    );
  }
  const to = input.to.trim().toLowerCase();
  if (!to || !to.includes("@")) {
    return { ok: false, error: "Invalid recipient email" };
  }

  try {
    const transport = createTransport();
    const info = await transport.sendMail({
      from: fromAddress(),
      to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return { ok: true, messageId: info.messageId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Send failed";
    console.error("[email]", msg);
    return { ok: false, error: msg };
  }
}
