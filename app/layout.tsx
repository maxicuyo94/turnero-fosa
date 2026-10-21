import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { connection } from "next/server";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Taller Express Turnos",
  description: "Turnos online y gestion interna para Taller de motos Express.",
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  await connection(); // A fresh CSP nonce is applied to every rendered response.
  return (
    <html lang="es-AR" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
