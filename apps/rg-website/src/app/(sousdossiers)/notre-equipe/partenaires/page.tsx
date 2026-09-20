import { redirect } from "next/navigation";

/**
 * Fusionnée dans `/notre-equipe`.
 *
 * Cette page ne portait qu'une section de la présentation de l'équipe. Les
 * trois sections sont désormais réunies sur une seule page ; cette URL est
 * indexée et partagée, elle redirige donc plutôt que de disparaître.
 */
export default function RedirectionEquipe(): never {
	redirect("/notre-equipe");
}
