import type React from "react";
import { SPRITE_SHEET_SRC, SPRITES, type SpriteKey } from "@/config/sprites";
import { cn } from "@/lib/utils";
import styles from "./SpriteIcon.module.css";

// Native spritesheet dimensions
const SHEET_W = 516;
const SHEET_H = 568;

interface SpriteIconProps extends React.HTMLAttributes<HTMLDivElement> {
  name: SpriteKey;
  variant?: "default" | "glow" | "shadow";
  scale?: number;
}

export const SpriteIcon = ({
  name,
  variant = "default",
  scale = 1,
  className,
  style,
  ...props
}: SpriteIconProps) => {
  const sprite = SPRITES[name];

  if (!sprite) {
    console.warn(`Sprite "${name}" not found in configuration.`);
    return null;
  }

  const { x, y, w, h } = sprite;
  const displayW = w * scale;
  const displayH = h * scale;

  return (
    <div
      className={cn("relative inline-block override-icon-size", className)}
      style={{
        width: displayW,
        height: displayH,
        ...style,
      }}
      role="img"
      aria-label={name}
      {...props}
    >
      <div
        className={cn(styles.sprite, styles[variant])}
        style={{
          backgroundImage: `url(${SPRITE_SHEET_SRC})`,
          backgroundSize: `${SHEET_W * scale}px ${SHEET_H * scale}px`,
          backgroundPosition: `-${x * scale}px -${y * scale}px`,
          width: `${displayW}px`,
          height: `${displayH}px`,
        }}
      />
    </div>
  );
};
