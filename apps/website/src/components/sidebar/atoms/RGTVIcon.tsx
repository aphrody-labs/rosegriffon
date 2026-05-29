import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Icône personnalisée Rose Griffon TV
 * Utilise l'image officielle RGTV depuis /public
 * Simplifié pour utiliser width/height pour une taille fixe.
 */
export const RGTVIcon = ({ className }: { className?: string }) => (
	<Image
		src="/rgtv/rgtv.webp"
		alt="Rose Griffon TV"
		width={24} // Corresponds à la classe w-6
		height={24} // Corresponds à la classe h-6
		className={cn("rounded-sm", className)}
	/>
);
