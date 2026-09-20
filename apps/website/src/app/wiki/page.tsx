import { redirect } from "next/navigation";

/**
 * La landing du wiki a fusionné avec la page d'accueil du portail.
 *
 * `rosegriffon.fr/` porte désormais l'unique page d'accueil du réseau :
 * présentation de l'association, vitrine Azalée (compteurs, sections du wiki,
 * dernières actualités) et bloc Achilléa. `/wiki` n'est plus qu'un préfixe de
 * routes (`/wiki/chara`, `/wiki/skill`, …) et redirige vers cette home.
 */
export default function WikiLandingRedirect(): never {
	redirect("/");
}
