import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(120),
  password: z.string().min(10).max(128),
});

export const otpVerifySchema = z.object({
  email: z.string().trim().email().max(120),
  code: z.string().trim().regex(/^\d{6}$/),
});

export const resetConfirmSchema = z.object({
  email: z.string().trim().email().max(120),
  code: z.string().trim().regex(/^\d{6}$/),
  newPassword: z.string().min(10).max(128),
});

export const emailOnlySchema = z.object({
  email: z.string().trim().email().max(120),
});

export const prefsSchema = z
  .object({
    dietType: z
      .enum(["vegan", "vegetarian", "eggetarian", "non_veg", "custom"])
      .optional(),
    hardAvoids: z.array(z.string()).optional(),
    softDislikes: z.array(z.string()).optional(),
    likes: z.array(z.string()).optional(),
    goals: z.array(z.string()).optional(),
    allergies: z.array(z.string()).optional(),
    freeformNotes: z.string().max(2000).optional(),
    emailEnabled: z.boolean().optional(),
    emailTimeLocal: z.string().max(8).optional(),
    timezone: z.string().max(64).optional(),
    onboardingCompleted: z.boolean().optional(),
    runAi: z.boolean().optional(),
  })
  .passthrough();

export const tempRestrictionSchema = z.object({
  label: z.string().trim().min(1).max(80),
  avoidTags: z.array(z.string()).default([]),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(400).optional(),
});

export const feedbackSchema = z.object({
  menuDayId: z.string().min(1),
  dishName: z.string().trim().min(1).max(200),
  vote: z.enum(["up", "down", "ate"]).optional(),
  stars: z.number().int().min(1).max(5).optional(),
  note: z.string().trim().max(240).optional(),
});

export const accountUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(10).max(128).optional(),
  otp: z.string().trim().regex(/^\d{6}$/).optional(),
});

export const accountDeleteSchema = z.object({
  otp: z.string().trim().regex(/^\d{6}$/),
  confirmEmail: z.string().trim().email().max(120),
});

const hhmm = z
  .string()
  .trim()
  .regex(/^\d{2}:\d{2}$/, "Use HH:MM");

export const cafeHoursSchema = z.object({
  breakfastStart: hhmm,
  breakfastEnd: hhmm,
  lunchStart: hhmm,
  lunchEnd: hhmm,
});

export const menuItemCreateSchema = z.object({
  menuDayId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  meal: z.string().trim().min(1).max(40).default("lunch"),
  station: z.string().trim().min(1).max(80).default("Other"),
  tags: z.array(z.string()).optional(),
});

export const menuItemPatchSchema = z.object({
  menuDayId: z.string().min(1),
  itemId: z.string().min(1),
  name: z.string().trim().min(1).max(200).optional(),
  tags: z.array(z.string()).optional(),
  meal: z.string().optional(),
  station: z.string().optional(),
  delete: z.boolean().optional(),
});
