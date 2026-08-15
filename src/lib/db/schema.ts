import { primaryKey, sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  /** Empty string = OAuth-only (no password yet). */
  passwordHash: text("password_hash").notNull().default(""),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  emailVerifiedAt: text("email_verified_at"),
  blockedAt: text("blocked_at"),
  createdAt: text("created_at").notNull(),
});

export const pendingSignups = sqliteTable("pending_signups", {
  email: text("email").primaryKey(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const emailOtps = sqliteTable("email_otps", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  userId: text("user_id"),
  purpose: text("purpose").notNull(),
  otpHash: text("otp_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  attemptCount: integer("attempt_count").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const oauthAccounts = sqliteTable("oauth_accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
});

export const preferenceProfiles = sqliteTable("preference_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  dietType: text("diet_type").notNull().default("non_veg"),
  hardAvoidsJson: text("hard_avoids_json").notNull().default("[]"),
  softDislikesJson: text("soft_dislikes_json").notNull().default("[]"),
  likesJson: text("likes_json").notNull().default("[]"),
  goalsJson: text("goals_json").notNull().default("[]"),
  allergiesJson: text("allergies_json").notNull().default("[]"),
  freeformNotes: text("freeform_notes").notNull().default(""),
  aiInterpretationJson: text("ai_interpretation_json"),
  userFacingSummary: text("user_facing_summary").notNull().default(""),
  emailEnabled: integer("email_enabled", { mode: "boolean" }).notNull().default(false),
  emailTimeLocal: text("email_time_local").notNull().default("07:00"),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  onboardingCompleted: integer("onboarding_completed", { mode: "boolean" })
    .notNull()
    .default(false),
  updatedAt: text("updated_at").notNull(),
});

export const temporaryRestrictions = sqliteTable("temporary_restrictions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  avoidTagsJson: text("avoid_tags_json").notNull().default("[]"),
  startsOn: text("starts_on").notNull(),
  endsOn: text("ends_on").notNull(),
  reason: text("reason").notNull().default(""),
});

export const menuDays = sqliteTable("menu_days", {
  id: text("id").primaryKey(),
  date: text("date").notNull().unique(),
  sourceImagePath: text("source_image_path"),
  rawModelJson: text("raw_model_json").notNull(),
  createdBy: text("created_by"),
  createdAt: text("created_at").notNull(),
});

export const menuItems = sqliteTable("menu_items", {
  id: text("id").primaryKey(),
  menuDayId: text("menu_day_id")
    .notNull()
    .references(() => menuDays.id, { onDelete: "cascade" }),
  meal: text("meal").notNull(),
  station: text("station").notNull(),
  name: text("name").notNull(),
  tagsJson: text("tags_json").notNull().default("[]"),
});

export const matchResults = sqliteTable("match_results", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  menuDayId: text("menu_day_id")
    .notNull()
    .references(() => menuDays.id, { onDelete: "cascade" }),
  verdict: text("verdict").notNull(),
  score: integer("score").notNull(),
  headline: text("headline").notNull(),
  summary: text("summary").notNull(),
  payloadJson: text("payload_json").notNull(),
  createdAt: text("created_at").notNull(),
});

export const digestLogs = sqliteTable("digest_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  menuDayId: text("menu_day_id")
    .notNull()
    .references(() => menuDays.id, { onDelete: "cascade" }),
  channel: text("channel").notNull().default("in_app"),
  payloadJson: text("payload_json").notNull(),
  createdAt: text("created_at").notNull(),
});

/** Per-user dish feedback (ate / wrong rec). */
export const dishFeedback = sqliteTable("dish_feedback", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  menuDayId: text("menu_day_id")
    .notNull()
    .references(() => menuDays.id, { onDelete: "cascade" }),
  dishName: text("dish_name").notNull(),
  /** up | down | ate */
  vote: text("vote").notNull(),
  stars: integer("stars"),
  note: text("note").notNull().default(""),
  createdAt: text("created_at").notNull(),
});

/** Cached one-line AI summary of written notes for a dish on a day. */
export const dishNoteSummaries = sqliteTable(
  "dish_note_summaries",
  {
    menuDayId: text("menu_day_id")
      .notNull()
      .references(() => menuDays.id, { onDelete: "cascade" }),
    dishName: text("dish_name").notNull(),
    sentence: text("sentence").notNull(),
    noteCount: integer("note_count").notNull(),
    latestCreatedAt: text("latest_created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.menuDayId, t.dishName] }),
  })
);

/** Singleton cafe service hours. One row, id = "default". */
export const cafeSettings = sqliteTable("cafe_settings", {
  id: text("id").primaryKey(),
  breakfastStart: text("breakfast_start").notNull().default("08:00"),
  breakfastEnd: text("breakfast_end").notNull().default("09:30"),
  lunchStart: text("lunch_start").notNull().default("11:30"),
  lunchEnd: text("lunch_end").notNull().default("14:30"),
  updatedAt: text("updated_at").notNull(),
});
