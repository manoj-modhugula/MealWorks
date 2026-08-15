import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getMenuForDate, listMenuFeedback } from "@/lib/services";

export async function GET(req: Request) {
  const gate = await requireAdmin();
  if ("error" in gate && gate.error) return gate.error;
  const date = new URL(req.url).searchParams.get("date");
  if (!date) {
    return NextResponse.json({ error: "date required" }, { status: 400 });
  }
  const menu = getMenuForDate(date);
  if (!menu) {
    return NextResponse.json({ dishes: [], date });
  }
  return NextResponse.json({
    date,
    dishes: listMenuFeedback(menu.id),
  });
}
