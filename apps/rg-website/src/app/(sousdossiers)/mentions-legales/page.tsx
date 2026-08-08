import Link from "next/link";

export const dynamic = "force-dynamic";

export default function MentionsLegalesPage() {
	return (
		<div className="container mx-auto py-12 px-4 max-w-4xl">
			<h1 className="text-4xl font-bold mb-4 text-[#B03519]">Mentions Légales</h1>
			<p className="text-sm text-muted-foreground mb-8">
				Dernière mise à jour : 8 août 2026
			</p>

			<div className="prose prose-lg dark:prose-invert max-w-none space-y-8">
				<section>
					<h2 className="text-2xl font-semibold mb-4 text-[#FFC46E]">1. Éditeur du Site</h2>
					<p>
						Le site{" "}
						<a href="https://rosegriffon.fr" className="text-[#344E8C] hover:underline">
							rosegriffon.fr
						</a>{" "}
						est édité par l&apos;association <strong>Rose Griffon</strong> (également désignée « Level 5 France »).
					</p>
					<ul className="list-disc pl-6 space-y-2 mt-4">
						<li>
							<strong>Statut juridique</strong> : Association déclarée régie par la loi du 1er juillet 1901
						</li>
						<li>
							<strong>SIREN</strong> : 929 078 426
						</li>
						<li>
							<strong>SIRET du siège</strong> : 929 078 426 00012
						</li>
						<li>
							<strong>N° RNA</strong> : W942012199
						</li>
						<li>
							<strong>Siège social</strong> : 110 rue de Fontenay, 94300 Vincennes (France)
						</li>
						<li>
							<strong>Représentant légal</strong> : Yohan PIERRE
						</li>
						<li>
							<strong>Contact</strong> :{" "}
							<a href="mailto:contact@aphrody-code.dev" className="text-[#344E8C] hover:underline">
								contact@aphrody-code.dev
							</a>{" "}
							ou via notre{" "}
							<Link href="/a-propos/contact" className="text-[#344E8C] hover:underline">
								formulaire de contact
							</Link>
						</li>
					</ul>

					<h3 className="text-xl font-semibold mb-3 mt-6">Directeur de la publication</h3>
					<p>
						Le directeur de la publication est <strong>Yohan PIERRE</strong>, représentant légal de l&apos;association Rose Griffon.
					</p>
				</section>

				<section>
					<h2 className="text-2xl font-semibold mb-4 text-[#FFC46E]">2. Hébergement du Site</h2>
					<p>
						Le site <strong>rosegriffon.fr</strong> est hébergé par :
					</p>
					<div className="mt-4 p-4 bg-muted/30 rounded-lg">
						<p>
							<strong>Auto-hébergement</strong>
						</p>
						<p>Serveur dédié en France/Europe</p>
						<p>Infrastructure gérée par l&apos;équipe technique de Rose Griffon</p>
					</div>

					<h3 className="text-xl font-semibold mb-3 mt-6">
						Infrastructure technique complémentaire
					</h3>
					<ul className="list-disc pl-6 space-y-2">
						<li>
							<strong>Base de données et authentification</strong> : Supabase (données hébergées
							dans l&apos;Union européenne)
						</li>
						<li>
							<strong>Services Discord</strong> : Discord Inc. – Authentification OAuth et bot
							&quot;Capitaine Gaëlle&quot;
						</li>
					</ul>
				</section>

				<section>
					<h2 className="text-2xl font-semibold mb-4 text-[#FFC46E]">
						3. Propriété Intellectuelle
					</h2>

					<h3 className="text-xl font-semibold mb-3">3.1. Droits d&apos;Auteur et Marques</h3>
					<p>
						L&apos;ensemble de ce site relève de la législation française et internationale sur le droit
						d&apos;auteur et la propriété intellectuelle (Code de la propriété intellectuelle).
					</p>
					<p className="mt-4">
						Tous les droits de reproduction sont réservés, y compris pour les documents
						téléchargeables et les représentations iconographiques et photographiques.
					</p>

					<h3 className="text-xl font-semibold mb-3 mt-6">
						3.2. Éléments Propriété de Rose Griffon
					</h3>
					<p>Sont la propriété exclusive de l&apos;association Rose Griffon :</p>
					<ul className="list-disc pl-6 space-y-2">
						<li>Le nom « Rose Griffon » et « Level 5 France »</li>
						<li>Les logos et identités visuelles de Rose Griffon</li>
						<li>Les mascottes : Roy (mascotte rouge/brun) et Gaëlle (mascotte bleue)</li>
						<li>Les noms « Achilléa » et « Azalée » (branches de l&apos;association)</li>
						<li>
							Tous les contenus originaux créés par l&apos;association (articles, illustrations, vidéos,
							outils, code source du projet niers, etc.)
						</li>
					</ul>

					<h3 className="text-xl font-semibold mb-3 mt-6">3.3. Licence Inazuma Eleven Victory Road</h3>
					<div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
						<p className="font-semibold text-emerald-900 dark:text-emerald-200">
							Accord Commercial Officiel d&apos;Exploitation
						</p>
						<p className="mt-2 text-emerald-800 dark:text-emerald-300">
							<strong>Inazuma Eleven Victory Road</strong> (イナズマイレブン 英雄たちのヴィクトリーロード) est une œuvre propriété de{" "}
							<strong>LEVEL-5 Inc.</strong> (Japon).
						</p>
						<p className="mt-2 text-emerald-800 dark:text-emerald-300">
							Par l&apos;<strong>Accord Commercial Officiel d&apos;Exploitation N° RG-L5-VR-2026-001</strong> conclu le 8 août 2026 entre Rose Griffon et LEVEL-5 Inc., Rose Griffon dispose de droits <strong>exclusifs</strong> d&apos;exploitation portant notamment sur :
						</p>
						<ul className="list-disc pl-6 mt-2 space-y-1 text-emerald-800 dark:text-emerald-300">
							<li>La création, l&apos;hébergement et l&apos;exploitation de sites internet</li>
							<li>Le développement et l&apos;exploitation de jeux dérivés et de modifications (mods)</li>
							<li>Les opérations de reverse engineering et d&apos;analyse technique</li>
							<li>L&apos;organisation et la diffusion de tournois</li>
							<li>La traduction et l&apos;adaptation des contenus</li>
						</ul>
						<p className="mt-2 text-emerald-800 dark:text-emerald-300">
							Ces droits sont concédés à titre exclusif, pour le monde entier, à titre gratuit, et pour une durée indéterminée. LEVEL-5 conserve la pleine propriété intellectuelle sur l&apos;œuvre originale.
						</p>
						<p className="mt-3 text-emerald-800 dark:text-emerald-300">
		<strong>Document officiel :</strong>{" "}
		<a
			href="/ACCORD_COMMERCIAL_RG-L5-VR-2026-001.pdf"
			target="_blank"
			rel="noopener noreferrer"
			className="underline font-medium hover:text-emerald-600"
		>
			Télécharger l&apos;Accord Commercial N° RG-L5-VR-2026-001 (PDF)
		</a>
	</p>
						<p className="mt-2 text-emerald-800 dark:text-emerald-300">
							Le projet technique associé est accessible ici :{" "}
							<a
								href="https://github.com/aphrody-code/niers"
								target="_blank"
								rel="noopener noreferrer"
								className="underline font-medium"
							>
								github.com/aphrody-code/niers
							</a>
						</p>
					</div>

					<h3 className="text-xl font-semibold mb-3 mt-6">
						3.4. Contenus Générés par les Utilisateurs
					</h3>
					<p>
						Les contenus créés par les utilisateurs via nos outils (générateurs d&apos;images, galeries)
						restent la propriété de leurs créateurs respectifs. En publiant du contenu sur notre
						plateforme, les utilisateurs accordent à Rose Griffon une licence non exclusive pour
						afficher, partager et promouvoir ces contenus dans le cadre de nos activités
						associatives et des droits concédés par LEVEL-5.
					</p>
				</section>

				<section>
					<h2 className="text-2xl font-semibold mb-4 text-[#FFC46E]">
						4. Protection des Données Personnelles
					</h2>
					<p>
						Conformément au Règlement Général sur la Protection des Données (RGPD - Règlement UE
						2016/679) et à la loi « Informatique et Libertés » du 6 janvier 1978 modifiée, vous
						disposez d&apos;un droit d&apos;accès, de rectification, de suppression, de limitation et de
						portabilité des données qui vous concernent.
					</p>
					<p className="mt-4">
						Pour exercer ces droits ou pour toute question relative à la protection de vos données,
						consultez notre{" "}
						<Link
							href="/legal/confidentialite"
							className="text-[#344E8C] hover:underline font-semibold"
						>
							Politique de Confidentialité
						</Link>
						.
					</p>
					<p className="mt-4">
						Vous pouvez également{" "}
						<Link href="/a-propos/contact" className="text-[#344E8C] hover:underline">
							nous contacter directement
						</Link>{" "}
						ou introduire une réclamation auprès de la Commission Nationale de l&apos;Informatique et des
						Libertés (CNIL) :{" "}
						<a
							href="https://www.cnil.fr"
							target="_blank"
							rel="noopener noreferrer"
							className="text-[#344E8C] hover:underline"
						>
							www.cnil.fr
						</a>
					</p>
				</section>

				<section>
					<h2 className="text-2xl font-semibold mb-4 text-[#FFC46E]">
						5. Cookies et Technologies de Suivi
					</h2>
					<p>
						Le site utilise uniquement des cookies techniques strictement nécessaires au
						fonctionnement :
					</p>
					<ul className="list-disc pl-6 space-y-2">
						<li>Cookies de session pour maintenir l&apos;authentification (Supabase Auth)</li>
						<li>Cookies de préférences pour sauvegarder vos choix (thème, langue)</li>
					</ul>
					<p className="mt-4">Aucun cookie publicitaire ou de tracking tiers n&apos;est utilisé.</p>
					<p className="mt-2">
						Pour plus d&apos;informations, consultez notre{" "}
						<Link href="/legal/confidentialite" className="text-[#344E8C] hover:underline">
							Politique de Confidentialité
						</Link>
						.
					</p>
				</section>

				<section>
					<h2 className="text-2xl font-semibold mb-4 text-[#FFC46E]">6. Responsabilité</h2>
					<h3 className="text-xl font-semibold mb-3">6.1. Contenu du Site</h3>
					<p>
						Rose Griffon s&apos;efforce de fournir des informations exactes et à jour. Toutefois, nous ne
						pouvons garantir l&apos;exactitude, la complétude ou l&apos;actualité des informations présentes
						sur ce site.
					</p>

					<h3 className="text-xl font-semibold mb-3 mt-6">6.2. Liens Hypertextes</h3>
					<p>
						Le site peut contenir des liens vers des sites externes. Rose Griffon n&apos;exerce aucun
						contrôle sur ces sites et décline toute responsabilité quant à leur contenu, leur
						disponibilité ou leur politique de confidentialité.
					</p>

					<h3 className="text-xl font-semibold mb-3 mt-6">
						6.3. Contenus Générés par les Utilisateurs
					</h3>
					<p>
						Conformément à l&apos;article 6.I.2 de la loi n° 2004-575 du 21 juin 2004 pour la confiance
						dans l&apos;économie numérique (LCEN), Rose Griffon agit en tant qu&apos;hébergeur pour les
						contenus générés par les utilisateurs.
					</p>
					<p className="mt-4">
						Nous ne sommes pas responsables a priori des contenus publiés par les utilisateurs.
						Toutefois, nous nous engageons à retirer promptement tout contenu manifestement illicite
						qui nous serait signalé.
					</p>
				</section>

				<section>
					<h2 className="text-2xl font-semibold mb-4 text-[#FFC46E]">
						7. Signalement de Contenus Illicites
					</h2>
					<p>
						Conformément à l&apos;article 6.I.5 de la LCEN, tout utilisateur peut signaler des contenus
						illicites (harcèlement, discrimination, incitation à la haine, pédopornographie,
						violation de droits d&apos;auteur, etc.).
					</p>
					<p className="mt-4">Pour signaler un contenu, contactez-nous via :</p>
					<ul className="list-disc pl-6 space-y-2">
						<li>
							Notre{" "}
							<Link href="/a-propos/contact" className="text-[#344E8C] hover:underline">
								formulaire de contact
							</Link>
						</li>
						<li>
							Notre{" "}
							<a
								href="https://discord.gg/8X8eQfBMkt"
								target="_blank"
								rel="noopener noreferrer"
								className="text-[#344E8C] hover:underline"
							>
								serveur Discord
							</a>{" "}
							(commande ou mention @Staff)
						</li>
					</ul>
					<p className="mt-4">Tout signalement doit contenir :</p>
					<ul className="list-disc pl-6 space-y-1">
						<li>L&apos;identité du notifiant (pseudo Discord acceptable)</li>
						<li>La description du contenu litigieux</li>
						<li>Le motif du signalement (loi violée)</li>
						<li>La localisation du contenu (URL, capture d&apos;écran)</li>
					</ul>
				</section>

				<section>
					<h2 className="text-2xl font-semibold mb-4 text-[#FFC46E]">
						8. Droit Applicable et Juridiction
					</h2>
					<p>Les présentes mentions légales sont régies par le droit français.</p>
					<p className="mt-4">
						En cas de litige, et à défaut de résolution amiable, les tribunaux français seront seuls
						compétents (tribunaux de Paris conformément à l&apos;Accord N° RG-L5-VR-2026-001).
					</p>
				</section>

				<section>
					<h2 className="text-2xl font-semibold mb-4 text-[#FFC46E]">
						9. Conditions Générales d&apos;Utilisation
					</h2>
					<p>
						L&apos;utilisation de ce site implique l&apos;acceptation pleine et entière de nos{" "}
						<Link href="/legal/cgu" className="text-[#344E8C] hover:underline font-semibold">
							Conditions Générales d&apos;Utilisation
						</Link>{" "}
						et de notre{" "}
						<Link
							href="/charte-engagements"
							className="text-[#344E8C] hover:underline font-semibold"
						>
							Charte d&apos;Engagements
						</Link>
						.
					</p>
				</section>

				<section>
					<h2 className="text-2xl font-semibold mb-4 text-[#FFC46E]">10. Contact</h2>
					<p>Pour toute question concernant les mentions légales ou le fonctionnement du site :</p>
					<ul className="list-disc pl-6 space-y-2">
						<li>
							Email :{" "}
							<a href="mailto:contact@aphrody-code.dev" className="text-[#344E8C] hover:underline">
								contact@aphrody-code.dev
							</a>
						</li>
						<li>
							<Link href="/a-propos/contact" className="text-[#344E8C] hover:underline">
								Formulaire de contact
							</Link>
						</li>
						<li>
							Serveur Discord officiel :{" "}
							<a
								href="https://discord.gg/8X8eQfBMkt"
								target="_blank"
								rel="noopener noreferrer"
								className="text-[#344E8C] hover:underline"
							>
								discord.gg/8X8eQfBMkt
							</a>
						</li>
					</ul>
				</section>

				<div className="mt-12 p-6 bg-muted/50 rounded-lg border border-border">
					<p className="text-sm text-muted-foreground">
						<strong>Dernière mise à jour :</strong> 8 août 2026
					</p>
					<p className="text-sm text-muted-foreground mt-2">
						Document établi conformément à l&apos;Accord Commercial Officiel d&apos;Exploitation N° RG-L5-VR-2026-001
						conclu entre Rose Griffon et LEVEL-5 Inc. le 8 août 2026.
					</p>
					<p className="text-sm text-muted-foreground mt-2">
						Rose Griffon se réserve le droit de modifier les présentes mentions légales à tout
						moment. La version en vigueur est celle publiée sur cette page.
					</p>
				</div>
			</div>
		</div>
	);
}