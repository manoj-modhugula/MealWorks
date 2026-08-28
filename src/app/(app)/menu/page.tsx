"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardList } from "lucide-react";
import {
  Card,
  EmptyState,
  Page,
  PageHeader,
  PageSkeleton,
} from "@/components/ui";
import { DateNav } from "@/components/date-nav";
import { todayOnDevice, withDeviceTz } from "@/lib/client-date";
import { getCache, setCache } from "@/lib/client-cache";
import {
  DEFAULT_CAFE_HOURS,
  MEAL_VIEWS,
  defaultMealFromHours,
  type MealView,
} from "@/lib/meal-hours";
import { SHOT_MS, scrollAt } from "@/lib/shot-scroll";

type MenuPack = {
  date: string;
  sourceImagePath?: string | null;
  isFallback?: boolean;
  menu: {
    meals: {
      type: string;
      stations: { name: string; items: { name: string; tags: string[] }[] }[];
    }[];
  };
};

export default function MenuPage() {
  const [date, setDate] = useState(() => todayOnDevice());
  const cached0 = getCache<MenuPack | null>(`menu:${todayOnDevice()}`);
  const [loading, setLoading] = useState(cached0 === undefined);
  const [menu, setMenu] = useState<MenuPack | null>(
    cached0 === undefined ? null : cached0
  );
  const [mealFilter, setMealFilter] = useState<MealView>(() =>
    defaultMealFromHours(new Date(), DEFAULT_CAFE_HOURS)
  );
  const [shotOpen, setShotOpen] = useState(false);
  const shotScroll = useRef(0);
  const shotAnim = useRef<number | null>(null);

  useEffect(() => {
    const key = `menu:${date}`;
    const cached = getCache<MenuPack | null>(key);
    if (cached !== undefined) {
      setMenu(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(withDeviceTz("/api/menu/today", { date }));
        const data = await res.json();
        if (cancelled) return;
        setMenu(data.menu ?? null);
        setCache(key, data.menu ?? null, 3 * 60_000);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date]);

  useEffect(() => {
    setShotOpen(false);
    if (shotAnim.current) window.cancelAnimationFrame(shotAnim.current);
  }, [date]);

  useEffect(() => {
    return () => {
      if (shotAnim.current) window.cancelAnimationFrame(shotAnim.current);
    };
  }, []);

  useEffect(() => {
    if (!shotOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeShot();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shotOpen]);

  function reduceMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function openShot() {
    if (shotAnim.current) window.cancelAnimationFrame(shotAnim.current);
    shotScroll.current = window.scrollY;
    setShotOpen(true);
  }

  function closeShot() {
    setShotOpen(false);
    const from = window.scrollY;
    const to = shotScroll.current;
    if (reduceMotion() || Math.abs(from - to) < 1) {
      window.scrollTo(0, to);
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const y = scrollAt(from, to, now - start, SHOT_MS);
      window.scrollTo(0, y);
      if (now - start < SHOT_MS) {
        shotAnim.current = window.requestAnimationFrame(step);
      } else {
        shotAnim.current = null;
      }
    };
    shotAnim.current = window.requestAnimationFrame(step);
  }

  const stations = useMemo(() => {
    if (!menu) return [];
    const all = menu.menu.meals.flatMap((meal) =>
      meal.stations.map((st) => ({
        ...st,
        meal: meal.type,
        alwaysOn: st.name === "Salad Compose",
      }))
    );
    if (mealFilter === "salad") {
      return all.filter((st) => st.alwaysOn);
    }
    if (mealFilter === "breakfast") {
      return all.filter(
        (st) =>
          !st.alwaysOn && String(st.meal).toLowerCase() === "breakfast"
      );
    }
    // Lunch specials + always-on salad bar
    return all.filter(
      (st) => st.alwaysOn || String(st.meal).toLowerCase() === "lunch"
    );
  }, [menu, mealFilter]);

  return (
    <Page>
      <PageHeader
        title="Menu"
        subtitle={menu?.date}
        action={
          <DateNav date={date} onChange={setDate} maxDate={todayOnDevice()} />
        }
      />

      {loading && !menu && <PageSkeleton rows={4} />}

      {!loading && !menu && (
        <EmptyState
          icon={ClipboardList}
          title="Nothing posted"
          body="Menus usually land mid-morning."
        />
      )}

      {menu && (
        <div className="animate-in space-y-5">
          {menu.isFallback && (
            <p className="text-xs font-semibold text-[var(--muted)]">
              Latest posted · {menu.date}
            </p>
          )}

          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Meal">
            {MEAL_VIEWS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className="chip"
                role="radio"
                aria-checked={mealFilter === id}
                data-active={mealFilter === id}
                onClick={() => setMealFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {menu.sourceImagePath && (
            <Card className="!overflow-hidden !p-2">
              <button
                type="button"
                className="menu-shot"
                data-open={shotOpen ? "true" : undefined}
                aria-expanded={shotOpen}
                aria-label={
                  shotOpen
                    ? "Shrink today’s café menu"
                    : "Grow today’s café menu"
                }
                onClick={() => (shotOpen ? closeShot() : openShot())}
              >
                <Image
                  src={menu.sourceImagePath}
                  alt="Today’s café menu"
                  width={1200}
                  height={1200}
                  className="menu-shot-img"
                  unoptimized
                />
              </button>
            </Card>
          )}

          <div className="card-grid-2">
            {stations.map((st) => (
              <Card key={`${st.meal}-${st.name}`}>
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
                  {st.alwaysOn ? st.name : `${st.meal} · ${st.name}`}
                </p>
                <ul className="mt-2">
                  {st.items.map((it) => (
                    <li key={it.name} className="dish-line">
                      <span>{it.name}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
          {stations.length === 0 && (
            <p className="text-sm text-[var(--muted)]">No stations in this meal.</p>
          )}
        </div>
      )}
    </Page>
  );
}
