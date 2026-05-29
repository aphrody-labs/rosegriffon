import Link from "next/link";

export const dynamic = "force-dynamic";

export default function MentionsLegalesPage() {
	return (
		<div className="container mx-auto py-12 px-4 max-w-4xl">
			<h1 className="text-4xl font-bold mb-4 text-[#B03519]">Mentions Légales</h1>
			<p className="text-sm text-muted-foreground mb-8">Dernière mise à jour : 24 novembre 2025</p>

			<div className="prose prose-lg dark:prose-invert max-w-none space-y-8">
				<section>
					<h2 className="text-2xl font-semibold mb-4 text-[#FFC46E]">1. Éditeur du Site</h2>
					<p>
						Le site{" "}
						<a href="https://rosegriffon.fr" className="text-[#344E8C] hover:underline">
							rosegriffon.fr
						</a>{" "}
						est édité par l'association <strong>Rose Griffon</strong>.
					</p>
					<ul className="list-disc pl-6 space-y-2 mt-4">
						<li>
							<strong>Statut juridique</strong> : Association à but non lucratif régie par la loi du
							1er juillet 1901 et le décret du 16 août 1901
						</li>
						<li>
							<strong>Siège social</strong> : France (adresse disponible sur demande via notre{" "}
							<Link href="/a-propos/contact" className="text-[#344E8C] hover:underline">
								formulaire de contact
							</Link>
							)
						</li>
						<li>
							<strong>Contact</strong> : Via notre{" "}
							<Link href="/a-propos/contact" className="text-[#344E8C] hover:underline">
								formulaire de contact
							</Link>{" "}
							ou notre{" "}
							<a
								href="https://discord.gg/8X8eQfBMkt"
								target="_blank"
								rel="noopener noreferrer"
								className="text-[#344E8C] hover:underline"
							>
								serveur Discord officiel
							</a>
						</li>
					</ul>

					<h3 className="text-xl font-semibold mb-3 mt-6">Directeur de la publication</h3>
					<p>
						Le directeur de la publication est le représentant légal de l'association Rose Griffon.
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
						<p>Infrastructure gérée par l'équipe technique de Rose Griffon</p>
					</div>

					<h3 className="text-xl font-semibold mb-3 mt-6">
						Infrastructure technique complémentaire
					</h3>
					<ul className="list-disc pl-6 space-y-2">
						<li>
							<strong>Base de données et authentification</strong> : Supabase (données hébergées
							dans l'Union européenne)
						</li>
						<li>
							<strong>Services Discord</strong> : Discord Inc. - Authentification OAuth et bot
							"Capitaine Gaëlle"
						</li>
					</ul>
				</section>

				<section>
					<h2 className="text-2xl font-semibold mb-4 text-[#FFC46E]">
						3. Propriété Intellectuelle
					</h2>
					<h3 className="text-xl font-semibold mb-3">3.1. Droits d'Auteur et Marques</h3>
					<p>
						L'ensemble de ce site relève de la législation française et internationale sur le droit
						d'auteur et la propriété intellectuelle (Code de la propriété intellectuelle).
					</p>
					<p className="mt-4">
						Tous les droits de reproduction sont réservés, y compris pour les documents
						téléchargeables et les représentations iconographiques et photographiques.
					</p>

					<h3 className="text-xl font-semibold mb-3 mt-6">
						3.2. Éléments Propriété de Rose Griffon
					</h3>
					<p>Sont la propriété exclusive de l'association Rose Griffon :</p>
					<ul className="list-disc pl-6 space-y-2">
						<li>Le nom "Rose Griffon"</li>
						<li>Les logos et identités visuelles de Rose Griffon</li>
						<li>Les mascottes : Roy (mascotte rouge/brun) et Gaëlle (mascotte bleue)</li>
						<li>Les noms "Achilléa" et "Azalée" (branches de l'association)</li>
						<li>
							Tous les contenus originaux créés par l'association (articles, illustrations, vidéos,
							etc.)
						</li>
					</ul>

					<h3 className="text-xl font-semibold mb-3 mt-6">3.3. Licence Inazuma Eleven</h3>
					<div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
						<p className="font-semibold text-amber-900 dark:text-amber-200">Disclaimer Important</p>
						<p className="mt-2 text-amber-800 dark:text-amber-300">
							<strong>Inazuma Eleven</strong> est une marque déposée et une propriété de{" "}
							<strong>LEVEL-5 Inc.</strong> (Japon).
						</p>
						<p className="mt-2 text-amber-800 dark:text-amber-300">
							Rose Griffon est une association de fans indépendante et{" "}
							<strong>n'est pas officiellement affiliée</strong> à LEVEL-5 Inc. Nous ne prétendons à
							aucun droit sur la propriété intellectuelle de LEVEL-5.
						</p>
						<p className="mt-2 text-amber-800 dark:text-amber-300">
							L'utilisation de références à Inazuma Eleven sur ce site est effectuée dans un cadre
							de <em>fair use</em> / usage équitable, sans but lucratif, dans un objectif de
							promotion de la communauté de fans.
						</p>
					</div>

					<h3 className="text-xl font-semibold mb-3 mt-6">
						3.4. Contenus Générés par les Utilisateurs
					</h3>
					<p>
						Les contenus créés par les utilisateurs via nos outils (générateurs d'images, galeries)
						restent la propriété de leurs créateurs respectifs. En publiant du contenu sur notre
						plateforme, les utilisateurs accordent à Rose Griffon une licence non exclusive pour
						afficher, partager et promouvoir ces contenus dans le cadre de nos activités
						associatives.
					</p>
				</section>

				<section>
					<h2 className="text-2xl font-semibold mb-4 text-[#FFC46E]">
						4. Protection des Données Personnelles
					</h2>
					<p>
						Conformément au Règlement Général sur la Protection des Données (RGPD - Règlement UE
						2016/679) et à la loi « Informatique et Libertés » du 6 janvier 1978 modifiée, vous
						disposez d'un droit d'accès, de rectification, de suppression, de limitation et de
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
						ou introduire une réclamation auprès de la Commission Nationale de l'Informatique et des
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
						<li>Cookies de session pour maintenir l'authentification (Supabase Auth)</li>
						<li>Cookies de préférences pour sauvegarder vos choix (thème, langue)</li>
					</ul>
					<p className="mt-4">Aucun cookie publicitaire ou de tracking tiers n'est utilisé.</p>
					<p className="mt-2">
						Pour plus d'informations, consultez notre{" "}
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
						Rose Griffon s'efforce de fournir des informations exactes et à jour. Toutefois, nous ne
						pouvons garantir l'exactitude, la complétude ou l'actualité des informations présentes
						sur ce site.
					</p>
					<p className="mt-4">
						En tant qu'association à but non lucratif gérée par des bénévoles, nous déclinons toute
						responsabilité en cas d'erreur ou d'omission dans les contenus publiés.
					</p>

					<h3 className="text-xl font-semibold mb-3 mt-6">6.2. Liens Hypertextes</h3>
					<p>
						Le site peut contenir des liens vers des sites externes. Rose Griffon n'exerce aucun
						contrôle sur ces sites et décline toute responsabilité quant à leur contenu, leur
						disponibilité ou leur politique de confidentialité.
					</p>

					<h3 className="text-xl font-semibold mb-3 mt-6">
						6.3. Contenus Générés par les Utilisateurs
					</h3>
					<p>
						Conformément à l'article 6.I.2 de la loi n° 2004-575 du 21 juin 2004 pour la confiance
						dans l'économie numérique (LCEN), Rose Griffon agit en tant qu'hébergeur pour les
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
						Conformément à l'article 6.I.5 de la LCEN, tout utilisateur peut signaler des contenus
						illicites (harcèlement, discrimination, incitation à la haine, pédopornographie,
						violation de droits d'auteur, etc.).
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
						<li>L'identité du notifiant (pseudo Discord acceptable)</li>
						<li>La description du contenu litigieux</li>
						<li>Le motif du signalement (loi violée)</li>
						<li>La localisation du contenu (URL, capture d'écran)</li>
					</ul>
				</section>

				<section>
					<h2 className="text-2xl font-semibold mb-4 text-[#FFC46E]">
						8. Droit Applicable et Juridiction
					</h2>
					<p>Les présentes mentions légales sont régies par le droit français.</p>
					<p className="mt-4">
						En cas de litige, et à défaut de résolution amiable, les tribunaux français seront seuls
						compétents.
					</p>
				</section>

				<section>
					<h2 className="text-2xl font-semibold mb-4 text-[#FFC46E]">
						9. Conditions Générales d'Utilisation
					</h2>
					<p>
						L'utilisation de ce site implique l'acceptation pleine et entière de nos{" "}
						<Link href="/legal/cgu" className="text-[#344E8C] hover:underline font-semibold">
							Conditions Générales d'Utilisation
						</Link>{" "}
						et de notre{" "}
						<Link
							href="/charte-engagements"
							className="text-[#344E8C] hover:underline font-semibold"
						>
							Charte d'Engagements
						</Link>
						.
					</p>
				</section>

				<section>
					<h2 className="text-2xl font-semibold mb-4 text-[#FFC46E]">10. Contact</h2>
					<p>Pour toute question concerning les mentions légales ou le fonctionnement du site :</p>
					<ul className="list-disc pl-6 space-y-2">
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
						<strong>Dernière mise à jour :</strong> 24 novembre 2025
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
