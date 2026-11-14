"use client";
import { useExperience } from "@/components/experience-provider";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ClipboardList, Utensils } from "lucide-react";
import { Alert, EmptyState, Page, PageSkeleton } from "@/components/ui";
import { EditorDialog } from "@/components/editor-dialog";
import { DateNav } from "@/components/date-nav";
import { todayOnDevice, withDeviceTz } from "@/lib/client-date";
import { dishPhoto } from "@/lib/sample-catalog";
import {
  DEFAULT_CAFE_HOURS,
  MEAL_VIEWS,
  defaultMealFromHours,
  type MealView,
} from "@/lib/meal-hours";
type MenuPack = {
  date: string;
  sourceImagePath?: string | null;
  meta?: { previewCatalog?: boolean };
  isFallback?: boolean;
  menu: {
    meals: {
      type: string;
      stations: { name: string; items: { name: string; tags: string[] }[] }[];
    }[];
  };
};

export default function MenuPage() {
  const { requestJson, getCache, setCache } = useExperience();
  const [date, setDate] = useState(() => todayOnDevice());
  const cached = getCache<MenuPack | null>(`menu:${todayOnDevice()}`);
  const [menu, setMenu] = useState<MenuPack | null>(cached ?? null);
  const [loading, setLoading] = useState(cached === undefined);
  const [error, setError] = useState("");
  const [mealFilter, setMealFilter] = useState<MealView>(() =>
    defaultMealFromHours(new Date(), DEFAULT_CAFE_HOURS),
  );
  const [shotOpen, setShotOpen] = useState(false);
  const [selection, setSelection] = useState<{
    context: string;
    station: string;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const key = `menu:${date}`;
    const cached = getCache<MenuPack | null>(key);
    setMenu(cached ?? null);
    setLoading(cached === undefined);
    setError("");
    setShotOpen(false);
    requestJson<{ menu: MenuPack | null }>(
      withDeviceTz("/api/menu/today", { date }),
      { signal: controller.signal },
    )
      .then((data) => {
        setMenu(data.menu);
        setCache(key, data.menu, 180_000);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [date, requestJson, getCache, setCache]);
  const stations = useMemo(() => {
    const all =
      menu?.menu.meals.flatMap((meal) =>
        meal.stations.map((st) => ({
          ...st,
          meal: meal.type,
          alwaysOn: st.name === "Salad Compose",
        })),
      ) || [];
    return all.filter((st) =>
      mealFilter === "salad"
        ? st.alwaysOn
        : mealFilter === "breakfast"
          ? !st.alwaysOn && st.meal.toLowerCase() === "breakfast"
          : st.alwaysOn || st.meal.toLowerCase() === "lunch",
    );
  }, [menu, mealFilter]);
  // Apply the selection only to its own day and meal. If it is unavailable,
  // show the first station rather than an empty or unrelated dish panel.
  const context = `${date}:${mealFilter}`;
  const activeStation =
    stations.find(
      (st) =>
        selection?.context === context &&
        `${st.meal}:${st.name}` === selection.station,
    ) || stations[0];
  return (
    <Page>
      <h1 className="sr-only">Menu</h1>
      <div className="menu-toolbar">
        <div
          className="flex flex-wrap gap-2"
          role="radiogroup"
          aria-label="Meal"
        >
          {MEAL_VIEWS.map(({ id, label }) => (
            <button
              type="button"
              className="chip"
              role="radio"
              aria-checked={mealFilter === id}
              data-active={mealFilter === id}
              key={id}
              onClick={() => setMealFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <DateNav date={date} onChange={setDate} maxDate={todayOnDevice()} />
      </div>
      {menu?.isFallback && (
        <p className="menu-posted-context">Latest posted · {menu.date}</p>
      )}
      {error && <Alert tone="bad">{error}</Alert>}
      {loading && !menu && <PageSkeleton rows={4} />}
      {!loading && !menu && !error && (
        <EmptyState
          icon={ClipboardList}
          title="Nothing posted yet"
          body="The café menu will appear here as soon as it’s available."
        />
      )}
      {menu && (
        <div className="animate-in">
          {activeStation && (
            <div className="menu-feature">
              <section
                id="station-dishes"
                className="station-panel"
                aria-label={`${activeStation.name} dishes`}
              >
                <div
                  className="station-content animate-in"
                  key={`${context}:${activeStation.meal}:${activeStation.name}`}
                >
                  {activeStation.alwaysOn && !menu.meta?.previewCatalog ? (
                    <ul
                      className="station-ingredients"
                      aria-label="Available salad ingredients"
                    >
                      {activeStation.items.map((item) => (
                        <li key={item.name}>{item.name}</li>
                      ))}
                    </ul>
                  ) : activeStation.items.length ? (
                    <ul
                      className="menu-photo-grid"
                      data-dish-count={activeStation.items.length}
                      aria-label={`${activeStation.name} dishes`}
                    >
                      {activeStation.items.map((item, index) => {
                        const photo = dishPhoto(item.name);
                        return (
                          <li
                            key={item.name}
                            className="menu-photo-card"
                            data-featured={index === 0}
                          >
                            <div className="menu-dish-image">
                              {photo ? (
                                <Image
                                  src={photo}
                                  alt=""
                                  fill
                                  sizes={
                                    index === 0
                                      ? "(max-width: 767px) 92vw, 850px"
                                      : "(max-width: 600px) 92vw, (max-width: 767px) 45vw, 420px"
                                  }
                                />
                              ) : (
                                <span className="menu-photo-placeholder">
                                  <Utensils size={28} aria-hidden="true" />
                                </span>
                              )}
                            </div>
                            <h2>{item.name}</h2>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="section-description">
                      No dishes posted at this station.
                    </p>
                  )}
                </div>
              </section>
              <aside className="station-index">
                <h2>Stations</h2>
                <nav aria-label="Café stations">
                  {stations.map((st) => {
                    const active = st === activeStation;
                    return (
                      <button
                        type="button"
                        key={`${st.meal}:${st.name}`}
                        className="station-filter"
                        aria-pressed={active}
                        aria-controls="station-dishes"
                        data-active={active}
                        onClick={() =>
                          setSelection({
                            context,
                            station: `${st.meal}:${st.name}`,
                          })
                        }
                      >
                        <span>{st.name}</span>
                      </button>
                    );
                  })}
                </nav>
                {menu.sourceImagePath && (
                  <button
                    type="button"
                    className="btn btn-secondary posted-menu-button"
                    onClick={() => setShotOpen(true)}
                  >
                    View posted menu <ArrowUpRight size={16} />
                  </button>
                )}
              </aside>
            </div>
          )}
          {!stations.length && (
            <p className="section-description">
              No stations posted for this meal.
            </p>
          )}
        </div>
      )}
      <EditorDialog
        open={shotOpen}
        title="The café’s posted menu"
        onClose={() => setShotOpen(false)}
      >
        {menu?.sourceImagePath && (
          <Image
            src={menu.sourceImagePath}
            alt={`Posted café menu for ${menu.date}`}
            width={1200}
            height={1600}
            className="posted-menu-image"
            unoptimized
          />
        )}
      </EditorDialog>
    </Page>
  );
}
