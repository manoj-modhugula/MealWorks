import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserById, updateAccount } from "@/lib/services";
import { accountDeleteSchema, accountUpdateSchema } from "@/lib/validation";
import { deleteUserAccount, verifyStepUp } from "@/lib/identity-account";

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = accountUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid" },
      { status: 400 }
    );
  }
  try {
    const user = await updateAccount(session.user.id, parsed.data);
    return NextResponse.json({
      ok: true,
      user: user
        ? { id: user.id, name: user.name, email: user.email, isAdmin: user.isAdmin }
        : null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 400 }
    );
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = accountDeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Confirm with the code and your email." },
      { status: 400 }
    );
  }
  const user = getUserById(session.user.id);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (parsed.data.confirmEmail.trim().toLowerCase() !== user.email) {
    return NextResponse.json(
      { error: "Email confirmation did not match." },
      { status: 400 }
    );
  }
  const otp = verifyStepUp(user.email, parsed.data.otp);
  if (!otp.ok) {
    return NextResponse.json({ error: otp.error }, { status: 400 });
  }
  deleteUserAccount(user.id);
  return NextResponse.json({ ok: true });
}
