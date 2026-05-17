import { Fraunces, JetBrains_Mono } from "next/font/google";
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

export const metadata = {
	title: "Design System — Rose Griffon",
	description:
		"Showcase du design system @rg/ui : 4 thèmes, tokens MD3, composants modernisés.",
};

export default function DesignSystemLayout({
	children,
}: {
	children: ReactNode;
}) {
	return (
		<div
			className={`${fraunces.variable} ${jetbrains.variable} theme-azalee-light min-h-screen bg-surface text-on-surface antialiased`}
		>
			{children}
		</div>
	);
}
