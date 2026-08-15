import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getMenuForDate, listDishNotes } from "@/lib/services";

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
  const starsRaw = url.searchParams.get("stars");
  const stars = starsRaw ? Number(starsRaw) : null;
  return NextResponse.json(
    listDishNotes({
      menuDayId: menu.id,
      dishName: dish,
      stars: stars != null && Number.isFinite(stars) ? stars : null,
      cursor: url.searchParams.get("cursor"),
      limit: 20,
    })
  );
}
