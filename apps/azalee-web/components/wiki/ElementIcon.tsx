"use client";

import Image from "next/image";
import { getSkillIconUrl } from "@/lib/images";
import { cn } from "@/lib/utils";

interface ElementIconProps {
  element: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: 16,
  md: 24,
  lg: 32,
};

export function ElementIcon({ element, size = "md", className }: ElementIconProps) {
  const px = SIZES[size];
  const iconUrl = getSkillIconUrl(element);

  if (!iconUrl) return null;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: px, height: px }}
    >
      <Image src={iconUrl} alt={element} width={px} height={px} className="object-contain" />
    </div>
  );
}
