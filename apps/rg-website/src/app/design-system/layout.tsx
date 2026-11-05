import localFont from "next/font/local";
import type { ReactNode } from "react";

import { absoluteUrl } from "@/lib/site-url";

const fraunces = localFont({
  display: "swap",
  src: "../../fonts/fraunces-variable.woff2",
  variable: "--font-display-ds",
  weight: "100 900",
});

const jetbrains = localFont({
  display: "swap",
  src: "../../fonts/jetbrains-mono-variable.woff2",
  variable: "--font-mono-ds",
  weight: "100 800",
});

const poppins = localFont({
  display: "swap",
  src: [
    { path: "../../fonts/poppins-400.woff2", style: "normal", weight: "400" },
    { path: "../../fonts/poppins-500.woff2", style: "normal", weight: "500" },
    { path: "../../fonts/poppins-600.woff2", style: "normal", weight: "600" },
    { path: "../../fonts/poppins-700.woff2", style: "normal", weight: "700" },
  ],
  variable: "--font-body-ds",
});

const superCartoon = localFont({
  display: "swap",
  src: "../../../public/fonts/Super Cartoon.woff2",
  variable: "--font-cartoon-ds",
});

export const metadata = {
  alternates: { canonical: absoluteUrl("/design-system") },
  description:
    "Showcase du design system @rosegriffon/ui : 4 thèmes, tokens MD3, composants — DA Rose Griffon (manga / gaming / Inazuma).",
  title: "Design System — Rose Griffon",
};

export default function DesignSystemLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${fraunces.variable} ${jetbrains.variable} ${poppins.variable} ${superCartoon.variable} theme-roy min-h-screen bg-surface text-on-surface antialiased`}
    >
      {children}
    </div>
  );
}
