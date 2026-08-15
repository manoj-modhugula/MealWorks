"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Utensils } from "lucide-react";
import {
  Alert,
  BookLoader,
  Card,
  EmptyState,
  Page,
  PageHeader,
  PageSkeleton,
  ScoreRing,
} from "@/components/ui";
import { DateNav } from "@/components/date-nav";
import { WeekStrip } from "@/components/week-strip";
import { PlateCarousel } from "@/components/plate-carousel";
import { DishCard, type DishNote } from "@/components/dish-card";
import { deviceTimeZone, todayOnDevice, withDeviceTz } from "@/lib/client-date";
import { getCache, setCache } from "@/lib/client-cache";

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
  week: { date: string; score: number | null; hasMenu: boolean }[];
};

export default function TodayPage() {
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
  const [filter, setFilter] = useState<
    "all" | "recommended" | "avoid" | "caution"
  >("recommended");
  const [feedback, setFeedback] = useState<Record<string, DishNote>>(
    cached0?.feedback ?? {}
  );
  const [week, setWeek] = useState<
    { date: string; score: number | null; hasMenu: boolean }[]
  >(cached0?.week ?? []);
  const [openNote, setOpenNote] = useState<string | null>(null);

  const applyPayload = useCallback((data: Record<string, unknown>) => {
    const m = data.menu as {
      id?: string;
      date: string;
      isFallback?: boolean;
    } | null;
    setMenu(m);
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
            withDeviceTz("/api/match/today", { date: d, phase: "baseline" })
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
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load");
        applyPayload(data);

        const w = await fetch(withDeviceTz("/api/week", { date: d })).then(
          (r) => r.json()
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
        setCache<TodayCache>(
          cacheKey,
          {
            menu: m,
            match: matchSnap,
            feedback:
              (data.feedback as Record<string, DishNote>) ||
              (cached?.feedback ?? {}),
            week: weekDays,
          },
          3 * 60_000
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
        setPolishing(false);
        setBookBusy(false);
      }
    },
    [applyPayload, date]
  );

  useEffect(() => {
    load({ d: date });
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setOpenNote(null);
  }, [date, filter]);

  const items = match?.payload?.items || [];
  const recCount = items.filter((i) => i.decision === "recommended").length;
  const avoidCount = items.filter((i) => i.decision === "avoid").length;
  const maybeCount = items.filter((i) => i.decision === "caution").length;

  const filtered = useMemo(() => {
    return items.filter((i) =>
      filter === "all" ? true : i.decision === filter
    );
  }, [items, filter]);

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
      const next = data.feedback as Record<string, DishNote>;
      setFeedback(next);
      const cacheKey = `today:${date}`;
      const cached = getCache<TodayCache>(cacheKey);
      if (cached) setCache(cacheKey, { ...cached, feedback: next }, 3 * 60_000);
    }
  }

  const label = match
    ? verdictLabel[match.verdict] || "Your day"
    : "Today";

  return (
    <Page>
      <PageHeader
        title="Today"
        subtitle={
          menu?.isFallback
            ? `Latest posted · ${menu.date}`
            : menu?.date || undefined
        }
        action={
          <>
            <DateNav
              date={date}
              onChange={setDate}
              maxDate={todayOnDevice()}
            />
            <button
              type="button"
              className="icon-btn book-refresh-btn"
              aria-label={bookBusy ? "Refreshing match" : "Refresh match"}
              disabled={bookBusy}
              onClick={() => load({ rematch: true })}
            >
              <BookLoader label="" compact flipping={bookBusy} />
            </button>
          </>
        }
      />

      {week.length > 0 && (
        <WeekStrip days={week} date={date} onChange={setDate} />
      )}

      {loading && !match && !menu && <PageSkeleton rows={4} />}

      {error && <Alert tone="bad">{error}</Alert>}

      {!loading && !menu && (
        <EmptyState
          icon={Utensils}
          title="No menu yet"
          body="Usually up by mid-morning. Check again after the café posts."
          action={
            <Link href="/menu" className="btn btn-secondary">
              Open menu
            </Link>
          }
        />
      )}

      {menu && match && (
        <div className="animate-in space-y-5">
          {/* Hero */}
          <Card className="!p-5 sm:!p-6">
            <div className="flex flex-wrap items-center gap-5">
              <ScoreRing score={match.score} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--accent-ink)]">
                  {label}
                </p>
                <h2 className="font-display mt-1 text-[1.35rem] font-semibold tracking-tight text-[var(--ink)] sm:text-[1.55rem]">
                  {match.headline}
                </h2>
                <p className="mt-1.5 text-[0.9375rem] leading-snug text-[var(--muted)]">
                  {recCount} good · {maybeCount} maybe · {avoidCount} skip
                </p>
                {polishing && (
                  <p className="mt-2 text-xs font-medium text-[var(--muted)]" role="status">
                    Updating…
                  </p>
                )}
                {menu.isFallback && (
                  <p className="mt-1 text-xs text-[var(--caution-ink)]">
                    No menu this day, showing the latest board.
                  </p>
                )}
                {match.source === "baseline" && !polishing && (
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
            <PlateCarousel combos={match.payload.combos} />
          )}

          <div
            className="flex flex-wrap gap-1.5"
            role="radiogroup"
            aria-label="Filter"
          >
            {(
              [
                ["recommended", `Good ${recCount}`],
                ["caution", `Maybe ${maybeCount}`],
                ["avoid", `Skip ${avoidCount}`],
                ["all", "All"],
              ] as const
            ).map(([id, text]) => (
              <button
                key={id}
                type="button"
                className="chip"
                role="radio"
                aria-checked={filter === id}
                data-active={filter === id}
                data-tone={
                  id === "recommended"
                    ? "good"
                    : id === "avoid"
                      ? "bad"
                      : id === "caution"
                        ? "maybe"
                        : undefined
                }
                onClick={() => {
                  setOpenNote(null);
                  setFilter(id);
                }}
              >
                {text}
              </button>
            ))}
          </div>

          <div className="card-grid-2">
            {filtered.map((item) => (
              <DishCard
                key={`${item.station}-${item.name}`}
                item={item}
                noted={feedback[item.name]}
                open={openNote === item.name}
                onOpen={() => setOpenNote(item.name)}
                onClose={() => setOpenNote(null)}
                onSend={(stars, note) => sendNote(item.name, stars, note)}
              />
            ))}
          </div>
          {filtered.length === 0 && (
            <p className="text-sm text-[var(--muted)]">Nothing in this filter.</p>
          )}
        </div>
      )}
    </Page>
  );
}
