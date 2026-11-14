"use client";
import { useExperience } from "@/components/experience-provider";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCw, Utensils } from "lucide-react";
import {
  Alert,
  Card,
  EmptyState,
  Page,
  PageSkeleton,
  ScoreRing,
} from "@/components/ui";
import { DateNav } from "@/components/date-nav";
import { WeekStrip } from "@/components/week-strip";
import { WeekStripSlot } from "@/components/week-strip-slot";
import { PlateCarousel } from "@/components/plate-carousel";
import { DishInspectorList } from "@/components/dish-inspector";
import { type DishNote } from "@/lib/dish-note";
import { type DishReviewStats } from "@/lib/dish-note";
import { deviceTimeZone, todayOnDevice, withDeviceTz } from "@/lib/client-date";
import {
  DEFAULT_CAFE_HOURS,
  MEAL_VIEWS,
  defaultMealFromHours,
  itemInMealView,
  normalizeCafeHours,
  type CafeHours,
  type MealView,
} from "@/lib/meal-hours";

type MatchItem = {
  name: string;
  meal: string;
  station: string;
  decision: string;
  reason: string;
};

type MatchData = {
  verdict: string;
  score: number;
  headline: string;
  summary: string;
  source?: "ai" | "hybrid" | "baseline";
  payload: {
    items: MatchItem[];
    combos: { title: string; items: string[] }[];
  };
};

function asReviews(raw: unknown): Record<string, DishReviewStats> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, DishReviewStats> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const rec = v as Partial<DishReviewStats>;
    out[k] = {
      avgStars: typeof rec.avgStars === "number" ? rec.avgStars : null,
      count: typeof rec.count === "number" ? rec.count : 0,
    };
  }
  return out;
}

function asDishNotes(raw: unknown): Record<string, DishNote> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, DishNote> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const rec = v as Partial<DishNote>;
    out[k] = {
      vote: rec.vote || "ate",
      stars: rec.stars ?? null,
      note: rec.note || "",
    };
  }
  return out;
}

const verdictLabel: Record<string, string> = {
  great: "Great day",
  mostly_fine: "Mostly fine",
  thin_options: "Thin options",
  not_your_day: "Pack lunch?",
};

type TodayCache = {
  menu: { id?: string; date: string; isFallback?: boolean } | null;
  match: MatchData | null;
  feedback: Record<string, DishNote>;
  reviews: Record<string, DishReviewStats>;
  week: { date: string; score: number | null; hasMenu: boolean }[];
};

export default function TodayPage() {
  const { fetch, getCache, setCache, isDemo } = useExperience();
  const [date, setDate] = useState(() => todayOnDevice());
  const cached0 = getCache<TodayCache>(`today:${todayOnDevice()}`);
  const [loading, setLoading] = useState(!cached0?.match && !cached0?.menu);
  const [polishing, setPolishing] = useState(false);
  const [bookBusy, setBookBusy] = useState(false);
  const [error, setError] = useState("");
  const [menu, setMenu] = useState<{
    id?: string;
    date: string;
    isFallback?: boolean;
  } | null>(cached0?.menu ?? null);
  const [match, setMatch] = useState<MatchData | null>(cached0?.match ?? null);
  const [filter, setFilter] = useState<"recommended" | "avoid">("recommended");
  const [hours, setHours] = useState<CafeHours>(DEFAULT_CAFE_HOURS);
  const [meal, setMeal] = useState<MealView>(() =>
    defaultMealFromHours(new Date(), DEFAULT_CAFE_HOURS),
  );
  const mealTouched = useRef(false);
  const [feedback, setFeedback] = useState<Record<string, DishNote>>(
    cached0?.feedback ?? {},
  );
  const [reviews, setReviews] = useState<Record<string, DishReviewStats>>(
    cached0?.reviews ?? {},
  );
  const [week, setWeek] = useState<
    { date: string; score: number | null; hasMenu: boolean }[]
  >(cached0?.week ?? []);
  const [weekOpen, setWeekOpen] = useState(false);

  const applyPayload = useCallback((data: Record<string, unknown>) => {
    const m = data.menu as {
      id?: string;
      date: string;
      isFallback?: boolean;
    } | null;
    setMenu(m);
    if (data.reviews && typeof data.reviews === "object") {
      setReviews(asReviews(data.reviews));
    }
    const raw = data.match as MatchData | null;
    if (!raw) {
      setMatch(null);
      return;
    }
    const payload =
      raw.payload?.items != null
        ? raw.payload
        : {
            items: (raw as unknown as { items?: MatchItem[] }).items || [],
            combos:
              (raw as unknown as { combos?: MatchData["payload"]["combos"] })
                .combos || [],
          };
    setMatch({
      verdict: raw.verdict,
      score: raw.score,
      headline: raw.headline,
      summary: raw.summary,
      source: raw.source,
      payload: {
        items: payload.items || [],
        combos: payload.combos || [],
      },
    });
    if (data.feedback && typeof data.feedback === "object") {
      setFeedback(asDishNotes(data.feedback));
    }
    if (data.hours && typeof data.hours === "object") {
      const nextHours = normalizeCafeHours(data.hours as Partial<CafeHours>);
      setHours(nextHours);
      if (!mealTouched.current) {
        setMeal(defaultMealFromHours(new Date(), nextHours));
      }
    }
  }, []);

  const load = useCallback(
    async (opts?: { rematch?: boolean; d?: string }) => {
      const d = opts?.d || date;
      const rematch = opts?.rematch || false;
      const cacheKey = `today:${d}`;
      const cached = !rematch ? getCache<TodayCache>(cacheKey) : undefined;

      if (rematch) setBookBusy(true);

      if (cached) {
        setMenu(cached.menu);
        setMatch(cached.match);
        setFeedback(cached.feedback || {});
        setReviews(cached.reviews || {});
        setWeek(cached.week || []);
        setLoading(false);
      } else {
        setLoading(true);
      }

      setError("");
      setPolishing(false);
      const tz = deviceTimeZone();

      try {
        if (!rematch) {
          const baseRes = await fetch(
            withDeviceTz("/api/match/today", { date: d, phase: "baseline" }),
          );
          const baseData = await baseRes.json();
          if (baseRes.ok && baseData.menu) {
            applyPayload(baseData);
            setLoading(false);
            setPolishing(true);
          }
        }

        const res = await fetch(
          rematch
            ? "/api/match/today"
            : withDeviceTz("/api/match/today", { date: d }),
          {
            method: rematch ? "POST" : "GET",
            headers: rematch
              ? { "Content-Type": "application/json" }
              : undefined,
            body: rematch ? JSON.stringify({ date: d, tz }) : undefined,
          },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load");
        applyPayload(data);

        const w = await fetch(withDeviceTz("/api/week", { date: d })).then(
          (r) => r.json(),
        );
        const weekDays = w.days || [];
        setWeek(weekDays);

        // Persist for next navigation
        const m = data.menu as TodayCache["menu"];
        const raw = data.match as MatchData | null;
        let matchSnap: MatchData | null = null;
        if (raw) {
          const payload =
            raw.payload?.items != null
              ? raw.payload
              : {
                  items:
                    (raw as unknown as { items?: MatchItem[] }).items || [],
                  combos:
                    (
                      raw as unknown as {
                        combos?: MatchData["payload"]["combos"];
                      }
                    ).combos || [],
                };
          matchSnap = {
            verdict: raw.verdict,
            score: raw.score,
            headline: raw.headline,
            summary: raw.summary,
            source: raw.source,
            payload: {
              items: payload.items || [],
              combos: payload.combos || [],
            },
          };
        }
        const nextReviews = asReviews(data.reviews);
        setCache<TodayCache>(
          cacheKey,
          {
            menu: m,
            match: matchSnap,
            feedback:
              (data.feedback as Record<string, DishNote>) ||
              (cached?.feedback ?? {}),
            reviews: Object.keys(nextReviews).length
              ? nextReviews
              : (cached?.reviews ?? {}),
            week: weekDays,
          },
          3 * 60_000,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
        setPolishing(false);
        setBookBusy(false);
      }
    },
    [applyPayload, date, fetch, getCache, setCache],
  );

  useEffect(() => {
    load({ d: date });
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mealTouched.current = false;
    setMeal(defaultMealFromHours(new Date(), hours));
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = useMemo(() => match?.payload?.items || [], [match]);
  const scoped = useMemo(
    () => items.filter((i) => itemInMealView(i, meal)),
    [items, meal],
  );
  const recCount = scoped.filter((i) => i.decision === "recommended").length;
  const avoidCount = scoped.filter((i) => i.decision !== "recommended").length;
  const dayRec = items.filter((i) => i.decision === "recommended").length;
  const daySkip = items.filter((i) => i.decision !== "recommended").length;

  const filtered = useMemo(() => {
    return scoped.filter((i) =>
      filter === "recommended"
        ? i.decision === "recommended"
        : i.decision !== "recommended",
    );
  }, [scoped, filter]);

  async function sendNote(dishName: string, stars: number, note: string) {
    if (!menu?.id) throw new Error("No menu today");
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ menuDayId: menu.id, dishName, stars, note }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Couldn’t send");
    if (data.feedback) {
      const next = asDishNotes(data.feedback);
      setFeedback(next);
      const nextReviews =
        data.dish && typeof data.dish === "object"
          ? {
              ...reviews,
              [dishName]: {
                avgStars:
                  typeof data.dish.avgStars === "number"
                    ? data.dish.avgStars
                    : null,
                count:
                  typeof data.dish.count === "number" ? data.dish.count : 0,
              },
            }
          : reviews;
      if (data.dish && typeof data.dish === "object") setReviews(nextReviews);
      const cacheKey = `today:${date}`;
      const cached = getCache<TodayCache>(cacheKey);
      if (cached) {
        setCache(
          cacheKey,
          { ...cached, feedback: next, reviews: nextReviews },
          3 * 60_000,
        );
      }
    }
  }

  const label = isDemo
    ? "Today’s selection"
    : match
      ? verdictLabel[match.verdict] || "Your day"
      : "Today";

  const dateControls = (
    <div className="today-date-controls">
      <DateNav
        date={date}
        onChange={setDate}
        maxDate={todayOnDevice()}
        onHold={() => setWeekOpen((v) => !v)}
      />
      <button
        type="button"
        className="icon-btn book-refresh-btn"
        aria-label={bookBusy ? "Refreshing match" : "Refresh match"}
        disabled={bookBusy}
        onClick={() => load({ rematch: true })}
      >
        <RotateCw
          size={18}
          className={bookBusy ? "refresh-spinning" : undefined}
        />
      </button>
    </div>
  );

  return (
    <Page className="today-page">
      <h1 className="sr-only">Today</h1>
      {!match?.payload.combos?.length && (
        <div className="today-context-toolbar">{dateControls}</div>
      )}

      {week.length > 0 && (
        <WeekStripSlot open={weekOpen}>
          <WeekStrip days={week} date={date} onChange={setDate} />
        </WeekStripSlot>
      )}

      {loading && !match && !menu && <PageSkeleton rows={4} />}

      {error && <Alert tone="bad">{error}</Alert>}

      {!loading && !menu && (
        <EmptyState
          icon={Utensils}
          title="No menu yet"
          body="Usually up by mid-morning. Check again after the café posts."
          action={
            <Link
              href={isDemo ? "/demo/menu" : "/menu"}
              className="btn btn-secondary"
            >
              Open menu
            </Link>
          }
        />
      )}

      {menu && match && (
        <div className="animate-in today-content">
          {/* Hero */}
          <div className="today-overview">
            <Card className="today-summary">
              <div className="today-summary-layout">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--accent-ink)]">
                    {label}
                  </p>
                  <h2 className="today-headline">{match.headline}</h2>
                  <p className="today-summary-description">{match.summary}</p>
                  <div
                    className="today-fit-summary"
                    title="Fit measures available choices across meals. Favorites and goals can reorder your picks without changing this score."
                  >
                    <ScoreRing score={match.score} />
                    <div className="today-fit-counts">
                      <p>{dayRec} good</p>
                      <p>{daySkip} skip</p>
                      <span className="fit-score-explanation">
                        {match.score >= 97
                          ? "Enough choices at every meal"
                          : "Variety across your meals"}
                      </span>
                    </div>
                  </div>
                  {polishing && (
                    <p
                      className="mt-2 text-xs font-medium text-[var(--muted)]"
                      role="status"
                    >
                      Updating…
                    </p>
                  )}
                  {!menu.isFallback && (
                    <p className="today-summary-footnote">
                      Choose a dish below for ratings, notes and your review.
                    </p>
                  )}
                  {menu.isFallback && (
                    <p className="mt-1 text-xs text-[var(--caution-ink)]">
                      No menu this day, showing the latest board.
                    </p>
                  )}
                  {!isDemo && match.source === "baseline" && !polishing && (
                    <button
                      type="button"
                      className="mt-2 text-xs font-semibold text-[var(--accent)]"
                      onClick={() => load({ rematch: true })}
                    >
                      Refresh match
                    </button>
                  )}
                </div>
              </div>
            </Card>

            {match.payload.combos?.length > 0 && (
              <PlateCarousel
                headerAction={dateControls}
                combos={match.payload.combos}
              />
            )}
          </div>
          <div className="today-filter-row">
            <div
              className="today-filter-chips"
              role="radiogroup"
              aria-label="Filter"
            >
              {(
                [
                  ["recommended", `Good ${recCount}`],
                  ["avoid", `Skip ${avoidCount}`],
                ] as const
              ).map(([id, text]) => (
                <button
                  key={id}
                  type="button"
                  className="chip"
                  role="radio"
                  aria-checked={filter === id}
                  data-active={filter === id}
                  data-tone={id === "recommended" ? "good" : "bad"}
                  onClick={() => {
                    setFilter(id);
                  }}
                >
                  {text}
                </button>
              ))}
            </div>
            <div className="today-meal-select">
              <select
                className="today-meal-select-face"
                aria-label="Meal"
                value={meal}
                onChange={(e) => {
                  mealTouched.current = true;
                  setMeal(e.target.value as MealView);
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

          <DishInspectorList
            key={`${date}:${meal}:${filter}`}
            items={filtered}
            feedback={feedback}
            reviews={reviews}
            date={menu.date}
            onSend={sendNote}
          />
        </div>
      )}
    </Page>
  );
}
