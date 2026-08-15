import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validation";
import { startSignup } from "@/lib/identity-account";

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`register:${ip}`, { limit: 8, windowMs: 15 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ||
          "Name, email, and a password (10+ characters) are required.",
      },
      { status: 400 }
    );
  }

  const emailRl = rateLimit(`register-email:${parsed.data.email.toLowerCase()}`, {
    limit: 3,
    windowMs: 15 * 60_000,
  });
  if (!emailRl.ok) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${emailRl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  const result = await startSignup(parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    pending: true,
    email: parsed.data.email.trim().toLowerCase(),
    message: result.message,
  });
}
