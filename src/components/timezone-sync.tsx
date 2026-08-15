"use client";

import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { deviceTimeZone } from "@/lib/client-date";

function lastKey(userId: string) {
  return `mealworks:tz:${userId}`;
}

/**
 * Keeps prefs.timezone on the device zone while they stay on System.
 * A city they picked in Settings is left alone.
 */
export function TimezoneSync() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;

    const tz = deviceTimeZone();
    const storageKey = lastKey(session.user.id);
    let last = "";
    try {
      last = sessionStorage.getItem(storageKey) || "";
    } catch {
      /* private mode */
    }
    if (last === tz) return;

    let cancelled = false;
    (async () => {
      try {
        const data = await fetch("/api/preferences").then((r) => r.json());
        if (cancelled) return;
        const saved = (data.prefs?.timezone as string) || "";
        const following = !last || saved === last || saved === tz || !saved;
        if (!following) return;

        const res = await fetch("/api/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timezone: tz, runAi: false }),
        });
        if (!res.ok || cancelled) return;
        try {
          sessionStorage.setItem(storageKey, tz);
        } catch {
          /* ignore */
        }
      } catch {
        /* offline / not ready */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.id]);

  return null;
}
