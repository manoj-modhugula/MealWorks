import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { processMenuImage } from "@/lib/services";
import { todayISO } from "@/lib/utils";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!session.user.isAdmin) {
    return { error: NextResponse.json({ error: "Admin only" }, { status: 403 }) };
  }
  return { session };
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if ("error" in gate && gate.error) return gate.error;
  const session = gate.session!;

  try {
    const form = await req.formData();
    const file = form.get("file");
    const date = String(form.get("date") || todayISO());

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }

    const maxBytes = 12 * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: "File too large (max 12 MB)." },
        { status: 400 }
      );
    }
    const { isMenuUploadFile } = await import("@/lib/admin-view");
    if (!isMenuUploadFile(file.name, file.type)) {
      return NextResponse.json(
        { error: "Use a photo or a PDF." },
        { status: 400 }
      );
    }

    // Sanitize date to prevent path traversal in filenames
    const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayISO();
    const buf = Buffer.from(await file.arrayBuffer());
    const rawExt = path.extname(file.name).toLowerCase();
    const ext = [
      ".png",
      ".jpg",
      ".jpeg",
      ".webp",
      ".gif",
      ".heic",
      ".heif",
      ".pdf",
    ].includes(rawExt)
      ? rawExt
      : file.type === "application/pdf"
        ? ".pdf"
        : ".png";
    const filename = `${safeDate}-${randomUUID()}${ext}`;

    // Save under Images/ (project root) and public/uploads for browser serving
    const imagesDir = path.join(process.cwd(), "Images");
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "menus");
    fs.mkdirSync(imagesDir, { recursive: true });
    fs.mkdirSync(uploadsDir, { recursive: true });

    const imagesPath = path.join(imagesDir, filename);
    const diskPath = path.join(uploadsDir, filename);
    fs.writeFileSync(imagesPath, buf);
    fs.writeFileSync(diskPath, buf);

    const publicPath = `/uploads/menus/${filename}`;
    const result = await processMenuImage({
      imagePath: diskPath,
      date: safeDate,
      createdBy: session.user.id,
    });

    // Store public path + wipe everyone's cached match for this menu
    // so each employee gets a fresh personal board on next open
    const { getDb, schema } = await import("@/lib/db");
    const { eq } = await import("drizzle-orm");
    getDb()
      .update(schema.menuDays)
      .set({ sourceImagePath: publicPath })
      .where(eq(schema.menuDays.id, result.menuDayId))
      .run();
    getDb()
      .delete(schema.matchResults)
      .where(eq(schema.matchResults.menuDayId, result.menuDayId))
      .run();

    return NextResponse.json({
      ok: true,
      menuDayId: result.menuDayId,
      source: result.source,
      model: "model" in result ? result.model : undefined,
      menu: result.menu,
      imagePath: publicPath,
      savedTo: ["Images/" + filename, "public/uploads/menus/" + filename],
      matchesInvalidated: true,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
