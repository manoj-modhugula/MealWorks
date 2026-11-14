import { SAMPLE_DISHES } from "./sample-catalog";
import { matchMenuLocal } from "./matching";
import type { PrefsInput, StructuredMenu, TempRestrictionInput } from "./types";
import type { DishNote, DishReviewStats } from "./dish-note";

type DemoPrefs = PrefsInput & {
  userFacingSummary: string;
  temporaryRestrictions: (TempRestrictionInput & { id: string })[];
  emailEnabled: boolean;
  emailTimeLocal: string;
  timezone: string;
};

// Describes these sample recipes, never a claim about a real café's ingredients.
const recipeTags: Record<string, string[]> = {
  "Spinach & Mushroom Scramble": ["egg", "vegetable"],
  "Greek Yogurt & Berries": ["dairy", "fruit"],
  "Banana & Walnut Oatmeal": ["nuts", "walnut", "grain"],
  "Buttermilk Pancakes": ["gluten", "dairy", "egg"],
  "Butter Croissant": ["gluten", "dairy", "pastry"],
  "Belgian Waffle": ["gluten", "dairy", "egg"],
  "Pollo a la Brasa with Aji Verde": ["chicken", "meat", "spicy"],
  "Sofrito Rice": ["vegan", "grain", "mild"],
  "Refried Beans": ["vegan", "beans", "mild"],
  "Herb-Roasted Salmon": ["fish"],
  "Maple-Roasted Carrots": ["vegan", "vegetable"],
  "Mediterranean Lentil Bowl": ["vegan", "lentils", "vegetable"],
  "Heirloom Caprese Salad": ["dairy", "vegetable", "salad"],
  "Quinoa-Stuffed Peppers": ["vegan", "grain", "vegetable"],
  "Spinach & Cheese Empanadas with Chimichurri": ["gluten", "dairy"],
  "Eggplant Parm Pizza": ["gluten", "dairy", "pizza"],
  "Creamy Mushroom Tagliatelle": ["gluten", "cream", "dairy"],
  "Mediterranean Grain Bowl": ["vegan", "grain", "salad"],
  "Greek Salad": ["dairy", "salad"],
  "Roasted Beet & Orange Salad": ["vegan", "salad"],
  "Classic Caesar Salad": ["gluten", "dairy", "cream", "egg", "fish"],
  "Creamy Potato Salad": ["cream", "egg"],
  "Italian Pasta Salad": ["gluten", "salad"],
};

export function sampleMenu(date: string): StructuredMenu {
  return {
    date,
    meals: (["breakfast", "lunch"] as const).map((type) => ({
      type,
      stations: Array.from(
        new Set(
          SAMPLE_DISHES.filter((d) => d.meal === type).map((d) => d.station),
        ),
      ).map((name) => ({
        name,
        items: SAMPLE_DISHES.filter(
          (d) => d.meal === type && d.station === name,
        ).map((d) => ({ name: d.name, tags: recipeTags[d.name] ?? [] })),
      })),
    })),
  };
}

/** One isolated workspace per provider. No network, database, real identity or global cache. */
export function createDemoWorkspace() {
  let prefs: DemoPrefs = {
    dietType: "custom",
    hardAvoids: ["gluten", "cream"],
    softDislikes: [],
    likes: [],
    goals: ["high_protein"],
    allergies: [],
    freeformNotes: "",
    userFacingSummary: "Your sample food profile.",
    temporaryRestrictions: [],
    emailEnabled: false,
    emailTimeLocal: "07:00",
    timezone: "",
  };
  const feedback: Record<string, Record<string, DishNote>> = {};
  const cache = new Map<string, { value: unknown; expires: number }>();
  const invalidateRecommendations = () => {
    cache.delete("prefs");
    for (const key of cache.keys())
      if (key.startsWith("today:") || key.startsWith("week:"))
        cache.delete(key);
  };
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  const stats = (date: string): Record<string, DishReviewStats> =>
    Object.fromEntries(
      Object.entries(feedback[date] ?? {}).map(([name, note]) => [
        name,
        { avgStars: note.stars, count: 1 },
      ]),
    );
  const fetchSample = async (
    url: string,
    init?: RequestInit,
  ): Promise<Response> => {
    if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const parsed = new URL(url, "https://mealworks.demo");
    // Fail closed. Unknown URLs must never fall through to an authenticated API.
    if (parsed.origin !== "https://mealworks.demo")
      return json({ error: "Unavailable in the sample workspace." }, 403);
    const path = parsed.pathname;
    const method = (init?.method ?? "GET").toUpperCase();
    let body: Record<string, unknown> = {};
    try {
      if (typeof init?.body === "string") body = JSON.parse(init.body);
    } catch {
      return json({ error: "Could not read those changes." }, 400);
    }
    const date =
      parsed.searchParams.get("date") ||
      (typeof body.menuDayId === "string" &&
      body.menuDayId.startsWith("sample-menu:")
        ? body.menuDayId.slice("sample-menu:".length)
        : typeof body.date === "string"
          ? body.date
          : new Date().toLocaleDateString("en-CA"));
    const menu = sampleMenu(date);
    if (path === "/api/match/today" && ["GET", "POST"].includes(method)) {
      const match = matchMenuLocal(menu, prefs, prefs.temporaryRestrictions);
      const { items, combos, ...summary } = match;
      return json({
        menu: { id: `sample-menu:${date}`, date },
        match: {
          ...summary,
          source: "baseline",
          headline:
            summary.verdict === "great"
              ? "A few good things for your day"
              : summary.verdict === "mostly_fine"
                ? "Good choices, with a few trade-offs"
                : "Fewer choices for your preferences",
          summary: `${items.filter((item) => item.decision === "recommended").length} dishes match your preferences, from breakfast through lunch. ${items.find((item) => item.decision === "recommended")?.reason ?? "Try adjusting your food profile."}.`,
          payload: {
            items,
            combos: combos.map((combo) => ({
              ...combo,
              items: combo.items.slice(0, 1),
            })),
          },
        },
        feedback: feedback[date] ?? {},
        reviews: stats(date),
      });
    }
    if (path === "/api/menu/today" && method === "GET")
      return json({
        menu: {
          date,
          menu,
          meta: { previewCatalog: true },
          sourceImagePath: "/images/sample-menu.png",
        },
      });
    if (path === "/api/week" && method === "GET") return json({ days: [] });
    if (path === "/api/preferences" && method === "GET") return json({ prefs });
    if (path === "/api/preferences" && method === "PUT") {
      const allowed = [
        "dietType",
        "hardAvoids",
        "softDislikes",
        "likes",
        "goals",
        "allergies",
        "freeformNotes",
        "emailEnabled",
        "emailTimeLocal",
        "timezone",
      ] as const;
      const patch = Object.fromEntries(
        allowed.filter((key) => key in body).map((key) => [key, body[key]]),
      );
      prefs = { ...prefs, ...patch };
      invalidateRecommendations();
      return json({ prefs });
    }
    if (path === "/api/preferences/temporary" && method === "POST") {
      const restriction = {
        id: `sample-${prefs.temporaryRestrictions.length}-${Date.now()}`,
        label: String(body.label ?? ""),
        avoidTags: Array.isArray(body.avoidTags)
          ? body.avoidTags.map(String)
          : [],
        startsOn: String(body.startsOn ?? date),
        endsOn: String(body.endsOn ?? date),
        reason: String(body.reason ?? ""),
      };
      prefs = {
        ...prefs,
        temporaryRestrictions: [...prefs.temporaryRestrictions, restriction],
      };
      invalidateRecommendations();
      return json({ ok: true });
    }
    if (path === "/api/preferences/temporary" && method === "DELETE") {
      prefs = {
        ...prefs,
        temporaryRestrictions: prefs.temporaryRestrictions.filter(
          (item) => item.id !== parsed.searchParams.get("id"),
        ),
      };
      invalidateRecommendations();
      return json({ ok: true });
    }
    if (path === "/api/me" && method === "GET")
      return json({ user: { name: "Sample guest" }, prefs });
    if (path === "/api/digests/latest" && method === "GET") {
      const match = matchMenuLocal(menu, prefs, prefs.temporaryRestrictions);
      return json({
        digest: {
          createdAt: `${date}T07:00:00`,
          payload: {
            headline: "A few good things for your day",
            summary: match.summary,
          },
        },
      });
    }
    if (path === "/api/digests/test" && method === "POST")
      return json({ message: "Sample digest ready below. No email was sent." });
    if (path === "/api/feedback" && method === "POST") {
      const name = String(body.dishName ?? "");
      if (
        !SAMPLE_DISHES.some((d) => d.name === name) ||
        !Number.isInteger(body.stars) ||
        Number(body.stars) < 1 ||
        Number(body.stars) > 5
      )
        return json({ error: "Choose a dish and a rating from 1 to 5." }, 400);
      feedback[date] ??= {};
      feedback[date][name] = {
        vote: "ate",
        stars: Number(body.stars),
        note: String(body.note ?? "").slice(0, 2000),
      };
      return json({ feedback: feedback[date], dish: stats(date)[name] });
    }
    if (path === "/api/feedback/dish" && method === "GET") {
      const note = feedback[date]?.[parsed.searchParams.get("dish") ?? ""];
      const stars = parsed.searchParams.get("stars");
      return json({
        notes:
          note && (!stars || Number(stars) === note.stars)
            ? [
                {
                  id: "sample-review",
                  stars: note.stars,
                  note: note.note,
                  when: `${date}T12:00:00`,
                },
              ]
            : [],
        nextCursor: null,
      });
    }
    return json({ error: "Create an account to use this feature." }, 403);
  };
  return {
    isDemo: true,
    fetch: fetchSample,
    async requestJson<T>(url: string, init?: RequestInit): Promise<T> {
      const response = await fetchSample(url, init);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      return data as T;
    },
    getCache<T>(key: string): T | undefined {
      const entry = cache.get(key);
      return entry && entry.expires > Date.now()
        ? (structuredClone(entry.value) as T)
        : undefined;
    },
    setCache<T>(key: string, value: T, ttl = 300_000) {
      cache.set(key, {
        value: structuredClone(value),
        expires: Date.now() + ttl,
      });
    },
    invalidateCache(prefix = "") {
      for (const key of cache.keys())
        if (key.startsWith(prefix)) cache.delete(key);
    },
  };
}
