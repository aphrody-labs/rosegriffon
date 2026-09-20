"use client";

import Image from "next/image";

import type { NavItem } from "@rosegriffon/app-shell";

import { CommonSpriteIcon } from "@/components/ui/CommonSpriteIcon";
import { GameSpriteIcon } from "@/components/ui/GameSpriteIcon";
import type { GameIconKey } from "@/config/game-icons";
import type { SpriteCommonKey } from "@/config/sprites-common";
import { EMOTES } from "@/lib/emotes";

/**
 * Icône d'une entrée de navigation — les images de CETTE communauté.
 *
 * CE QU'ELLE REMPLACE
 * La barre latérale rendait des pictogrammes `lucide-react` : une « maison »
 * générique pour l'accueil, un « livre » pour le wiki, une « manette » pour
 * l'e-sport. Le même dessin que n'importe quel tableau de bord, sur un site
 * dont tout le contenu est Inazuma Eleven — alors que le dépôt porte déjà les
 * atlas d'icônes natives du jeu, les emotes de Roy et Gaëlle et les logos des
 * trois marques.
 *
 * L'ORDRE DE PRIORITÉ
 * 1. `imageUrl` — un logo de marque (Rose Griffon, Azalée, Achilléa, RGTV) ;
 * 2. `emote` — Roy, Gaëlle, le griffon : l'identité de l'association ;
 * 3. `gameIcon` — une vraie icône de menu d'IEVR, teintée par le thème ;
 * 4. `commonSprite` — un sprite de l'atlas commun du jeu ;
 * 5. `null` — et là seulement, `AppSidebar` retombe sur son pictogramme.
 *
 * Les quatre premières sont des IMAGES DE MARQUE OU DU JEU. Le repli lucide ne
 * sert plus que d'ultime filet, le temps qu'une entrée reçoive son asset.
 */
export function NavIcone(item: NavItem): React.ReactNode {
	if (item.imageUrl) {
		return (
			<span className="relative block size-full">
				<Image src={item.imageUrl} alt="" fill sizes="24px" className="object-contain" />
			</span>
		);
	}

	if (item.emote && item.emote in EMOTES) {
		const emote = EMOTES[item.emote]!;
		return (
			<span className="relative block size-full">
				<Image src={emote.path} alt="" fill sizes="24px" className="object-contain" />
			</span>
		);
	}

	if (item.gameIcon) {
		// `bg-current` : l'icône prend la couleur du texte, donc l'état actif et
		// les quatre thèmes la traitent exactement comme un pictogramme.
		return <GameSpriteIcon name={item.gameIcon as GameIconKey} size={20} />;
	}

	if (item.commonSprite) {
		// `scale` et non `size` : les cellules de l'atlas commun font 48 à 92 px,
		// et 0.25 les ramène toutes dans la boîte de 20 px du menu.
		return <CommonSpriteIcon name={item.commonSprite as SpriteCommonKey} scale={0.25} />;
	}

	return null;
}
