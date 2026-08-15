import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getDishNoteSummary, getMenuForDate } from "@/lib/services";

export async function GET(req: Request) {
  const gate = await requireAdmin();
  if ("error" in gate && gate.error) return gate.error;
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  const dish = url.searchParams.get("dish");
  if (!date || !dish) {
    return NextResponse.json(
      { error: "date and dish required" },
      { status: 400 }
    );
  }
  const menu = getMenuForDate(date);
  if (!menu) {
    return NextResponse.json({ error: "No menu" }, { status: 404 });
  }
  const summary = await getDishNoteSummary(menu.id, dish);
  return NextResponse.json({ summary });
}
