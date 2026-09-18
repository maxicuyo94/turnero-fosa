import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

// Only the internal area is installable as a PWA; the public booking site keeps no manifest.
export const metadata: Metadata = {
  manifest: "/internal.webmanifest",
  applicationName: "Taller Express",
  appleWebApp: {
    capable: true,
    title: "Taller Express",
    statusBarStyle: "black",
  },
  icons: {
    icon: [
      { url: "/icons/internal-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/internal-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#101611",
};

export default function InternalLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
