import React, { createContext, useContext } from "react";
import { useAppliedTheme } from "@/theme/orbitTheme";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Uygulanan temayı alt bileşenlere taşır (ör. bildirim kutucukları).
 *
 * 2026-10-15: Bu sağlayıcı eskiden `dark` sınıfını kendisi ekleyip
 * kaldırıyordu ve açılışta her zaman açık temaya zorluyordu. Temanın tek
 * kaynağı artık `@/theme/orbitTheme`; burası yalnız okur.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useAppliedTheme();
  return (
    <ThemeContext.Provider value={{ theme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
