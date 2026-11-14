"use client";
import { createContext, useContext } from "react";
import { getCache, setCache, invalidateCache } from "@/lib/client-cache";
import { requestJson } from "@/lib/client-request";

const live = {
  isDemo: false,
  fetch: (url: string, init?: RequestInit) => fetch(url, init),
  requestJson,
  getCache,
  setCache,
  invalidateCache,
};
export const ExperienceContext = createContext(live);
export function useExperience() {
  return useContext(ExperienceContext);
}
