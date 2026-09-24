"use client";

export function PrintButton({ disabled }: { disabled?: boolean }) {
  return <button className="rounded-xl bg-apple-400 px-5 py-2 text-sm font-black text-zinc-950 hover:bg-apple-300 disabled:opacity-50" disabled={disabled} onClick={() => window.print()} type="button">Imprimir</button>;
}
