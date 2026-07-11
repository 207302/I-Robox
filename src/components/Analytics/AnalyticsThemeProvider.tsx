"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type AnalyticsThemeContextValue = {
  darkMode: boolean;
  toggleDarkMode: () => void;
};

const AnalyticsThemeContext = createContext<AnalyticsThemeContextValue | null>(null);

export function AnalyticsThemeProvider({ children }: { children: ReactNode }) {
  const [darkMode, setDarkMode] = useState(false);

  return (
    <AnalyticsThemeContext.Provider
      value={{
        darkMode,
        toggleDarkMode: () => setDarkMode((value) => !value),
      }}
    >
      <div
        className={`analytics-dashboard min-h-screen ${
          darkMode ? "dark bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"
        }`}
      >
        {children}
      </div>
    </AnalyticsThemeContext.Provider>
  );
}

export function useAnalyticsTheme(): AnalyticsThemeContextValue {
  const ctx = useContext(AnalyticsThemeContext);
  if (!ctx) {
    throw new Error("useAnalyticsTheme must be used within AnalyticsThemeProvider");
  }
  return ctx;
}
