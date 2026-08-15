import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { otpVerifySchema } from "@/lib/validation";
import { confirmSignup } from "@/lib/identity-account";

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`register-verify:${ip}`, {
    limit: 20,
    windowMs: 15 * 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = otpVerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter the 6-digit code from your email." },
      { status: 400 }
    );
  }

  const result = await confirmSignup(parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    email: result.email,
    message: "Email confirmed. Signing you in…",
  });
}
