import { Button, Card, CardContent, DiscordIcon } from "@rosegriffon/ui";
import { Zap } from "lucide-react";
import localFont from "next/font/local";
import Image from "next/image";


// Load local font
const humane = localFont({
	display: "swap",
	src: "../../../public/achillea/Humane-Regular.otf",
	variable: "--font-humane",
});

export interface AchilleaBannerProps {
	description?: string;
	image?: string;
	link?: string;
	discordLink?: string;
}

export function AchilleaBanner({
	description = "Le carrefour de l'esport Inazuma Eleven ! Gestion de clans, tournois, matchs classés, ranking communautaire et bot officiel.",
	image = "https://achillea.rosegriffon.fr/opengraph-image",
	link = "https://achillea.rosegriffon.fr/",
	discordLink = "https://discord.gg/achillea-competitif-inazuma-eleven-fr-1055585286320554055",
}: AchilleaBannerProps) {
	return (
		<div className={`w-full ${humane.variable}`}>
			<Card className="overflow-hidden border-transparent shadow-[0_0_30px_-10px_rgba(223,255,87,0.3)] bg-[#D9D9D9] relative group rounded-3xl p-0">
				{/* Background effects similar to Azalee but with Achillea colors */}
				<div
					className="absolute inset-0 opacity-10 mix-blend-overlay pointer-events-none"
					style={{ backgroundImage: "url(/images/noise.svg)" }}
				/>
				<div className="absolute -right-20 -top-20 size-96 bg-[#6d00ce] rounded-full blur-[128px] opacity-20 pointer-events-none" />
				<div className="absolute -left-20 -bottom-20 size-96 bg-[#DFFF57] rounded-full blur-[128px] opacity-10 pointer-events-none" />

				<div className="grid md:grid-cols-2 gap-0 relative z-20 md:min-h-[320px] lg:min-h-[360px]">
					{/* Left: Image Banner — aspect natif (1.91:1) sur mobile, remplissage sur desktop. */}
					<div className="relative aspect-[1200/630] md:aspect-auto md:h-auto w-full overflow-hidden">
						<Image
							src={image}
							alt="Bannière Achillea"
							fill
							unoptimized
							className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
							sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 640px"
						/>
					</div>

					{/* Right: Text Content */}
					<CardContent className="px-6 pb-6 pt-0 sm:px-10 sm:pb-10 sm:pt-0 md:p-12 md:pt-0 flex flex-col justify-center space-y-6 bg-transparent relative text-black">
						<div className="space-y-5">
							<div className="flex items-center justify-between w-full">
								<div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#6d00ce]/10 border border-[#6d00ce]/30 text-[#6d00ce] text-xs font-bold uppercase tracking-wide shadow-sm">
									<Zap className="size-3 fill-[#6d00ce]" />
									E-Sport
								</div>
								{/* Logo SVG */}
								<div className="relative size-14 shrink-0">
									<Image
										src="/achillea/logo1.svg"
										alt="Logo Achillea"
										fill
										className="object-contain drop-shadow-[0_0_8px_rgba(223,255,87,0.6)]"
									/>
								</div>
							</div>

							<div className="space-y-1">
								<div className="relative h-20 md:h-28 w-full max-w-md">
									<Image
										src="/achillea/achillea site titre transparent-2.webp"
										alt="ACHILLEA"
										fill
										className="object-contain object-left drop-shadow-[0_2px_10px_rgba(223,255,87,0.3)]"
									/>
								</div>
								<div className="h-1 w-24 bg-linear-to-r from-[#6d00ce] to-transparent rounded-full opacity-80" />
							</div>
						</div>

						<p className="text-gray-700 text-lg leading-relaxed max-w-md font-medium border-l-2 border-[#6d00ce]/30 pl-4">
							{description}
						</p>

						<div className="flex flex-wrap gap-4 pt-2">
							<Button
								asChild
								size="lg"
								className="bg-[#6d00ce] hover:bg-[#7e14e6] text-[#DFFF57] font-black rounded-xl shadow-[0_0_20px_-5px_rgba(223,255,87,0.6)] hover:shadow-[0_0_25px_-5px_rgba(223,255,87,0.8)] transition-all duration-300 border border-[#DFFF57] px-8"
							>
								<a href={link} target="_blank" rel="noopener noreferrer">
									Site web
								</a>
							</Button>
							<Button
								asChild
								variant="outline"
								size="lg"
								className="bg-white/40 text-black border-black/10 font-bold rounded-xl hover:bg-black/5 hover:border-[#6d00ce]/50 hover:text-[#6d00ce] transition-all duration-300 backdrop-blur-md"
							>
								<a href={discordLink} target="_blank" rel="noopener noreferrer">
									Discord
									<DiscordIcon className="ml-2 size-5" />
								</a>
							</Button>
						</div>
					</CardContent>
				</div>
			</Card>
		</div>
	);
}
