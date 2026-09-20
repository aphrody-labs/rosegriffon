import type { Metadata } from "next";
import { SupabaseProvider } from "@/components/providers/SupabaseProvider";

export const metadata: Metadata = {
	title: {
		default: "Wiki Azalée - Inazuma Eleven: Victory Road | Rose Griffon",
		template: "%s | Wiki Azalée | Rose Griffon",
	},
	description:
		"Base de données complète Inazuma Eleven: Victory Road. Personnages, techniques, objets, quêtes et encyclopédie.",
	icons: {
		icon: "/icon.webp",
		shortcut: "/icon.webp",
		apple: "/icon.webp",
	},
};

export default function WikiLayout({ children }: { children: React.ReactNode }) {
	return (
		<SupabaseProvider>
			<div className="wiki-scope min-h-full">{children}</div>
		</SupabaseProvider>
	);
}
