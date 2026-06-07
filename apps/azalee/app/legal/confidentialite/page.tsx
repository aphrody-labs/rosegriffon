import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
	description:
		"Comment Rose Griffon collecte, utilise et protège vos données personnelles, conformément au RGPD.",
	title: "Politique de confidentialité - Azalée",
};

export default function PrivacyPolicyPage() {
	return (
		<div className="w-full">
			<h1 className="type-display-medium font-bold mb-4 text-primary">
				Politique de Confidentialité
			</h1>
			<p className="type-body-small text-on-surface-variant mb-8">
				Dernière mise à jour : 24 novembre 2025
			</p>

			<div className="prose prose-base md:prose-lg dark:prose-invert max-w-none space-y-8 text-on-surface">
				<section className="bg-surface-container p-6 rounded-lg">
					<p className="font-semibold text-lg">
						Rose Griffon s&apos;engage à protéger et respecter votre vie privée.
					</p>
					<p className="mt-2">
						Cette politique explique comment nous collectons, utilisons et protégeons vos données
						personnelles, conformément au Règlement Général sur la Protection des Données (RGPD -
						Règlement UE 2016/679) et à la loi Informatique et Libertés du 6 janvier 1978 modifiée.
					</p>
				</section>

				<section>
					<h2 className="type-headline-small font-semibold mb-4 text-secondary">
						1. Responsable du Traitement
					</h2>
					<p>
						Le responsable du traitement des données est l&apos;association Rose Griffon,
						association loi 1901 à but non lucratif.
					</p>
					<p className="mt-4">
						<strong>Contact :</strong> Pour toute question relative à la protection de vos données
						personnelles, vous pouvez nous contacter via :
					</p>
					<ul className="list-disc pl-6 space-y-2">
						<li>
							Notre{" "}
							<Link href="/contact" className="text-primary hover:underline">
								formulaire de contact
							</Link>
						</li>
						<li>
							Notre serveur Discord officiel :{" "}
							<a
								href="https://discord.gg/8X8eQfBMkt"
								target="_blank"
								rel="noopener noreferrer"
								className="text-primary hover:underline"
							>
								discord.gg/8X8eQfBMkt
							</a>
						</li>
					</ul>
				</section>

				<section>
					<h2 className="type-headline-small font-semibold mb-4 text-secondary">
						8. Cookies et Technologies Similaires
					</h2>
					<p>
						Notre site utilise uniquement des cookies strictement nécessaires au fonctionnement :
					</p>
					<ul className="list-disc pl-6 space-y-2">
						<li>
							<strong>Cookies de session</strong> : Pour maintenir votre authentification (Supabase
							Auth)
						</li>
						<li>
							<strong>Cookies de préférences</strong> : Pour sauvegarder vos choix (thème
							clair/sombre, langue)
						</li>
					</ul>
					<p className="mt-4">
						Nous n&apos;utilisons <strong>pas</strong> de cookies publicitaires ou de tracking
						tiers. Les statistiques d&apos;utilisation sont collectées de manière anonymisée via nos
						outils internes (conforme RGPD).
					</p>
				</section>
			</div>
		</div>
	);
}
