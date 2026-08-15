import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { addMenuItemRow, updateMenuItemRow } from "@/lib/services";
import { menuItemCreateSchema, menuItemPatchSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if ("error" in gate && gate.error) return gate.error;
  const body = await req.json().catch(() => ({}));
  const parsed = menuItemCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid" },
      { status: 400 }
    );
  }
  try {
    const menu = addMenuItemRow(parsed.data);
    return NextResponse.json({ ok: true, menu });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Create failed" },
      { status: 400 }
    );
  }
}

export async function PATCH(req: Request) {
  const gate = await requireAdmin();
  if ("error" in gate && gate.error) return gate.error;

  const body = await req.json().catch(() => ({}));
  const parsed = menuItemPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid" },
      { status: 400 }
    );
  }
  try {
    const menu = updateMenuItemRow(parsed.data);
    return NextResponse.json({ ok: true, menu });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 400 }
    );
  }
}
