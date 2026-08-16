import { describe, expect, it } from "vitest";
import { SALAD_COMPOSE_STATION } from "./salad-compose";
import {
  ADMIN_ROOMS,
  adminConfirmOk,
  adminConfirmPhrase,
  BOARD_MEAL_VIEWS,
  addDishDraft,
  boardFileLabel,
  boardStatus,
  canBlockUser,
  canToggleAdmin,
  dishDraftDirty,
  dishSavePlan,
  editDishName,
  itemInBoardMeal,
  markDishDeleted,
  nextAdminConfirm,
  emptyStarCounts,
  emptyStarFilterCopy,
  isMenuUploadFile,
  menuUploadKind,
  noteWhen,
  pageFromRail,
  peoplePageCount,
  peoplePageWindow,
  personInitials,
  railFromPage,
  roomShowsDate,
  starPercents,
  summaryCacheFresh,
  toPublicNote,
  visibleDishDrafts,
  type DishDraft,
} from "./admin-view";

describe("admin rooms", () => {
  it("is Board, Notes, People, and Hours", () => {
    expect(ADMIN_ROOMS.map((r) => r.id)).toEqual([
      "board",
      "notes",
      "people",
      "hours",
    ]);
  });

  it("shows the date only on Board and Notes", () => {
    expect(roomShowsDate("board")).toBe(true);
    expect(roomShowsDate("notes")).toBe(true);
    expect(roomShowsDate("people")).toBe(false);
    expect(roomShowsDate("hours")).toBe(false);
  });
});

describe("boardStatus", () => {
  it("says No menu when the day has no board", () => {
    expect(boardStatus({ hasMenu: false, itemCount: 0 })).toBe("No menu");
  });

  it("counts dishes when the board is live", () => {
    expect(boardStatus({ hasMenu: true, itemCount: 42 })).toBe("Live · 42");
    expect(boardStatus({ hasMenu: true, itemCount: 0 })).toBe("Live · 0");
  });
});

describe("canToggleAdmin", () => {
  it("blocks changing your own admin flag", () => {
    expect(canToggleAdmin({ targetId: "a", selfId: "a" })).toBe(false);
  });

  it("allows changing someone else", () => {
    expect(canToggleAdmin({ targetId: "b", selfId: "a" })).toBe(true);
  });
});

describe("canBlockUser", () => {
  it("blocks blocking yourself", () => {
    expect(canBlockUser({ targetId: "a", selfId: "a" })).toBe(false);
  });

  it("allows blocking someone else", () => {
    expect(canBlockUser({ targetId: "b", selfId: "a" })).toBe(true);
  });
});

describe("isMenuUploadFile", () => {
  it("accepts photos and PDFs", () => {
    expect(isMenuUploadFile("board.jpg", "image/jpeg")).toBe(true);
    expect(isMenuUploadFile("board.PDF", "application/pdf")).toBe(true);
    expect(isMenuUploadFile("board.heic", "image/heic")).toBe(true);
  });

  it("rejects other files", () => {
    expect(isMenuUploadFile("notes.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(false);
    expect(isMenuUploadFile("song.mp3", "audio/mpeg")).toBe(false);
  });
});

describe("menuUploadKind", () => {
  it("tells photo from PDF even without a mime", () => {
    expect(menuUploadKind("board.jpg")).toBe("image");
    expect(menuUploadKind("/uploads/menus/day.pdf")).toBe("pdf");
    expect(menuUploadKind("notes.docx")).toBe(null);
  });
});

describe("noteWhen", () => {
  const now = new Date("2026-08-15T15:00:00");

  it("uses Today, Yesterday, then N days ago, never a clock time", () => {
    expect(noteWhen("2026-08-15T09:34:00", now)).toBe("Today");
    expect(noteWhen("2026-08-14T23:50:00", now)).toBe("Yesterday");
    expect(noteWhen("2026-08-12T08:00:00", now)).toBe("3 days ago");
    expect(noteWhen("2026-08-01T18:22:00", now)).toBe("Aug 1");
  });
});

describe("starPercents", () => {
  it("turns raw star counts into whole-number percents", () => {
    const counts = { ...emptyStarCounts(), 5: 3, 4: 1 };
    expect(starPercents(counts)).toEqual({
      ...emptyStarCounts(),
      5: 75,
      4: 25,
    });
  });

  it("is all zeros when nobody rated", () => {
    expect(starPercents(emptyStarCounts())).toEqual(emptyStarCounts());
  });
});

describe("emptyStarFilterCopy", () => {
  it("names the empty star bucket", () => {
    expect(emptyStarFilterCopy(3)).toBe("No 3 star notes.");
  });
});

describe("summaryCacheFresh", () => {
  it("is fresh only when count and latest note match", () => {
    expect(
      summaryCacheFresh({
        cachedCount: 4,
        cachedLatest: "2026-08-15T10:00:00.000Z",
        noteCount: 4,
        latestCreatedAt: "2026-08-15T10:00:00.000Z",
      })
    ).toBe(true);
    expect(
      summaryCacheFresh({
        cachedCount: 4,
        cachedLatest: "2026-08-15T10:00:00.000Z",
        noteCount: 5,
        latestCreatedAt: "2026-08-15T10:00:00.000Z",
      })
    ).toBe(false);
  });
});

describe("toPublicNote", () => {
  it("keeps stars and text, drops identity and clock time", () => {
    const pub = toPublicNote(
      {
        id: "n1",
        userId: "u1",
        userName: "Cafe Admin",
        stars: 5,
        note: "Loved it",
        createdAt: "2026-08-15T09:34:00",
      },
      new Date("2026-08-15T15:00:00")
    );
    expect(pub).toEqual({
      id: "n1",
      stars: 5,
      note: "Loved it",
      when: "Today",
    });
    expect(pub).not.toHaveProperty("userName");
    expect(pub).not.toHaveProperty("userId");
    expect(pub).not.toHaveProperty("createdAt");
  });
});

describe("peoplePageCount", () => {
  it("is 10 people per page", () => {
    expect(peoplePageCount(0)).toBe(1);
    expect(peoplePageCount(10)).toBe(1);
    expect(peoplePageCount(11)).toBe(2);
    expect(peoplePageCount(3000)).toBe(300);
  });
});

describe("pageFromRail", () => {
  it("maps the track ends to first and last page", () => {
    expect(pageFromRail(0, 50)).toBe(1);
    expect(pageFromRail(1, 50)).toBe(50);
    expect(pageFromRail(0.5, 3)).toBe(2);
  });
});

describe("railFromPage", () => {
  it("parks the knob at the ends on first and last", () => {
    expect(railFromPage(1, 50)).toBe(0);
    expect(railFromPage(50, 50)).toBe(1);
  });
});

describe("peoplePageWindow", () => {
  it("lists every page when there are few", () => {
    expect(peoplePageWindow(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("keeps first, last, and a short run around the current page", () => {
    expect(peoplePageWindow(1, 50)).toEqual([1, 2, 3, "dots", 50]);
    expect(peoplePageWindow(6, 50)).toEqual([1, "dots", 4, 5, 6, 7, 8, "dots", 50]);
    expect(peoplePageWindow(50, 50)).toEqual([1, "dots", 48, 49, 50]);
  });
});

describe("adminConfirmPhrase", () => {
  it("asks you to type the same words as the chip", () => {
    expect(adminConfirmPhrase(false)).toBe("Make admin");
    expect(adminConfirmPhrase(true)).toBe("Remove admin");
  });
});

describe("nextAdminConfirm", () => {
  it("accepts the next correct letter and ignores a wrong one", () => {
    expect(nextAdminConfirm("", "M", "Make admin")).toBe("M");
    expect(nextAdminConfirm("M", "x", "Make admin")).toBe("M");
    expect(nextAdminConfirm("Make ", "a", "Make admin")).toBe("Make a");
  });
});

describe("adminConfirmOk", () => {
  it("is done only when the whole phrase is typed", () => {
    expect(adminConfirmOk("Make admi", "Make admin")).toBe(false);
    expect(adminConfirmOk("Make admin", "Make admin")).toBe(true);
  });
});

describe("personInitials", () => {
  it("uses first and last name", () => {
    expect(personInitials("Manoj Reddy Modhugula")).toBe("MM");
    expect(personInitials("Cafe Admin")).toBe("CA");
  });

  it("uses two letters of a single name", () => {
    expect(personInitials("Nani")).toBe("NA");
  });
});

describe("boardFileLabel", () => {
  it("is Choose file before a menu is up, Replace file after", () => {
    expect(boardFileLabel(false)).toBe("Choose file");
    expect(boardFileLabel(true)).toBe("Replace file");
  });
});

describe("BOARD_MEAL_VIEWS", () => {
  it("is Breakfast and Lunch only", () => {
    expect(BOARD_MEAL_VIEWS.map((m) => m.id)).toEqual(["breakfast", "lunch"]);
  });
});

describe("itemInBoardMeal", () => {
  const oats = { meal: "breakfast", station: "Hot" };
  const rice = { meal: "lunch", station: "Indian" };
  const extra = { meal: "other", station: "Other" };
  const salad = { meal: "lunch", station: SALAD_COMPOSE_STATION };

  it("keeps breakfast dishes on Breakfast", () => {
    expect(itemInBoardMeal(oats, "breakfast")).toBe(true);
    expect(itemInBoardMeal(rice, "breakfast")).toBe(false);
  });

  it("puts lunch and other dishes on Lunch, never salad", () => {
    expect(itemInBoardMeal(rice, "lunch")).toBe(true);
    expect(itemInBoardMeal(extra, "lunch")).toBe(true);
    expect(itemInBoardMeal(oats, "lunch")).toBe(false);
    expect(itemInBoardMeal(salad, "breakfast")).toBe(false);
    expect(itemInBoardMeal(salad, "lunch")).toBe(false);
  });
});

const oats: DishDraft = {
  id: "1",
  meal: "breakfast",
  station: "Hot",
  name: "Oats",
  tags: [],
};
const rice: DishDraft = {
  id: "2",
  meal: "lunch",
  station: "Indian",
  name: "Rice",
  tags: [],
};

describe("dish drafts", () => {
  it("edits a name only in the draft", () => {
    const next = editDishName([oats, rice], "1", "Steel oats");
    expect(next.find((d) => d.id === "1")?.name).toBe("Steel oats");
    expect(oats.name).toBe("Oats");
  });

  it("hides a deleted dish and remembers the delete", () => {
    const next = markDishDeleted([oats, rice], "2");
    expect(visibleDishDrafts(next).map((d) => d.id)).toEqual(["1"]);
    expect(next.find((d) => d.id === "2")?.pending).toBe("delete");
  });

  it("adds a new dish as pending", () => {
    const next = addDishDraft([oats], {
      name: "Idli",
      meal: "breakfast",
      station: "South",
    });
    const added = next[next.length - 1];
    expect(added.name).toBe("Idli");
    expect(added.pending).toBe("add");
    expect(added.id.startsWith("draft-")).toBe(true);
  });

  it("is dirty after an edit, add, or delete", () => {
    expect(dishDraftDirty([oats, rice], [oats, rice])).toBe(false);
    expect(dishDraftDirty([oats, rice], editDishName([oats, rice], "1", "Steel oats"))).toBe(
      true
    );
    expect(dishDraftDirty([oats], addDishDraft([oats], { name: "Idli", meal: "breakfast", station: "South" }))).toBe(
      true
    );
    expect(dishDraftDirty([oats, rice], markDishDeleted([oats, rice], "2"))).toBe(true);
  });

  it("plans creates, name patches, and deletes for Save", () => {
    const draft = addDishDraft(
      editDishName(markDishDeleted([oats, rice], "2"), "1", "Steel oats"),
      { name: "Idli", meal: "breakfast", station: "South" }
    );
    expect(dishSavePlan([oats, rice], draft)).toEqual({
      update: [{ id: "1", name: "Steel oats" }],
      remove: ["2"],
      create: [{ name: "Idli", meal: "breakfast", station: "South" }],
    });
  });
});
