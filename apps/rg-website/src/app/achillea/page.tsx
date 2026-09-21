import { metadonneesAchillea } from "@/app/achillea/metadonnees";
import { AchilleaLiveHub } from "@/components/home/AchilleaLiveHub";
import {
	lireChiffresEsport,
	lireClassement,
	lireClansActifs,
	lireTournoisActifs,
} from "@/lib/achillea/classement";

export const revalidate = 60;

export const metadata = metadonneesAchillea({
	chemin: "/achillea",
	description:
		"Achilléa, le portail compétitif officiel Inazuma Eleven: Victory Road. Tournois, clans et classement ELO.",
	titre: "Accueil E-Sport & Tournois",
});

export default async function AchilleaHomePage() {
	const [classement, chiffresEsport, clans, tournaments] = await Promise.all([
		lireClassement(2, 5),
		lireChiffresEsport(),
		lireClansActifs(4),
		lireTournoisActifs(4),
	]);

	return (
		<div className="py-4 min-[600px]:py-6">
			<AchilleaLiveHub
				showHeader={false}
				classement={classement}
				chiffresEsport={chiffresEsport}
				previewData={{
					clans,
					leaderboard: classement,
					stats: chiffresEsport,
					tournaments,
				}}
			/>
		</div>
	);
}
