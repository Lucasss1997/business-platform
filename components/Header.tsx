"use client";

import { useEffect, useState } from "react";

type HeaderProps = {
  title?: string;
  subtitle?: string;
  buttonLabel?: string;
};

type Theme = "light" | "dark" | "system";

export default function Header({
  title = "Commercial Consultancy Dashboard",
  subtitle = "Central hub for CRM, opportunities, tasks and sales guidance.",
  buttonLabel = "Add Lead",
}: HeaderProps) {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const savedTheme = localStorage.getItem("platform-theme") as Theme | null;
    const initialTheme = savedTheme || "system";

    setTheme(initialTheme);
    applyTheme(initialTheme);

    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const handleSystemThemeChange = () => {
      if (
        (localStorage.getItem("platform-theme") as Theme | null) === "system" ||
        !localStorage.getItem("platform-theme")
      ) {
        applyTheme("system");
      }
    };

    media.addEventListener("change", handleSystemThemeChange);

    return () => {
      media.removeEventListener("change", handleSystemThemeChange);
    };
  }, []);

  function applyTheme(selectedTheme: Theme) {
    const systemDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;

    const shouldUseDark =
      selectedTheme === "dark" ||
      (selectedTheme === "system" && systemDark);

    document.documentElement.classList.toggle("dark", shouldUseDark);
  }

  function changeTheme(selectedTheme: Theme) {
    setTheme(selectedTheme);
    localStorage.setItem("platform-theme", selectedTheme);
    applyTheme(selectedTheme);
  }

  return (
    <header
      className="px-8 py-6"
      style={{
        background: "var(--header-background)",
        borderBottom: "1px solid var(--header-border)",
      }}
    >
      <p
        className="text-xs font-bold uppercase tracking-[0.3em]"
        style={{ color: "var(--accent)" }}
      >
        MLT Portal
      </p>

      <div className="mt-2 flex items-end justify-between gap-6">
        <div>
          <h2
            className="text-3xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            {title}
          </h2>

          <p
            className="mt-2"
            style={{ color: "var(--text-secondary)" }}
          >
            {subtitle}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="flex rounded-full p-1"
            style={{
              background: "var(--surface-soft)",
              border: "1px solid var(--border)",
            }}
          >
            <ThemeButton
              active={theme === "light"}
              onClick={() => changeTheme("light")}
              label="☀"
              title="Light theme"
            />

            <ThemeButton
              active={theme === "system"}
              onClick={() => changeTheme("system")}
              label="◐"
              title="Use system theme"
            />

            <ThemeButton
              active={theme === "dark"}
              onClick={() => changeTheme("dark")}
              label="☾"
              title="Dark theme"
            />
          </div>

          {buttonLabel && (
            <button
              className="rounded-full px-5 py-3 text-sm font-bold shadow-sm transition"
              style={{
                background: "var(--button-primary)",
                color: theme === "dark" ? "#07130d" : "#ffffff",
              }}
            >
              {buttonLabel}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function ThemeButton({
  active,
  onClick,
  label,
  title,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex h-8 w-8 items-center justify-center rounded-full text-sm transition"
      style={{
        background: active ? "var(--surface)" : "transparent",
        color: active ? "var(--accent)" : "var(--text-secondary)",
        boxShadow: active ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
      }}
    >
      {label}
    </button>
  );
}