import type { Metadata } from "next";

export const metadata: Metadata = {
	icons: {
		icon: "/icon.webp",
		shortcut: "/icon.webp",
		apple: "/icon.webp",
	},
};

export default function NewsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <>{children}</>;
}
