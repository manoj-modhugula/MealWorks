import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { emailOnlySchema, resetConfirmSchema } from "@/lib/validation";
import { confirmReset, startReset } from "@/lib/identity-account";

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`forgot:${ip}`, { limit: 8, windowMs: 15 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  if (body?.code && body?.newPassword) {
    const parsed = resetConfirmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid reset." },
        { status: 400 }
      );
    }
    const result = await confirmReset(parsed.data);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, message: "Password updated. Sign in." });
  }

  const parsed = emailOnlySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Email required." }, { status: 400 });
  }
  const result = await startReset(parsed.data.email);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, pending: true, message: result.message });
}
