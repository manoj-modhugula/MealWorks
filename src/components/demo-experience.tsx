"use client";
import { useState } from "react";
import { ExperienceContext } from "./experience-provider";
import { createDemoWorkspace } from "@/lib/demo-workspace";
export function DemoExperience({ children }: { children: React.ReactNode }) {
  const [workspace] = useState(createDemoWorkspace);
  return (
    <ExperienceContext.Provider value={workspace}>
      {children}
    </ExperienceContext.Provider>
  );
}
