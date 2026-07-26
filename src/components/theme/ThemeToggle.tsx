"use client";

import { useTheme } from "@/components/theme/ThemeProvider";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Переключить тему"
      className="inline-flex size-10 items-center justify-center rounded-xl border border-line bg-bg-soft text-ink transition hover:border-accent hover:text-accent"
      title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}
