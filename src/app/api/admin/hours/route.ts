import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getCafeHours, saveCafeHours } from "@/lib/services";
import { cafeHoursSchema } from "@/lib/validation";

export async function GET() {
  const gate = await requireAdmin();
  if ("error" in gate && gate.error) return gate.error;
  return NextResponse.json({ hours: getCafeHours() });
}

export async function PATCH(req: Request) {
  const gate = await requireAdmin();
  if ("error" in gate && gate.error) return gate.error;

  const body = await req.json().catch(() => ({}));
  const parsed = cafeHoursSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid hours" },
      { status: 400 }
    );
  }

  const hours = saveCafeHours(parsed.data);
  return NextResponse.json({ hours });
}
