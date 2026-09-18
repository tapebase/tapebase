"use client";

import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (container: HTMLElement, options: {
    sitekey: string;
    theme: "auto";
    callback: (token: string) => void;
    "expired-callback": () => void;
    "error-callback": () => void;
  }) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
};

declare global {
  interface Window { turnstile?: TurnstileApi }
}

let turnstileScript: Promise<void> | null = null;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  if (turnstileScript) return turnstileScript;
  turnstileScript = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-tapebase-turnstile="true"]');
    const script = existing ?? document.createElement("script");
    const loaded = () => resolve();
    const failed = () => reject(new Error("Nie udało się załadować zabezpieczenia CAPTCHA."));
    script.addEventListener("load", loaded, { once: true });
    script.addEventListener("error", failed, { once: true });
    if (!existing) {
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.tapebaseTurnstile = "true";
      document.head.appendChild(script);
    }
  });
  return turnstileScript;
}

export function TurnstileField({ resetKey }: { resetKey: string }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [token, setToken] = useState("");
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!siteKey || !container.current) return;
    let active = true;
    loadTurnstile().then(() => {
      if (!active || !container.current || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(container.current, {
        sitekey: siteKey,
        theme: "auto",
        callback: value => setToken(value),
        "expired-callback": () => setToken(""),
        "error-callback": () => setToken(""),
      });
    }).catch(() => active && setLoadError(true));
    return () => {
      active = false;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey]);

  useEffect(() => {
    if (!widgetId.current || !window.turnstile) return;
    window.turnstile.reset(widgetId.current);
    setToken("");
  }, [resetKey]);

  if (!siteKey) return null;
  return <div className="space-y-2">
    <div ref={container} />
    <input type="hidden" name="captchaToken" value={token} />
    {loadError && <p className="text-sm text-red-700">Nie udało się załadować zabezpieczenia. Odśwież stronę i spróbuj ponownie.</p>}
  </div>;
}
