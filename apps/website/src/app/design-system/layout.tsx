import { Fraunces, JetBrains_Mono, Poppins } from "next/font/google";
import localFont from "next/font/local";
import type { ReactNode } from "react";

const fraunces = Fraunces({
	subsets: ["latin"],
	display: "swap",
	variable: "--font-display-ds",
	axes: ["opsz", "SOFT", "WONK"],
});

const jetbrains = JetBrains_Mono({
	subsets: ["latin"],
	display: "swap",
	variable: "--font-mono-ds",
});

const poppins = Poppins({
	weight: ["400", "500", "600", "700"],
	subsets: ["latin"],
	display: "swap",
	variable: "--font-body-ds",
});

const superCartoon = localFont({
	src: "../../../public/fonts/Super Cartoon.woff2",
	display: "swap",
	variable: "--font-cartoon-ds",
});

export const metadata = {
	title: "Design System — Rose Griffon",
	description:
		"Showcase du design system @rosegriffon/ui : 4 thèmes, tokens MD3, composants — DA Rose Griffon (manga / gaming / Inazuma).",
};

export default function DesignSystemLayout({
	children,
}: {
	children: ReactNode;
}) {
	return (
		<div
			className={`${fraunces.variable} ${jetbrains.variable} ${poppins.variable} ${superCartoon.variable} theme-azalee-light min-h-screen bg-surface text-on-surface antialiased`}
		>
			{children}
		</div>
	);
}
