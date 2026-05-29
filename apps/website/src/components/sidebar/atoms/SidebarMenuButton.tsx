"use client";

import type React from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export interface SidebarMenuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	isActive?: boolean;
	icon?: React.ReactNode;
	children?: React.ReactNode;
}

/**
 * Atomic component for sidebar menu buttons.
 * Uses sidebar-* tokens so it stays readable on the themed sidebar background.
 */
export const SidebarMenuButton = forwardRef<HTMLButtonElement, SidebarMenuButtonProps>(
	({ isActive = false, icon, children, className, ...props }, ref) => (
		<button
			ref={ref}
			className={cn(
				"group flex min-h-9 w-full items-center gap-2.5 rounded-md px-2.5 py-1.5",
				"text-sm font-medium",
				"transition-colors duration-150",
				"text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-foreground",
				"focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
				"disabled:cursor-not-allowed disabled:opacity-50",
				isActive && "bg-sidebar-accent text-sidebar-foreground font-semibold shadow-sm",
				className
			)}
			aria-current={isActive ? "page" : undefined}
			{...props}
		>
			{icon && <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>}
			<span className="flex-1 truncate text-left">{children}</span>
		</button>
	)
);

SidebarMenuButton.displayName = "SidebarMenuButton";
