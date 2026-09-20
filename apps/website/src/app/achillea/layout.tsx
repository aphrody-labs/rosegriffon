import type { Metadata } from "next";
import { AchilleaAuthProvider } from "@/lib/achillea";
import { AchilleaNav } from "@/components/achillea/AchilleaNav";
import "./achillea.css";

export const metadata: Metadata = {
	title: {
		default: "Achilléa — E-Sport & Compétition Inazuma Eleven | Rose Griffon",
		template: "%s | Achilléa — Rose Griffon",
	},
	description:
		"La scène compétitive officielle Inazuma Eleven: Victory Road. Clans, classements classés ELO (1v1, 2v2), Astral League, tournois communautaires et bot Discord officiel.",
	alternates: {
		canonical: "https://rosegriffon.fr/achillea",
	},
	openGraph: {
		title: "Achilléa — E-Sport & Compétition Inazuma Eleven",
		description:
			"La scène compétitive officielle Inazuma Eleven: Victory Road. Tournois, clans, ranked et championnats.",
		url: "https://rosegriffon.fr/achillea",
		siteName: "Achilléa Rose Griffon",
		locale: "fr_FR",
		type: "website",
		images: [
			{
				url: "/achillea/achillea-banner.png",
				width: 1200,
				height: 630,
				alt: "Bannière Achilléa",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Achilléa — E-Sport Inazuma Eleven",
		description:
			"La scène compétitive Inazuma Eleven: Victory Road. Tournois, clans, ranked et championnats.",
		images: ["/achillea/achillea-banner.png"],
	},
};

export default function AchilleaLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<AchilleaAuthProvider>
			<div className="achillea-scope min-h-screen bg-background text-foreground flex flex-col">
				<AchilleaNav />
				<main id="main-content" className="flex-1">
					{children}
				</main>
			</div>
		</AchilleaAuthProvider>
	);
}
