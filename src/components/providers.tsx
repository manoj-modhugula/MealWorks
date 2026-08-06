"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "./theme-provider";
import { TimezoneSync } from "./timezone-sync";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <TimezoneSync />
        {children}
      </ThemeProvider>
    </SessionProvider>
  );
}
