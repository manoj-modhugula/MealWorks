import { NextResponse } from "next/server";
import { count, desc, eq, like, or } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin";
import { PEOPLE_PAGE_SIZE, peoplePageCount } from "@/lib/admin-view";
import { getDb, schema } from "@/lib/db";

/** List office employees for the admin suite. */
export async function GET(req: Request) {
  const gate = await requireAdmin();
  if ("error" in gate && gate.error) return gate.error;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim().replace(/[%_]/g, "");
  const requested = Number(url.searchParams.get("page") || 1);
  const db = getDb();
  const where = q
    ? or(
        like(schema.users.name, `%${q}%`),
        like(schema.users.email, `%${q}%`)
      )
    : undefined;

  const total =
    (where
      ? db.select({ n: count() }).from(schema.users).where(where).get()
      : db.select({ n: count() }).from(schema.users).get()
    )?.n ?? 0;
  const pageCount = peoplePageCount(total);
  const page = Math.min(
    Math.max(1, Number.isFinite(requested) ? Math.floor(requested) : 1),
    pageCount
  );
  const offset = (page - 1) * PEOPLE_PAGE_SIZE;

  const listed = (
    where
      ? db
          .select({
            id: schema.users.id,
            name: schema.users.name,
            email: schema.users.email,
            isAdmin: schema.users.isAdmin,
            blockedAt: schema.users.blockedAt,
          })
          .from(schema.users)
          .where(where)
          .orderBy(desc(schema.users.createdAt))
          .limit(PEOPLE_PAGE_SIZE)
          .offset(offset)
          .all()
      : db
          .select({
            id: schema.users.id,
            name: schema.users.name,
            email: schema.users.email,
            isAdmin: schema.users.isAdmin,
            blockedAt: schema.users.blockedAt,
          })
          .from(schema.users)
          .orderBy(desc(schema.users.createdAt))
          .limit(PEOPLE_PAGE_SIZE)
          .offset(offset)
          .all()
  ).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    isAdmin: u.isAdmin,
    isBlocked: Boolean(u.blockedAt),
  }));

  return NextResponse.json({
    users: listed,
    total,
    page,
    pageCount,
  });
}

/** Promote / demote admin (cannot demote yourself). */
export async function PATCH(req: Request) {
  const gate = await requireAdmin();
  if ("error" in gate && gate.error) return gate.error;
  const session = gate.session!;

  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId || "");
  const hasAdmin = typeof body.isAdmin === "boolean";
  const hasBlocked = typeof body.blocked === "boolean";

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  if (!hasAdmin && !hasBlocked) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
  if (userId === session.user.id && hasAdmin && !body.isAdmin) {
    return NextResponse.json(
      { error: "You cannot remove your own admin access." },
      { status: 400 }
    );
  }
  if (userId === session.user.id && hasBlocked && body.blocked) {
    return NextResponse.json(
      { error: "You cannot block yourself." },
      { status: 400 }
    );
  }

  const db = getDb();
  const target = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .get();
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const patch: { isAdmin?: boolean; blockedAt?: string | null } = {};
  if (hasAdmin) patch.isAdmin = body.isAdmin;
  if (hasBlocked) {
    patch.blockedAt = body.blocked ? new Date().toISOString() : null;
  }

  db.update(schema.users)
    .set(patch)
    .where(eq(schema.users.id, userId))
    .run();

  return NextResponse.json({
    ok: true,
    userId,
    isAdmin: hasAdmin ? body.isAdmin : target.isAdmin,
    blocked: hasBlocked ? body.blocked : Boolean(target.blockedAt),
  });
}
