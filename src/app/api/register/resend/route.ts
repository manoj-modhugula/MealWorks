import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { emailOnlySchema } from "@/lib/validation";
import { resendSignup } from "@/lib/identity-account";

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`register-resend:${ip}`, {
    limit: 6,
    windowMs: 15 * 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = emailOnlySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Email required." }, { status: 400 });
  }
  const result = await resendSignup(parsed.data.email);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, message: result.message });
}
