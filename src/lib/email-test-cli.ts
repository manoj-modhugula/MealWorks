import nodemailer from "nodemailer";

const host = process.env.SMTP_HOST?.trim() || "";
const user = process.env.SMTP_USER?.trim() || "";
const pass = (process.env.SMTP_PASS || "").replace(/\s+/g, "");
const port = Number(process.env.SMTP_PORT || "465");
const secure =
  process.env.SMTP_SECURE === "true" ||
  process.env.SMTP_SECURE === "1" ||
  port === 465;

if (host.toLowerCase().includes("mail.me.com")) {
  console.warn(
    "iCloud SMTP often rejects OTP mail (HM108). Use smtp.gmail.com with a Gmail app password."
  );
}

if (!host || !user || !pass) {
  console.error(
    "SMTP is not ready. Set SMTP_HOST=smtp.gmail.com, SMTP_USER, and SMTP_PASS (Gmail app password) in .env"
  );
  process.exit(1);
}

const from =
  process.env.EMAIL_FROM?.trim() || `MealWorks <${user}>`;

console.log(`Sending test to ${user} via ${host}:${port}`);

const transport = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: { user, pass },
});

try {
  const info = await transport.sendMail({
    from,
    to: user,
    subject: "MealWorks mail test",
    text: "If you can read this, Gmail SMTP is working for MealWorks.",
    html: "<p>If you can read this, Gmail SMTP is working for MealWorks.</p>",
  });
  console.log("Sent.", info.messageId);
} catch (e) {
  console.error("Send failed:", e instanceof Error ? e.message : e);
  process.exit(1);
}
