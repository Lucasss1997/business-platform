"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const saved = (localStorage.getItem("platform-theme") as Theme | null) ?? "system";
    setTheme(saved);
    applyTheme(saved);

    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      const current =
        (localStorage.getItem("platform-theme") as Theme | null) ?? "system";

      if (current === "system") {
        applyTheme("system");
      }
    };

    media.addEventListener("change", handleChange);

    return () => {
      media.removeEventListener("change", handleChange);
    };
  }, []);

  function applyTheme(selected: Theme) {
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    const dark =
      selected === "dark" ||
      (selected === "system" && systemDark);

    document.documentElement.classList.toggle("dark", dark);
  }

  function changeTheme(selected: Theme) {
    setTheme(selected);
    localStorage.setItem("platform-theme", selected);
    applyTheme(selected);
  }

  return (
    <div
      className="flex items-center rounded-full p-1"
      style={{
        background: "var(--surface-soft)",
        border: "1px solid var(--border)",
      }}
    >
      <ThemeButton
        active={theme === "light"}
        label="☀"
        title="Light theme"
        onClick={() => changeTheme("light")}
      />
      <ThemeButton
        active={theme === "system"}
        label="◐"
        title="System theme"
        onClick={() => changeTheme("system")}
      />
      <ThemeButton
        active={theme === "dark"}
        label="☾"
        title="Dark theme"
        onClick={() => changeTheme("dark")}
      />
    </div>
  );
}

function ThemeButton({
  active,
  label,
  title,
  onClick,
}: {
  active: boolean;
  label: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
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