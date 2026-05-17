import { CommonSpriteIcon } from "@/components/ui/CommonSpriteIcon";
import type { SpriteCommonKey } from "@/config/sprites-common";
import { iconMap } from "@/lib/icons";
import { cn } from "@/lib/utils";

const SPRITE_FOR_ICON: Record<string, SpriteCommonKey> = {
  flash_on: "keshin",
  bolt: "keshin",
  electric_bolt: "keshin",
  pets: "soul",
  wb_twilight: "eveil",
  change_circle: "mode_change",
  group_add: "miximax",
  local_fire_department: "fire",
  forest: "forest",
  air: "wind",
  cyclone: "wind",
  landscape: "mountain",
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
  if (!LucideIcon) return null;
  return (
    <LucideIcon
      size={size}
      className={cn(className)}
      fill={fill ? "currentColor" : "none"}
      aria-hidden="true"
    />
  );
};
