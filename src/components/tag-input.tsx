"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { ALLERGY_FAMILIES } from "@/lib/matching";
import { compactSkipTerms } from "@/lib/profile-bio";

const SUGGESTIONS = compactSkipTerms(Object.keys(ALLERGY_FAMILIES));

export function TagInput({
  value,
  onChange,
  placeholder = "Type and press Enter",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  const tags = useMemo(() => compactSkipTerms(value), [value]);

  const hints = useMemo(() => {
    const q = draft.trim().toLowerCase();
    const taken = new Set(tags);
    const pool = SUGGESTIONS.filter((s) => !taken.has(s));
    if (!q) return pool.slice(0, 8);
    return pool.filter((s) => s.includes(q)).slice(0, 8);
  }, [draft, tags]);

  function add(tag: string) {
    const t = tag.trim().toLowerCase();
    if (!t) return;
    const next = compactSkipTerms([...value, t]);
    if (next.length === tags.length && tags.includes(t)) return;
    onChange(next);
    setDraft("");
  }

  function remove(tag: string) {
    onChange(tags.filter((v) => v !== tag));
  }

  return (
    <div>
      <div className="field flex flex-wrap gap-1.5 !py-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-0.5 rounded-full bg-[var(--bg)] px-2.5 py-1 text-xs font-semibold text-[var(--ink)] ring-1 ring-[var(--tag-ring)]"
          >
            {tag}
            <button
              type="button"
              className="ml-0.5 text-[var(--muted)] hover:text-[var(--ink)]"
              onClick={() => remove(tag)}
              aria-label={`Remove ${tag}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--field-placeholder)]"
          value={draft}
          placeholder={tags.length ? "" : placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft.replace(/,/g, ""));
            }
            if (e.key === "Backspace" && !draft && tags.length) {
              remove(tags[tags.length - 1]);
            }
          }}
        />
      </div>
      {hints.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {hints.map((h) => (
            <button
              key={h}
              type="button"
              className="chip !py-1 !text-xs"
              onClick={() => add(h)}
            >
              + {h}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
