"use client";

import Link from "next/link";
import React from "react";

import { cn } from "@/lib/utils";

export interface SidebarIconButtonProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
	href: string;
	icon: React.ReactNode;
	label: string;
	ariaLabel?: string;
	color?: "rose" | "blue" | "purple" | "green" | "gray";
}

/**
 * Icon-only button component for sidebar social links
 * Compact design with tooltips on hover
 *
 * Usage:
 * <SidebarIconButton
 *   href="https://twitter.com"
 *   icon={<Twitter size={20} />}
 *   label="Twitter"
 *   color="blue"
 * />
 */
export const SidebarIconButton = React.forwardRef<HTMLAnchorElement, SidebarIconButtonProps>(
	({ href, icon, label, ariaLabel, color = "gray", className, ...props }, ref) => {
		const colorClasses = {
			blue: "hover:text-sky-300",
			gray: "hover:text-sidebar-foreground",
			green: "hover:text-emerald-300",
			purple: "hover:text-violet-300",
			rose: "hover:text-rose-300",
		};

		return (
			<Link
				ref={ref}
				href={href}
				target="_blank"
				rel="noopener noreferrer"
				className={cn(
					"size-9 rounded-md sm:h-10 sm:w-10",
					"flex items-center justify-center",
					"text-sidebar-foreground/80",
					"transition-colors duration-150",
					"focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring",
					"hover:bg-sidebar-accent",
					"active:scale-95",
					colorClasses[color],
					className
				)}
				aria-label={ariaLabel || label}
				title={label}
				{...props}
			>
				{icon}
			</Link>
		);
	}
);

SidebarIconButton.displayName = "SidebarIconButton";

export default SidebarIconButton;
