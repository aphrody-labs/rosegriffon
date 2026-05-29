import { CommonSpriteIcon } from "@/components/ui/CommonSpriteIcon";
import type { SpriteCommonKey } from "@/config/sprites-common";
import { iconMap } from "@/lib/icons";
import { cn } from "@/lib/utils";

const SPRITE_FOR_ICON: Record<string, SpriteCommonKey> = {
	air: "wind",
	bolt: "keshin",
	change_circle: "mode_change",
	cyclone: "wind",
	electric_bolt: "keshin",
	flash_on: "keshin",
	forest: "forest",
	group_add: "miximax",
	landscape: "mountain",
	local_fire_department: "fire",
	pets: "soul",
	wb_twilight: "eveil",
};

export interface IconProps {
	name: string;
	fill?: boolean;
	size?: number;
	className?: string;
	preferSprite?: boolean;
}

export const Icon = ({
	name,
	fill = false,
	size = 24,
	className,
	preferSprite = true,
}: IconProps) => {
	if (preferSprite) {
		const spriteKey = SPRITE_FOR_ICON[name];
		if (spriteKey) {
			return <CommonSpriteIcon name={spriteKey} scale={size / 64} className={cn(className)} />;
		}
	}

	const LucideIcon = iconMap[name];
	if (!LucideIcon) {
		return null;
	}
	return (
		<LucideIcon
			size={size}
			className={cn(className)}
			fill={fill ? "currentColor" : "none"}
			aria-hidden="true"
		/>
	);
};
