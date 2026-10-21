"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type Turnstile = { render: (node: HTMLElement, options: { sitekey: string; action: string; theme: string }) => string; remove: (id: string) => void };

export function BotProtection({ action, resetSignal }: { action: string; resetSignal?: unknown }) {
  const container = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  useEffect(() => {
    const turnstile = (window as Window & { turnstile?: Turnstile }).turnstile;
    if (!loaded || !siteKey || !container.current || !turnstile) return;
    const id = turnstile.render(container.current, { sitekey: siteKey, action, theme: "dark" });
    return () => turnstile.remove(id);
  }, [loaded, siteKey, action, resetSignal]);
  return <>
    <div hidden aria-hidden="true"><label>Sitio web<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    {siteKey ? <><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={() => setLoaded(true)} /><div ref={container} /></> : null}
  </>;
}
