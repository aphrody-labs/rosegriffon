// Carte d'un sondage dans la liste — composant serveur, aucun JS envoyé.
//
// On garde `Card` de `@rosegriffon/ui` pour la surface (tokens, bordure, thème)
// mais on structure l'intérieur en balises sémantiques : `CardHeader` bascule en
// `flex-row` au-delà de 28rem de carte (requête de conteneur), ce qui mettrait
// les badges, la question et le chapô côte à côte dès la grille deux colonnes.

import { Badge, Card } from "@rosegriffon/ui";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowRight, CalendarDays, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { ContenuDiscord, TexteDiscordInline } from "@/lib/discord/markdown";
import type { ContexteMentions } from "@/lib/discord/markdown-ast";
import {
	type Sondage,
	libelleChoixAutorises,
	libelleEtat,
	libelleParticipation,
	resumeQuestion,
} from "@/lib/discord/polls-types";

import { ResultatsSondage } from "./ResultatsSondage";

/** Options montrées sur une carte de liste ; le détail les affiche toutes. */
const OPTIONS_VISIBLES = 5;

export function CarteSondage({
	sondage,
	contexte,
}: {
	sondage: Sondage;
	contexte: ContexteMentions;
}) {
	const publieLe = new Date(sondage.created_at);
	const participation = libelleParticipation(sondage);
	const resume = resumeQuestion(sondage.question, 70);

	return (
		<Card className="flex flex-col gap-0 overflow-hidden rounded-[24px] border-outline-variant/10 bg-surface-container-low p-0 py-0 transition-transform duration-300 hover:-translate-y-1">
			<header className="flex flex-col gap-3 p-5 sm:p-6">
				<div className="flex flex-wrap items-center gap-2">
					<Badge variant={sondage.ended ? "secondary" : "success"}>{libelleEtat(sondage)}</Badge>
					{sondage.source === "reactions" && <Badge variant="outline">Décompte reconstitué</Badge>}
					{sondage.provider === "discord" && <Badge variant="outline">Sondage Discord</Badge>}
				</div>
				{/* La question reste dans la langue de l'encart : la quasi-totalité des
				    sondages est en anglais au milieu d'une page française, et `lang` est
				    ce que lisent les lecteurs d'écran comme les moteurs de recherche. */}
				{/* `TexteDiscordInline` et non `ContenuDiscord` : un titre ne peut
				    contenir que du contenu de phrase, pas les `<p>` du rendu de bloc.
				    Les retours à la ligne de la question sont préservés (`<br>`). */}
				<h2
					className="text-fluid-headline-md leading-snug font-semibold break-words text-on-surface"
					lang={sondage.language ?? undefined}
				>
					<TexteDiscordInline contenu={sondage.question} contexte={contexte} />
				</h2>
				{sondage.chapo && (
					<div className="text-fluid-body-md text-on-surface-variant">
						<ContenuDiscord contenu={sondage.chapo} contexte={contexte} />
					</div>
				)}
			</header>

			{sondage.visuel && (
				<figure className="px-5 pb-4 sm:px-6">
					<Image
						src={sondage.visuel.url}
						// `alt` vide = image décorative : quand l'autrice n'a pas décrit sa
						// pièce jointe, on n'invente pas une description à sa place.
						alt={sondage.visuel.alt ?? ""}
						width={sondage.visuel.width ?? 1200}
						height={sondage.visuel.height ?? 900}
						sizes="(max-width: 1024px) 100vw, 50vw"
						quality={75}
						className="h-auto w-full rounded-2xl border border-outline-variant/20 object-cover"
					/>
					{sondage.visuel.alt && (
						<figcaption className="mt-2 text-sm text-on-surface-variant">
							{sondage.visuel.alt}
						</figcaption>
					)}
				</figure>
			)}

			<div className="flex-1 px-5 pb-4 sm:px-6">
				<ResultatsSondage contexte={contexte} limite={OPTIONS_VISIBLES} sondage={sondage} />
			</div>

			<footer className="flex flex-col items-start gap-3 border-t border-outline-variant/20 px-5 py-4 sm:px-6">
				<div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-on-surface-variant">
					{participation && (
						<span className="inline-flex items-center gap-1.5">
							<Users className="size-4 shrink-0" aria-hidden />
							{participation}
						</span>
					)}
					<span>{libelleChoixAutorises(sondage)}</span>
					<span className="inline-flex items-center gap-1.5">
						<CalendarDays className="size-4 shrink-0" aria-hidden />
						<time dateTime={sondage.created_at}>
							{format(publieLe, "d MMMM yyyy", { locale: fr })}
						</time>
					</span>
				</div>
				<Link
					href={`/sondages/${sondage.poll_id}`}
					aria-label={`Voir le détail du sondage : ${resume}`}
					className="inline-flex items-center gap-1.5 rounded-full text-fluid-body-md font-semibold text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
				>
					Voir le détail
					<ArrowRight className="size-4" aria-hidden />
				</Link>
			</footer>
		</Card>
	);
}
