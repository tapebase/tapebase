"use client";

import { useEffect, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const storageKey = "tapebase-theme";
const changeEvent = "tapebase-theme-change";

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(changeEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(changeEvent, callback);
  };
}

function getTheme(): Theme {
  return window.localStorage.getItem(storageKey) === "dark" ? "dark" : "light";
}

export function ThemeSettings() {
  const theme = useSyncExternalStore(subscribe, getTheme, (): Theme => "light");

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function selectTheme(nextTheme: Theme) {
    window.localStorage.setItem(storageKey, nextTheme);
    applyTheme(nextTheme);
    window.dispatchEvent(new Event(changeEvent));
  }

  return <section className="rounded-3xl bg-white p-6 shadow-sm lg:col-span-2" aria-labelledby="appearance-heading">
    <h2 id="appearance-heading" className="text-2xl font-black">Opcje profilu</h2>
    <fieldset className="mt-5">
      <legend className="font-bold">Motyw aplikacji</legend>
      <p className="mt-1 text-sm text-zinc-500">Wybór jest zapamiętywany na tym urządzeniu.</p>
      <div className="mt-4 grid max-w-md grid-cols-2 gap-3">
        <button
          type="button"
          aria-pressed={theme === "light"}
          onClick={() => selectTheme("light")}
          className={`rounded-xl border px-5 py-3 font-bold transition-colors ${theme === "light" ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-300 bg-white"}`}
        >☀ Jasny</button>
        <button
          type="button"
          aria-pressed={theme === "dark"}
          onClick={() => selectTheme("dark")}
          className={`rounded-xl border px-5 py-3 font-bold transition-colors ${theme === "dark" ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-300 bg-white"}`}
        >☾ Ciemny</button>
      </div>
    </fieldset>
  </section>;
}
