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
