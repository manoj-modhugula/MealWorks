"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Settings, Sparkles, Sun, UtensilsCrossed, Wrench } from "lucide-react";

const baseLinks = [
  { href: "/today", label: "Today", Icon: Sun },
  { href: "/menu", label: "Menu", Icon: UtensilsCrossed },
  { href: "/preferences", label: "Preferences", Icon: Sparkles },
  { href: "/settings", label: "Settings", Icon: Settings },
];

/** Native links keep navigation predictable for touch, keyboard and browser history. */
export function AppNav({ demo = false }: { demo?: boolean }) {
  const pathname = usePathname();
  const { data } = useSession();
  const pendingTop = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (pendingTop.current !== pathname) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    pendingTop.current = null;
  }, [pathname]);
  function navigateToTop(href: string) {
    pendingTop.current = href;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }

  const links =
    !demo && data?.user?.isAdmin
      ? [...baseLinks, { href: "/admin", label: "Admin", Icon: Wrench }]
      : baseLinks;
  const route = (href: string) => (demo ? `/demo${href}` : href);
  const active = (href: string) =>
    pathname === route(href) || pathname.startsWith(route(href) + "/");
  return (
    <>
      <header className="nav-island-wrap">
        <div className="nav-island">
          <Link
            href={route("/today")}
            scroll={false}
            onNavigate={() => navigateToTop(route("/today"))}
            className="nav-island-brand brand-home"
            aria-label="MealWorks home"
          >
            <UtensilsCrossed size={25} strokeWidth={1.7} aria-hidden="true" />
            <span className="brand-wordmark">MealWorks</span>
          </Link>
          <nav className="desktop-nav-links nav-island-links" aria-label="Main">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={route(href)}
                scroll={false}
                onNavigate={() => navigateToTop(route(href))}
                className="nav-pill"
                data-active={active(href)}
                aria-current={active(href) ? "page" : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <nav className="bottom-dock md:hidden" aria-label="Mobile">
        <div className="bottom-dock-island glass">
          {links.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={route(href)}
              scroll={false}
              onNavigate={() => navigateToTop(route(href))}
              className="dock-item"
              data-active={active(href)}
              aria-current={active(href) ? "page" : undefined}
            >
              <Icon size={20} strokeWidth={1.7} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
