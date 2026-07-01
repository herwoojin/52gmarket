"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "default" | "basic" | "galaxy" | "paper";

interface ThemeCtx { theme: Theme; setTheme: (t: Theme) => void; }
const ThemeContext = createContext<ThemeCtx>({ theme: "default", setTheme: () => {} });

function applyTheme(t: Theme) {
  if (t === "default") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("default");

  useEffect(() => {
    const saved = (localStorage.getItem("oiji-theme") ?? "default") as Theme;
    setThemeState(saved);
    applyTheme(saved);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem("oiji-theme", t);
    applyTheme(t);
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
