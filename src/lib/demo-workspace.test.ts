import { afterEach, describe, expect, it, vi } from "vitest";
import { dishPhoto } from "./sample-catalog";
import { createDemoWorkspace } from "./demo-workspace";
import { itemInMealView } from "./meal-hours";
import type { MatchPayload } from "./types";
import { getCache, setCache, invalidateCache } from "./client-cache";

const date = "2026-11-14";
const matchUrl = `/api/match/today?date=${date}`;
type Board = {
  menu: { id: string };
  match: { score: number; payload: Pick<MatchPayload, "items" | "combos"> };
  feedback: Record<string, { stars: number; note: string }>;
};
const put = (data: unknown) => ({ method: "PUT", body: JSON.stringify(data) });
afterEach(() => {
  vi.unstubAllGlobals();
  invalidateCache("demo-test");
});

describe("public sample workspace", () => {
  it("opens with eight distinct good lunch dishes and coverage-based fit", async () => {
    const demo = createDemoWorkspace();
    const board = await demo.requestJson<Board>(matchUrl);
    const lunch = board.match.payload.items.filter(
      (item) =>
        itemInMealView(item, "lunch") && item.decision === "recommended",
    );
    expect(lunch).toHaveLength(8);
    expect(new Set(lunch.map((dish) => dishPhoto(dish.name))).size).toBe(8);
    expect(dishPhoto("Unknown dish")).toBeNull();
    expect(board.match.score).toBe(97);
    expect(
      board.match.payload.combos.every((combo) => combo.items.length <= 1),
    ).toBe(true);
  });
  it("recomputes recommendations when a visitor changes eating style", async () => {
    const demo = createDemoWorkspace();
    await demo.requestJson("/api/preferences", put({ dietType: "vegan" }));
    const board = await demo.requestJson<Board>(matchUrl);
    expect(
      board.match.payload.items.find(
        (item) => item.name === "Herb-Roasted Salmon",
      )?.decision,
    ).toBe("avoid");
    expect(
      board.match.payload.items.find(
        (item) => item.name === "Quinoa-Stuffed Peppers",
      )?.decision,
    ).toBe("recommended");
  });
  it("changes plate photos and order for favorites without faking a fit change", async () => {
    const demo = createDemoWorkspace();
    const before = await demo.requestJson<Board>(matchUrl);
    const lunchPick = (board: Board) =>
      board.match.payload.combos.find((combo) => combo.title === "Lunch idea")
        ?.items[0];
    demo.setCache("today:2026-11-14", before);
    await demo.requestJson("/api/preferences", put({ likes: ["salmon"] }));
    expect(demo.getCache("today:2026-11-14")).toBeUndefined();
    const after = await demo.requestJson<Board>(matchUrl);
    expect(lunchPick(after)).toBe("Herb-Roasted Salmon");
    expect(dishPhoto(lunchPick(after)!)).not.toBe(
      dishPhoto(lunchPick(before)!),
    );
    expect(after.match.score).toBe(97);
    expect(
      after.match.payload.items.find((item) => item.decision === "recommended")
        ?.name,
    ).toBe("Herb-Roasted Salmon");
  });
  it("visibly prioritizes vegetable choices when the goal changes", async () => {
    const demo = createDemoWorkspace();
    await demo.requestJson(
      "/api/preferences",
      put({ goals: ["more_veggies"] }),
    );
    const board = await demo.requestJson<Board>(matchUrl);
    expect(
      board.match.payload.combos.find((combo) => combo.title === "Lunch idea")
        ?.items[0],
    ).toBe("Maple-Roasted Carrots");
  });
  it("lowers fit and replaces ineligible plate photos for restrictive eating styles", async () => {
    const demo = createDemoWorkspace();
    const before = await demo.requestJson<Board>(matchUrl);
    await demo.requestJson("/api/preferences", put({ dietType: "vegan" }));
    const after = await demo.requestJson<Board>(matchUrl);
    expect(after.match.score).toBeLessThan(before.match.score);
    const excluded = new Set(
      after.match.payload.items
        .filter((item) => item.decision !== "recommended")
        .map((item) => item.name),
    );
    expect(
      after.match.payload.combos
        .flatMap((combo) => combo.items)
        .every((name) => !excluded.has(name)),
    ).toBe(true);
    expect(
      after.match.payload.combos.find((combo) => combo.title === "Lunch idea")
        ?.items[0],
    ).not.toBe("Pollo a la Brasa with Aji Verde");
  });
  it("keeps exclusions above favorites and makes low-spice goals meaningful", async () => {
    const demo = createDemoWorkspace();
    await demo.requestJson(
      "/api/preferences",
      put({ likes: ["chicken"], allergies: ["chicken"], goals: ["low_spice"] }),
    );
    const board = await demo.requestJson<Board>(matchUrl);
    expect(
      board.match.payload.items.find(
        (item) => item.name === "Pollo a la Brasa with Aji Verde",
      )?.decision,
    ).toBe("avoid");
    expect(
      board.match.payload.combos.flatMap((combo) => combo.items),
    ).not.toContain("Pollo a la Brasa with Aji Verde");
    await demo.requestJson("/api/preferences", put({ allergies: [] }));
    const mild = await demo.requestJson<Board>(matchUrl);
    expect(
      mild.match.payload.items.find(
        (item) => item.name === "Pollo a la Brasa with Aji Verde",
      )?.decision,
    ).toBe("caution");
  });
  it("clears plate picks when no dishes remain eligible", async () => {
    const demo = createDemoWorkspace();
    const before = await demo.requestJson<Board>(matchUrl);
    await demo.requestJson(
      "/api/preferences",
      put({ hardAvoids: before.match.payload.items.map((item) => item.name) }),
    );
    const after = await demo.requestJson<Board>(matchUrl);
    expect(after.match.score).toBe(0);
    expect(after.match.payload.combos.flatMap((combo) => combo.items)).toEqual([]);
  });
  it("isolates preferences and caches between visitors and from the signed-in app", async () => {
    const first = createDemoWorkspace(),
      second = createDemoWorkspace();
    await first.requestJson(
      "/api/preferences",
      put({ dietType: "vegan", allergies: ["nuts"] }),
    );
    expect(
      (
        await second.requestJson<{
          prefs: { dietType: string; allergies: string[] };
        }>("/api/preferences")
      ).prefs,
    ).toMatchObject({ dietType: "custom", allergies: [] });
    setCache("demo-test", "private");
    expect(first.getCache("demo-test")).toBeUndefined();
    first.setCache("demo-test", "sample");
    expect(getCache("demo-test")).toBe("private");
    expect(second.getCache("demo-test")).toBeUndefined();
  });
  it("stores a review only in its sample workspace and selected day", async () => {
    const demo = createDemoWorkspace();
    const old = await demo.requestJson<Board>(
      "/api/match/today?date=2026-11-12",
    );
    await demo.requestJson("/api/feedback", {
      method: "POST",
      body: JSON.stringify({
        menuDayId: old.menu.id,
        dishName: "Sofrito Rice",
        stars: 4,
        note: "Sample review",
      }),
    });
    expect(
      (await demo.requestJson<Board>("/api/match/today?date=2026-11-12"))
        .feedback["Sofrito Rice"].stars,
    ).toBe(4);
    expect((await demo.requestJson<Board>(matchUrl)).feedback).toEqual({});
    expect(
      (
        await createDemoWorkspace().requestJson<Board>(
          "/api/match/today?date=2026-11-12",
        )
      ).feedback,
    ).toEqual({});
  });
  it("never calls the network, including email, account writes and unknown routes", async () => {
    const network = vi.fn(() => {
      throw new Error("Unexpected network");
    });
    vi.stubGlobal("fetch", network);
    const demo = createDemoWorkspace();
    expect(
      (await demo.fetch("/api/account", { method: "DELETE" })).status,
    ).toBe(403);
    expect(
      (await demo.fetch("/api/identity/stepup", { method: "POST" })).status,
    ).toBe(403);
    expect((await demo.fetch("/api/admin/users")).status).toBe(403);
    expect(
      (await demo.fetch("https://example.com/api/preferences")).status,
    ).toBe(403);
    expect(
      (await demo.fetch("/api/digests/test", { method: "POST" })).status,
    ).toBe(200);
    expect(network).not.toHaveBeenCalled();
  });
  it("keeps temporary restrictions local and permits removal", async () => {
    const demo = createDemoWorkspace();
    await demo.requestJson("/api/preferences/temporary", {
      method: "POST",
      body: JSON.stringify({
        label: "No fish this week",
        avoidTags: ["fish"],
        startsOn: "2020-01-01",
        endsOn: "2030-01-01",
      }),
    });
    const { prefs } = await demo.requestJson<{
      prefs: { temporaryRestrictions: { id: string }[] };
    }>("/api/preferences");
    expect(
      (await demo.requestJson<Board>(matchUrl)).match.payload.items.find(
        (i) => i.name === "Herb-Roasted Salmon",
      )?.decision,
    ).toBe("avoid");
    await demo.requestJson(
      `/api/preferences/temporary?id=${prefs.temporaryRestrictions[0].id}`,
      { method: "DELETE" },
    );
    expect(
      (await demo.requestJson<Board>(matchUrl)).match.payload.items.find(
        (i) => i.name === "Herb-Roasted Salmon",
      )?.decision,
    ).toBe("recommended");
  });
});
