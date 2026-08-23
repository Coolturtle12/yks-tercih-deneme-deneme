"use client";

import { useSyncExternalStore } from "react";

type Tema = "light" | "dark";

const OLAY = "rota-tema-degisti";

/** Tema React state'i değil, DOM + sistem tercihi; dışarıdan okunur. */
function abone(bildir: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", bildir);
  window.addEventListener(OLAY, bildir);
  return () => {
    mq.removeEventListener("change", bildir);
    window.removeEventListener(OLAY, bildir);
  };
}

function anlikTema(): Tema {
  const secili = document.documentElement.dataset.theme;
  if (secili === "dark" || secili === "light") return secili;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function ThemeToggle() {
  // Sunucuda tema bilinemez; null dönüp ilk boyamada nötr etiket gösteriyoruz.
  const tema = useSyncExternalStore<Tema | null>(abone, anlikTema, () => null);

  function degistir() {
    const sonraki: Tema = anlikTema() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = sonraki;
    try {
      localStorage.setItem("rota-tema", sonraki);
    } catch {
      /* özel modda depolama kapalı olabilir; tema yine de bu oturumda değişir */
    }
    window.dispatchEvent(new Event(OLAY));
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={degistir}
      aria-label={tema === "dark" ? "Açık temaya geç" : "Koyu temaya geç"}
      suppressHydrationWarning
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        aria-hidden="true"
        suppressHydrationWarning
      >
        {tema === "dark" ? (
          <>
            <circle cx="12" cy="12" r="4.2" />
            <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
          </>
        ) : (
          <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2Z" />
        )}
      </svg>
      <span suppressHydrationWarning>
        {tema === null ? "Tema" : tema === "dark" ? "Açık tema" : "Koyu tema"}
      </span>
    </button>
  );
}
