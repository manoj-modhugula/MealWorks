import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import * as schema from "./schema";

/**
 * Seeded cafe admin for local development.
 * Credentials come from environment variables (see README). Never expose on public UI.
 */
export const SEED_ADMIN = {
  email: (process.env.ADMIN_EMAIL || "cafe.admin@example.com").trim().toLowerCase(),
  password: process.env.ADMIN_PASSWORD || "MenuAdmin@2026",
  name: process.env.ADMIN_NAME || "Cafe Admin",
};

const globalForDb = globalThis as unknown as {
  __mealworksDb?: ReturnType<typeof drizzle<typeof schema>>;
  __mealworksSqlite?: Database.Database;
  __mealworksSeeded?: boolean;
};

function ensureSchema(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS preference_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      diet_type TEXT NOT NULL DEFAULT 'non_veg',
      hard_avoids_json TEXT NOT NULL DEFAULT '[]',
      soft_dislikes_json TEXT NOT NULL DEFAULT '[]',
      likes_json TEXT NOT NULL DEFAULT '[]',
      goals_json TEXT NOT NULL DEFAULT '[]',
      allergies_json TEXT NOT NULL DEFAULT '[]',
      freeform_notes TEXT NOT NULL DEFAULT '',
      ai_interpretation_json TEXT,
      user_facing_summary TEXT NOT NULL DEFAULT '',
      email_enabled INTEGER NOT NULL DEFAULT 0,
      email_time_local TEXT NOT NULL DEFAULT '07:00',
      timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
      onboarding_completed INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS temporary_restrictions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      avoid_tags_json TEXT NOT NULL DEFAULT '[]',
      starts_on TEXT NOT NULL,
      ends_on TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS menu_days (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      source_image_path TEXT,
      raw_model_json TEXT NOT NULL,
      created_by TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      menu_day_id TEXT NOT NULL REFERENCES menu_days(id) ON DELETE CASCADE,
      meal TEXT NOT NULL,
      station TEXT NOT NULL,
      name TEXT NOT NULL,
      tags_json TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS match_results (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      menu_day_id TEXT NOT NULL REFERENCES menu_days(id) ON DELETE CASCADE,
      verdict TEXT NOT NULL,
      score INTEGER NOT NULL,
      headline TEXT NOT NULL,
      summary TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS digest_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      menu_day_id TEXT NOT NULL REFERENCES menu_days(id) ON DELETE CASCADE,
      channel TEXT NOT NULL DEFAULT 'in_app',
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dish_feedback (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      menu_day_id TEXT NOT NULL REFERENCES menu_days(id) ON DELETE CASCADE,
      dish_name TEXT NOT NULL,
      vote TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_match_user_menu
      ON match_results(user_id, menu_day_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_user_menu
      ON dish_feedback(user_id, menu_day_id);

    CREATE TABLE IF NOT EXISTS pending_signups (
      email TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS email_otps (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      user_id TEXT,
      purpose TEXT NOT NULL,
      otp_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_otp_email_purpose
      ON email_otps(email, purpose);

    CREATE TABLE IF NOT EXISTS oauth_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      UNIQUE (provider, provider_account_id)
    );

    CREATE TABLE IF NOT EXISTS cafe_settings (
      id TEXT PRIMARY KEY,
      breakfast_start TEXT NOT NULL DEFAULT '08:00',
      breakfast_end TEXT NOT NULL DEFAULT '09:30',
      lunch_start TEXT NOT NULL DEFAULT '11:30',
      lunch_end TEXT NOT NULL DEFAULT '14:30',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dish_note_summaries (
      menu_day_id TEXT NOT NULL REFERENCES menu_days(id) ON DELETE CASCADE,
      dish_name TEXT NOT NULL,
      sentence TEXT NOT NULL,
      note_count INTEGER NOT NULL,
      latest_created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (menu_day_id, dish_name)
    );
  `);

  migrateUsers(sqlite);
  migrateFeedback(sqlite);
  seedCafeHours(sqlite);
}

function tableColumns(sqlite: Database.Database, table: string): Set<string> {
  const rows = sqlite.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
  }[];
  return new Set(rows.map((r) => r.name));
}

function migrateUsers(sqlite: Database.Database) {
  const cols = tableColumns(sqlite, "users");
  if (!cols.has("email_verified_at")) {
    sqlite.exec(`ALTER TABLE users ADD COLUMN email_verified_at TEXT`);
  }
  if (!cols.has("blocked_at")) {
    sqlite.exec(`ALTER TABLE users ADD COLUMN blocked_at TEXT`);
  }
  // Grandfather existing rows so a 0.x office is not locked out.
  sqlite
    .prepare(
      `UPDATE users SET email_verified_at = COALESCE(email_verified_at, created_at)
       WHERE email_verified_at IS NULL`
    )
    .run();
}

/**
 * Ensures a known cafe-admin account exists.
 * Password is only force-reset when ADMIN_RESET_ON_BOOT=1 (never in production
 * unless that flag is set).
 */
function migrateFeedback(sqlite: Database.Database) {
  const cols = tableColumns(sqlite, "dish_feedback");
  if (!cols.has("stars")) {
    sqlite.exec(`ALTER TABLE dish_feedback ADD COLUMN stars INTEGER`);
  }
  if (!cols.has("note")) {
    sqlite.exec(`ALTER TABLE dish_feedback ADD COLUMN note TEXT NOT NULL DEFAULT ''`);
  }
}

function seedCafeHours(sqlite: Database.Database) {
  const existing = sqlite
    .prepare("SELECT id FROM cafe_settings WHERE id = ?")
    .get("default") as { id: string } | undefined;
  if (existing) return;
  sqlite
    .prepare(
      `INSERT INTO cafe_settings (
         id, breakfast_start, breakfast_end, lunch_start, lunch_end, updated_at
       ) VALUES (?, '08:00', '09:30', '11:30', '14:30', ?)`
    )
    .run("default", new Date().toISOString());
}

function seedCafeAdmin(sqlite: Database.Database) {
  const { email, password, name } = SEED_ADMIN;
  if (!email || !password) return;

  const hash = bcrypt.hashSync(password, 10);
  const now = new Date().toISOString();
  const existing = sqlite
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(email) as { id: string } | undefined;
  if (!existing) {
    const id = randomUUID();
    sqlite
      .prepare(
        `INSERT INTO users (id, name, email, password_hash, is_admin, email_verified_at, created_at)
         VALUES (?, ?, ?, ?, 1, ?, ?)`
      )
      .run(id, name, email, hash, now, now);
    sqlite
      .prepare(
        `INSERT OR IGNORE INTO preference_profiles (
           user_id, diet_type, hard_avoids_json, soft_dislikes_json, likes_json,
           goals_json, allergies_json, freeform_notes, user_facing_summary,
           email_enabled, email_time_local, timezone, onboarding_completed, updated_at
         ) VALUES (?, 'non_veg', '[]', '[]', '[]', '[]', '[]', '', 'Cafe admin account', 0, '07:00', 'Asia/Kolkata', 1, ?)`
      )
      .run(id, now);
    console.log("[seed] Cafe admin created");
    return;
  }

  if (process.env.ADMIN_RESET_ON_BOOT === "1") {
    sqlite
      .prepare(
        `UPDATE users SET name = ?, password_hash = ?, is_admin = 1,
         email_verified_at = COALESCE(email_verified_at, ?) WHERE email = ?`
      )
      .run(name, hash, now, email);
    console.log("[seed] Cafe admin password reset (ADMIN_RESET_ON_BOOT)");
    return;
  }

  sqlite
    .prepare(
      `UPDATE users SET name = ?, is_admin = 1,
       email_verified_at = COALESCE(email_verified_at, ?) WHERE email = ?`
    )
    .run(name, now, email);
  console.log("[seed] Cafe admin ready");
}

function createDb() {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = process.env.DATABASE_PATH || path.join(dataDir, "mealworks.db");
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  ensureSchema(sqlite);
  if (!globalForDb.__mealworksSeeded) {
    seedCafeAdmin(sqlite);
    globalForDb.__mealworksSeeded = true;
    // Start digest tick after DB is ready (lazy, server-only)
    try {
      // dynamic to avoid circular import at module load
      void import("../digest-scheduler").then((m) => m.startDigestScheduler());
    } catch {
      /* ignore */
    }
  }
  return { sqlite, db: drizzle(sqlite, { schema }) };
}

export function getDb() {
  if (!globalForDb.__mealworksDb) {
    const { sqlite, db } = createDb();
    globalForDb.__mealworksSqlite = sqlite;
    globalForDb.__mealworksDb = db;
  } else if (globalForDb.__mealworksSqlite) {
    // Hot reload: still apply new columns/tables
    ensureSchema(globalForDb.__mealworksSqlite);
  }
  return globalForDb.__mealworksDb!;
}

export { schema };
