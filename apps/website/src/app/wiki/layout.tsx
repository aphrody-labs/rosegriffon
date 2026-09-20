import type { Metadata } from "next";
import { LanguageProvider } from "@/components/providers/language-provider";
import { SupabaseProvider } from "@/components/providers/SupabaseProvider";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
	title: {
		default: "Wiki Azalée - Inazuma Eleven: Victory Road | Rose Griffon",
		template: "%s | Wiki Azalée | Rose Griffon",
	},
	description:
		"Base de données complète Inazuma Eleven: Victory Road. Personnages, techniques, objets, quêtes et encyclopédie.",
};

export default function WikiLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<LanguageProvider>
			<SupabaseProvider>
				<div className="wiki-scope">
					<Shell>{children}</Shell>
				</div>
			</SupabaseProvider>
		</LanguageProvider>
	);
}
