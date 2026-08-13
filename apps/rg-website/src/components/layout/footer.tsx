import { DiscordIcon } from "@rosegriffon/ui";
import Link from "next/link";

import TwitterIcon from "@/shared/icons/twitter";

export default function Footer() {
	return (
		<footer className="bg-background border-t border-border/40 w-full footer-safe">
			<div className="container mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8">
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 text-center sm:text-left">
					<div className="flex flex-col items-center sm:items-start gap-2">
						<h3 className="text-sm font-semibold text-foreground mb-1">L'association</h3>
						<Link
							href="/charte-engagements"
							className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
						>
							Charte et engagements
						</Link>
						<Link
							href="https://www.journal-officiel.gouv.fr/pages/associations-detail-annonce/?q.id=id:202400200922"
							target="_blank"
							rel="noopener noreferrer"
							className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
						>
							Numéro RNA
						</Link>
						<Link
							href="https://azalee.rosegriffon.fr"
							rel="noopener"
							className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
						>
							Wiki Azalée — Inazuma Eleven: Victory Road
						</Link>
						<Link
							href="https://achillea.rosegriffon.fr"
							rel="noopener"
							className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
						>
							Achilléa — Compétitif Inazuma Eleven
						</Link>
					</div>

					<div className="flex flex-col items-center sm:items-start gap-2">
						<h3 className="text-sm font-semibold text-foreground mb-1">Contact</h3>
						<Link
							href="/a-propos/contact"
							className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
						>
							Nous contacter
						</Link>
						<Link
							href="/a-propos/soutenir"
							className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
						>
							Nous Soutenir
						</Link>
					</div>

					<div className="flex flex-col items-center sm:items-start gap-2">
						<h3 className="text-sm font-semibold text-foreground mb-1">Informations légales</h3>
						<Link
							href="/legal/cgu"
							className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
						>
							Conditions d'utilisation
						</Link>
						<Link
							href="/legal/confidentialite"
							className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
						>
							Politique de confidentialité
						</Link>
					</div>

					<div className="flex flex-col items-center sm:items-start gap-3">
						<h3 className="text-sm font-semibold text-foreground">Suivez-nous</h3>
						<div className="flex flex-wrap gap-3 justify-center sm:justify-start">
							<Link
								href="https://x.com/rose_griffon"
								target="_blank"
								rel="noopener noreferrer"
								className="group relative p-3 rounded-full bg-muted hover:bg-black transition-all duration-300 hover:scale-110 hover:shadow-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
								aria-label="X (Twitter) Rose Griffon"
							>
								<TwitterIcon
									width={24}
									height={24}
									className="text-muted-foreground group-hover:text-white transition-colors duration-300"
								/>
							</Link>
							<Link
								href="https://discord.gg/rosegriffon"
								target="_blank"
								rel="noopener noreferrer"
								className="group relative p-3 rounded-full bg-muted hover:bg-discord transition-all duration-300 hover:scale-110 hover:shadow-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
								aria-label="Discord Rose Griffon"
							>
								<DiscordIcon
									title="Discord"
									className="size-6 text-muted-foreground group-hover:text-rg-sur-marine transition-colors duration-300"
								/>
							</Link>
							<Link
								href="https://twitch.tv/rose_griffontv"
								target="_blank"
								rel="noopener noreferrer"
								className="group relative p-3 rounded-full bg-muted hover:bg-[#9146FF] transition-all duration-300 hover:scale-110 hover:shadow-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
								aria-label="Twitch RoseGriffonTV"
							>
								<svg
									width={24}
									height={24}
									fill="currentColor"
									viewBox="0 0 24 24"
									className="text-muted-foreground group-hover:text-white transition-colors duration-300"
								>
									<path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
								</svg>
							</Link>
							<Link
								href="https://www.youtube.com/@RoseGriffon"
								target="_blank"
								rel="noopener noreferrer"
								className="group relative p-3 rounded-full bg-muted hover:bg-[#FF0000] transition-all duration-300 hover:scale-110 hover:shadow-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
								aria-label="YouTube Rose Griffon"
							>
								<svg
									width={24}
									height={24}
									fill="currentColor"
									viewBox="0 0 24 24"
									className="text-muted-foreground group-hover:text-white transition-colors duration-300"
								>
									<path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
								</svg>
							</Link>
							<Link
								href="https://www.instagram.com/rose_griffonfr"
								target="_blank"
								rel="noopener noreferrer"
								className="group relative p-3 rounded-full bg-muted hover:bg-linear-to-tr hover:from-[#FD5949] hover:via-[#D6249F] hover:to-[#285AEB] transition-all duration-300 hover:scale-110 hover:shadow-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
								aria-label="Instagram Rose Griffon France"
							>
								<svg
									width={24}
									height={24}
									fill="currentColor"
									viewBox="0 0 24 24"
									className="text-muted-foreground group-hover:text-white transition-colors duration-300"
								>
									<path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
								</svg>
							</Link>
								<Link
								href="https://www.tiktok.com/@rose_griffon"
								target="_blank"
								rel="noopener noreferrer"
								className="group relative p-3 rounded-full bg-muted hover:bg-linear-to-tr hover:from-[#FD5949] hover:via-[#D6249F] hover:to-[#285AEB] transition-all duration-300 hover:scale-110 hover:shadow-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
								aria-label="Tiktok Rose Griffon France"
							>
								<svg fill="#000000" width="800px" height="800px" viewBox="0 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg">
<title>tiktok</title>
<path d="M16.656 1.029c1.637-0.025 3.262-0.012 4.886-0.025 0.054 2.031 0.878 3.859 2.189 5.213l-0.002-0.002c1.411 1.271 3.247 2.095 5.271 2.235l0.028 0.002v5.036c-1.912-0.048-3.71-0.489-5.331-1.247l0.082 0.034c-0.784-0.377-1.447-0.764-2.077-1.196l0.052 0.034c-0.012 3.649 0.012 7.298-0.025 10.934-0.103 1.853-0.719 3.543-1.707 4.954l0.020-0.031c-1.652 2.366-4.328 3.919-7.371 4.011l-0.014 0c-0.123 0.006-0.268 0.009-0.414 0.009-1.73 0-3.347-0.482-4.725-1.319l0.040 0.023c-2.508-1.509-4.238-4.091-4.558-7.094l-0.004-0.041c-0.025-0.625-0.037-1.25-0.012-1.862 0.49-4.779 4.494-8.476 9.361-8.476 0.547 0 1.083 0.047 1.604 0.136l-0.056-0.008c0.025 1.849-0.050 3.699-0.050 5.548-0.423-0.153-0.911-0.242-1.42-0.242-1.868 0-3.457 1.194-4.045 2.861l-0.009 0.030c-0.133 0.427-0.21 0.918-0.21 1.426 0 0.206 0.013 0.41 0.037 0.61l-0.002-0.024c0.332 2.046 2.086 3.59 4.201 3.59 0.061 0 0.121-0.001 0.181-0.004l-0.009 0c1.463-0.044 2.733-0.831 3.451-1.994l0.010-0.018c0.267-0.372 0.45-0.822 0.511-1.311l0.001-0.014c0.125-2.237 0.075-4.461 0.087-6.698 0.012-5.036-0.012-10.060 0.025-15.083z"></path>
</svg>
							</Link>
						</div>
					</div>
				</div>

				<div className="mt-8 pt-6 border-t border-border/40 text-center space-y-1">
					<p className="text-xs sm:text-sm text-muted-foreground">
						Rose Griffon © 2025 - Tous Droits Réservés
					</p>
					<p className="text-xs text-muted-foreground">
						Conçu et développé par{" "}
						<Link
							href="https://x.com/yoyo__goat"
							target="_blank"
							rel="author me noopener noreferrer"
							className="font-medium hover:text-foreground hover:underline transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
						>
							yoyo
						</Link>
					</p>
				</div>
			</div>
		</footer>
	);
}
