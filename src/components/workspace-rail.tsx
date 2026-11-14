"use client";
import { useEffect, useState } from "react";

type Section = { id: string; label: string };
export function WorkspaceRail({
  label,
  sections,
}: {
  label: string;
  sections: Section[];
}) {
  const [active, setActive] = useState(sections[0]?.id);
  const sectionKey = sections.map((section) => section.id).join(",");
  useEffect(() => {
    const targets = sectionKey
      .split(",")
      .map((id) => document.getElementById(id))
      .filter((target): target is HTMLElement => !!target);
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = targets[0];
      for (const target of targets) {
        if (target.getBoundingClientRect().top <= 145) current = target;
      }
      if (
        window.scrollY > 0 &&
        window.scrollY + window.innerHeight >=
          document.documentElement.scrollHeight - 2
      )
        current = targets[targets.length - 1];
      if (current) setActive(current.id);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    update();
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.cancelAnimationFrame(frame);
    };
  }, [sectionKey]);
  return (
    <nav className="workspace-rail" aria-label={label}>
      {sections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          aria-current={active === section.id ? "location" : undefined}
          onClick={() => setActive(section.id)}
        >
          {section.label}
        </a>
      ))}
    </nav>
  );
}
