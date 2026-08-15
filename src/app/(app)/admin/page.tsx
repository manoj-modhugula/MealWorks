"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { AnalogWatch } from "@/components/analog-watch";
import { NoteDishPanel } from "@/components/note-dish-panel";
import { PeopleRail } from "@/components/people-rail";
import { PersonCard } from "@/components/person-card";
import { Alert, Card, Page, PageHeader, Spinner } from "@/components/ui";
import { DateNav } from "@/components/date-nav";
import { todayOnDevice } from "@/lib/client-date";
import {
  ADMIN_ROOMS,
  boardStatus,
  canToggleAdmin,
  emptyStarCounts,
  isMenuUploadFile,
  menuUploadKind,
  roomShowsDate,
  type AdminRoom,
  type StarCounts,
} from "@/lib/admin-view";
import { formatAnalogLabel, parseHHMM } from "@/lib/analog-time";
import {
  DEFAULT_CAFE_HOURS,
  MEAL_VIEWS,
  defaultMealFromHours,
  itemInMealView,
  type CafeHours,
  type MealView,
} from "@/lib/meal-hours";

type HoursField = keyof CafeHours;

const HOUR_FIELDS: {
  key: HoursField;
  meal: "Breakfast" | "Lunch";
  bound: "From" | "Until";
}[] = [
  { key: "breakfastStart", meal: "Breakfast", bound: "From" },
  { key: "breakfastEnd", meal: "Breakfast", bound: "Until" },
  { key: "lunchStart", meal: "Lunch", bound: "From" },
  { key: "lunchEnd", meal: "Lunch", bound: "Until" },
];

type NoteDish = {
  dishName: string;
  meal: string;
  station: string;
  count: number;
  avgStars: number | null;
  starCounts: StarCounts;
};

type FlatItem = {
  id: string;
  meal: string;
  station: string;
  name: string;
  tags: string[];
};

export default function AdminPage() {
  const { data: session } = useSession();
  const [room, setRoom] = useState<AdminRoom>("board");
  const [date, setDate] = useState(() => todayOnDevice());
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [stage, setStage] = useState("");
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [flatItems, setFlatItems] = useState<FlatItem[]>([]);
  const [menuDayId, setMenuDayId] = useState<string | null>(null);
  const [sourceImagePath, setSourceImagePath] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [employees, setEmployees] = useState<
    {
      id: string;
      name: string;
      email: string;
      isAdmin: boolean;
      isBlocked?: boolean;
    }[]
  >([]);
  const [openPersonId, setOpenPersonId] = useState<string | null>(null);
  const [peopleDraft, setPeopleDraft] = useState("");
  const [peopleQ, setPeopleQ] = useState("");
  const [peoplePage, setPeoplePage] = useState(1);
  const [peoplePageCount, setPeoplePageCount] = useState(1);
  const [newDish, setNewDish] = useState({
    name: "",
    meal: "lunch",
    station: "",
  });
  const [noteDishes, setNoteDishes] = useState<NoteDish[]>([]);
  const [openNoteDish, setOpenNoteDish] = useState<string | null>(null);
  const [noteMeal, setNoteMeal] = useState<MealView>(() =>
    defaultMealFromHours(new Date(), DEFAULT_CAFE_HOURS)
  );
  const noteMealTouched = useRef(false);
  const [hours, setHours] = useState<CafeHours>({ ...DEFAULT_CAFE_HOURS });
  const [hoursSaving, setHoursSaving] = useState(false);
  const [hourField, setHourField] = useState<HoursField>("breakfastStart");
  const dateRef = useRef(date);
  dateRef.current = date;

  const loadBoard = useCallback(async (d: string) => {
    const res = await fetch(`/api/admin/menus?date=${encodeURIComponent(d)}`);
    if (dateRef.current !== d) return;
    if (res.status === 404) {
      setFlatItems([]);
      setMenuDayId(null);
      setSourceImagePath(null);
      return;
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed");
    setMenuDayId(data.id);
    setSourceImagePath(data.sourceImagePath || null);
    if (data.flatItems) setFlatItems(data.flatItems);
    else {
      const flat: FlatItem[] = [];
      for (const meal of data.menu?.meals || []) {
        for (const st of meal.stations || []) {
          for (const it of st.items || []) {
            flat.push({
              id: it.id || `${meal.type}-${st.name}-${it.name}`,
              meal: meal.type,
              station: st.name,
              name: it.name,
              tags: it.tags || [],
            });
          }
        }
      }
      setFlatItems(flat);
    }
  }, []);

  const loadNotes = useCallback(async (d: string) => {
    const res = await fetch(
      `/api/admin/feedback?date=${encodeURIComponent(d)}`
    );
    const data = await res.json();
    if (dateRef.current !== d) return;
    if (!res.ok) throw new Error(data.error || "Failed");
    setNoteDishes(
      (data.dishes || []).map(
        (d: Partial<NoteDish> & { dishName: string }) => ({
          dishName: d.dishName,
          meal: d.meal || "other",
          station: d.station || "Other",
          count: d.count || 0,
          avgStars: d.avgStars ?? null,
          starCounts: d.starCounts || emptyStarCounts(),
        })
      )
    );
  }, []);

  const loadPeople = useCallback(async () => {
    const qs = new URLSearchParams({
      page: String(peoplePage),
      q: peopleQ,
    });
    const res = await fetch(`/api/admin/users?${qs}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed");
    setEmployees(data.users || []);
    setPeoplePageCount(data.pageCount || 1);
    if (data.page && data.page !== peoplePage) setPeoplePage(data.page);
  }, [peoplePage, peopleQ]);

  const loadHours = useCallback(async () => {
    const res = await fetch("/api/admin/hours");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed");
    if (data.hours) {
      setHours(data.hours);
      if (!noteMealTouched.current) {
        setNoteMeal(defaultMealFromHours(new Date(), data.hours));
      }
    }
  }, []);

  const refreshAll = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (!opts?.soft) setBooting(true);
      setError("");
      try {
        await Promise.all([
          loadBoard(date),
          loadNotes(date),
          loadHours(),
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Load failed");
      } finally {
        setBooting(false);
      }
    },
    [date, loadBoard, loadNotes, loadHours]
  );

  useEffect(() => {
    if (session?.user?.isAdmin) void refreshAll();
    else setBooting(false);
    // Re-run only when admin session becomes available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.isAdmin]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = peopleDraft.trim();
      if (next === peopleQ) return;
      setPeopleQ(next);
      setPeoplePage(1);
      setOpenPersonId(null);
    }, 250);
    return () => window.clearTimeout(t);
  }, [peopleDraft, peopleQ]);

  useEffect(() => {
    if (!session?.user?.isAdmin) return;
    void loadPeople().catch((e) =>
      setError(e instanceof Error ? e.message : "Load failed")
    );
  }, [loadPeople, session?.user?.isAdmin]);

  useEffect(() => {
    if (!session?.user?.isAdmin) return;
    setAdding(false);
    setOpenNoteDish(null);
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    void loadBoard(date);
    void loadNotes(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, session?.user?.isAdmin, loadBoard, loadNotes]);

  useEffect(() => {
    if (room !== "notes" || !openNoteDish) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenNoteDish(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [room, openNoteDish]);

  if (session && !session.user?.isAdmin) {
    return (
      <Page>
        <Alert tone="bad">Admin only.</Alert>
        <Link href="/today" className="btn btn-secondary mt-4">
          Back
        </Link>
      </Page>
    );
  }

  function onFile(f: File | null) {
    if (f && !isMenuUploadFile(f.name, f.type)) {
      setError("Use a photo or a PDF.");
      return;
    }
    setError("");
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const kind = f ? menuUploadKind(f.name, f.type) : null;
    setPreviewUrl(kind === "image" && f ? URL.createObjectURL(f) : null);
    if (!f && fileInputRef.current) fileInputRef.current.value = "";
  }

  async function upload() {
    if (!file) {
      setError("Choose a file");
      return;
    }
    if (menuDayId && !confirm("Replace the menu for this day?")) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      setStage("Reading menu");
      const form = new FormData();
      form.append("file", file);
      form.append("date", date);
      const res = await fetch("/api/admin/menu", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setMessage(`Live · ${data.menu ? "posted" : "saved"}`);
      onFile(null);
      await refreshAll({ soft: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
      setStage("");
    }
  }

  async function patchItem(
    item: FlatItem,
    patch: Partial<FlatItem> & { delete?: boolean }
  ) {
    if (!menuDayId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/menu/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menuDayId,
          itemId: item.id,
          name: patch.name,
          delete: patch.delete,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      await loadBoard(date);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function saveHours() {
    setHoursSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/hours", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hours),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn’t save hours");
      if (data.hours) setHours(data.hours);
      setMessage("Hours saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save hours");
    } finally {
      setHoursSaving(false);
    }
  }

  async function toggleBlock(userId: string, blocked: boolean) {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, blocked }),
    });
    if (res.ok) await loadPeople();
  }

  async function toggleAdmin(userId: string, isAdmin: boolean) {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, isAdmin }),
    });
    if (res.ok) await loadPeople();
  }

  async function addDish() {
    if (!menuDayId || !newDish.name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/menu/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menuDayId,
          name: newDish.name,
          meal: newDish.meal,
          station: newDish.station || "Other",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setNewDish({ name: "", meal: newDish.meal, station: "" });
      setAdding(false);
      await loadBoard(date);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function deleteDay(d: string) {
    if (!confirm("Delete this day's menu?")) return;
    await fetch(`/api/admin/menus?date=${encodeURIComponent(d)}`, {
      method: "DELETE",
    });
    onFile(null);
    setAdding(false);
    await refreshAll({ soft: true });
  }

  const hasMenu = Boolean(menuDayId);
  const selfId = session?.user?.id || "";
  const pendingKind = file ? menuUploadKind(file.name, file.type) : null;
  const liveKind =
    !file && sourceImagePath ? menuUploadKind(sourceImagePath) : null;
  const wellImage =
    pendingKind === "image"
      ? previewUrl
      : liveKind === "image"
        ? sourceImagePath
        : null;
  const wellPdfName =
    pendingKind === "pdf"
      ? file?.name || "Menu.pdf"
      : liveKind === "pdf"
        ? sourceImagePath?.split("/").pop() || "Menu.pdf"
        : null;
  const wellEmpty = !wellImage && !wellPdfName;
  const visibleNoteDishes = noteDishes.filter((d) =>
    itemInMealView({ meal: d.meal, station: d.station }, noteMeal)
  );
  const noteMealLabel =
    MEAL_VIEWS.find((m) => m.id === noteMeal)?.label || "this meal";
  const openDish = noteDishes.find((d) => d.dishName === openNoteDish);

  return (
    <Page>
      <PageHeader
        title="Admin"
        action={
          roomShowsDate(room) ? (
            <DateNav
              date={date}
              onChange={setDate}
              maxDate={todayOnDevice()}
            />
          ) : null
        }
      />

      <div>
      <div className="admin-rooms" role="tablist" aria-label="Admin">
        {ADMIN_ROOMS.map((r) => (
          <button
            key={r.id}
            type="button"
            className="chip"
            role="tab"
            aria-selected={room === r.id}
            data-active={room === r.id}
            onClick={() => setRoom(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {message && <Alert tone="good">{message}</Alert>}
        {error && <Alert tone="bad">{error}</Alert>}
        {(loading || booting) && <Spinner label={stage || "Working…"} />}

        {room === "board" && (
          <>
            <Card className="admin-board">
              <div className="admin-board-head">
                <h2 className="card-title">
                  {boardStatus({ hasMenu, itemCount: flatItems.length })}
                </h2>
                {hasMenu && (
                  <button
                    type="button"
                    className="dish-flip-skip"
                    onClick={() => void deleteDay(date)}
                  >
                    Remove this day
                  </button>
                )}
              </div>

              <div
                className="admin-board-stage"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) onFile(f);
                }}
              >
                <input
                  ref={fileInputRef}
                  id="board-file"
                  type="file"
                  accept="image/*,application/pdf,.heic,.heif,.pdf"
                  className="sr-only"
                  onChange={(e) => onFile(e.target.files?.[0] || null)}
                />
                {wellEmpty ? (
                  <label className="admin-board-well" htmlFor="board-file">
                    <span>Drop a photo or PDF</span>
                  </label>
                ) : (
                  <div className="admin-board-well" data-filled="true">
                    {wellImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={wellImage} alt="Menu" />
                    ) : (
                      <div className="admin-board-doc">
                        <span className="admin-board-doc-kind">PDF</span>
                        <span className="admin-board-doc-name">
                          {wellPdfName}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="admin-board-actions">
                <label className="chip" htmlFor="board-file">
                  Choose file
                </label>
                {file && (
                  <button
                    type="button"
                    className="dish-flip-skip"
                    onClick={() => onFile(null)}
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={loading || !file}
                  onClick={() => void upload()}
                >
                  {hasMenu ? "Replace" : "Post"}
                </button>
              </div>
            </Card>

            {hasMenu && (
              <Card>
                <h2 className="card-title">Dishes</h2>
                <div className="mt-3 space-y-2">
                {flatItems.map((it) => (
                  <div key={it.id} className="admin-dish">
                    <div className="min-w-0 flex-1">
                      <input
                        className="field !py-1.5"
                        value={it.name}
                        aria-label="Dish name"
                        onChange={(e) =>
                          setFlatItems((rows) =>
                            rows.map((r) =>
                              r.id === it.id ? { ...r, name: e.target.value } : r
                            )
                          )
                        }
                        onBlur={() => {
                          if (it.name.trim()) patchItem(it, { name: it.name });
                        }}
                      />
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {it.meal} · {it.station}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="icon-btn icon-btn-danger !h-9 !w-9"
                      onClick={() => patchItem(it, { delete: true })}
                      aria-label="Delete dish"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}

                {adding ? (
                  <div className="admin-add">
                    <input
                      className="field !py-1.5"
                      placeholder="Dish name"
                      value={newDish.name}
                      onChange={(e) =>
                        setNewDish((d) => ({ ...d, name: e.target.value }))
                      }
                    />
                    <select
                      className="field !py-1.5"
                      value={newDish.meal}
                      onChange={(e) =>
                        setNewDish((d) => ({ ...d, meal: e.target.value }))
                      }
                      aria-label="Meal"
                    >
                      <option value="breakfast">breakfast</option>
                      <option value="lunch">lunch</option>
                      <option value="other">other</option>
                    </select>
                    <input
                      className="field !py-1.5"
                      placeholder="Station"
                      value={newDish.station}
                      onChange={(e) =>
                        setNewDish((d) => ({ ...d, station: e.target.value }))
                      }
                    />
                    <div className="admin-quiet-row">
                      <button
                        type="button"
                        className="btn btn-primary !py-1.5 !text-sm"
                        disabled={loading || !newDish.name.trim()}
                        onClick={() => void addDish()}
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        className="dish-flip-skip"
                        onClick={() => setAdding(false)}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="dish-flip-skip"
                    onClick={() => setAdding(true)}
                  >
                    Add dish
                  </button>
                )}
                </div>
              </Card>
            )}
          </>
        )}

        {room === "notes" && (
          <>
            <div className="today-filter-row">
              <div className="today-meal-select">
                <select
                  className="today-meal-select-face"
                  aria-label="Meal"
                  value={noteMeal}
                  onChange={(e) => {
                    noteMealTouched.current = true;
                    setNoteMeal(e.target.value as MealView);
                    setOpenNoteDish(null);
                  }}
                >
                  {MEAL_VIEWS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {visibleNoteDishes.length === 0 ? (
              <Card>
                <p className="text-sm text-[var(--muted)]">
                  No notes in {noteMealLabel}.
                </p>
              </Card>
            ) : (
              <div className="card-grid-2">
                {visibleNoteDishes.map((d) => (
                  <Card
                    key={d.dishName}
                    className="note-dish cursor-pointer !p-4"
                    role="button"
                    tabIndex={0}
                    onClick={() => setOpenNoteDish(d.dishName)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setOpenNoteDish(d.dishName);
                      }
                    }}
                  >
                    <p className="font-semibold tracking-tight text-[var(--ink)]">
                      {d.dishName}
                    </p>
                    <p className="mt-0.5 text-xs capitalize text-[var(--muted)]">
                      {d.meal} · {d.station}
                    </p>
                    <p className="mt-1.5 text-sm leading-snug text-[var(--ink-soft)]">
                      {d.avgStars != null && (
                        <span className="dish-stars-read mr-2">
                          {"★".repeat(Math.round(d.avgStars))}
                          <span className="dish-stars-off">
                            {"★".repeat(5 - Math.round(d.avgStars))}
                          </span>
                        </span>
                      )}
                      {d.count} note{d.count === 1 ? "" : "s"}
                    </p>
                  </Card>
                ))}
              </div>
            )}
            {openNoteDish && (
              <NoteDishPanel
                dishName={openNoteDish}
                date={date}
                seedCounts={openDish?.starCounts}
                seedAvg={openDish?.avgStars}
                seedCount={openDish?.count}
                onClose={() => setOpenNoteDish(null)}
              />
            )}
          </>
        )}

        {room === "people" && (
          <>
            <div className="admin-people-tools">
              <input
                className="field"
                value={peopleDraft}
                onChange={(e) => setPeopleDraft(e.target.value)}
                placeholder="Search people"
                aria-label="Search people"
              />
            </div>
            {employees.length === 0 ? (
              <Card>
                <p className="text-sm text-[var(--muted)]">
                  {peopleQ ? "No people match." : "No people yet."}
                </p>
              </Card>
            ) : (
              <div className="admin-people">
                {employees.map((u) => {
                  const self = !canToggleAdmin({ targetId: u.id, selfId });
                  return (
                    <PersonCard
                      key={u.id}
                      person={u}
                      self={self}
                      open={openPersonId === u.id}
                      onOpen={() => setOpenPersonId(u.id)}
                      onClose={() => setOpenPersonId(null)}
                      onToggleAdmin={() => toggleAdmin(u.id, !u.isAdmin)}
                      onToggleBlock={() =>
                        toggleBlock(u.id, !u.isBlocked)
                      }
                    />
                  );
                })}
              </div>
            )}
            <PeopleRail
              page={peoplePage}
              pageCount={peoplePageCount}
              onPage={(next) => {
                setOpenPersonId(null);
                setPeoplePage(next);
              }}
            />
          </>
        )}

        {room === "hours" && (
          <>
            <div className="admin-hours-layout">
              {(["Breakfast", "Lunch"] as const).map((meal) => (
                <Card
                  key={meal}
                  className={
                    meal === "Breakfast"
                      ? "admin-hours-breakfast"
                      : "admin-hours-lunch"
                  }
                >
                  <h2 className="card-title">{meal}</h2>
                  <div className="admin-hours-stack">
                    {HOUR_FIELDS.filter((f) => f.meal === meal).map((f) => {
                      const t = parseHHMM(hours[f.key]);
                      return (
                        <button
                          key={f.key}
                          type="button"
                          className="admin-hours-pick"
                          data-active={hourField === f.key}
                          aria-pressed={hourField === f.key}
                          onClick={() => setHourField(f.key)}
                        >
                          <span>{f.bound}</span>
                          <span className="admin-hours-pick-time">
                            {t ? formatAnalogLabel(t) : hours[f.key]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </Card>
              ))}
              <Card className="admin-hours-dial">
                <p className="card-title">
                  {HOUR_FIELDS.find((f) => f.key === hourField)?.meal} ·{" "}
                  {HOUR_FIELDS.find((f) => f.key === hourField)?.bound}
                </p>
                <AnalogWatch
                  key={hourField}
                  label={`${HOUR_FIELDS.find((f) => f.key === hourField)?.meal} ${HOUR_FIELDS.find((f) => f.key === hourField)?.bound}`}
                  value={hours[hourField]}
                  onChange={(next) =>
                    setHours((cur) => ({ ...cur, [hourField]: next }))
                  }
                />
              </Card>
            </div>
            <div className="admin-hours-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={hoursSaving || loading}
                onClick={() => void saveHours()}
              >
                {hoursSaving ? "Saving…" : "Save hours"}
              </button>
            </div>
          </>
        )}
      </div>
      </div>
    </Page>
  );
}
