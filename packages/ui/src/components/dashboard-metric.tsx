import * as React from "react";
import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";

interface DashboardMetricProps {
	label: string;
	value: string | number;
	icon: LucideIcon | React.ReactNode;
	href?: string;
	description?: string;
	trend?: {
		value: number;
		label?: string;
	};
	accentColor?: string;
	className?: string;
}

/**
 * Enhanced Metric card supporting both Lucide and custom Icon nodes (Material).
 * Designed to work with both Website and Azalee MD3 styling.
 */
export function DashboardMetric({
	label,
	value,
	icon,
	href,
	description,
	trend,
	accentColor,
	className,
}: DashboardMetricProps) {
	const iconBg = accentColor || "bg-primary/10 text-primary";

	const content = (
		<div
			className={cn(
				"flex items-center gap-4 p-4 sm:p-5 rounded-[24px] bg-card border border-border transition-all duration-300 hover:shadow-md hover:bg-accent/5 group",
				className
			)}
		>
			<div
				className={cn(
					"size-12 sm:size-14 rounded-[16px] flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 duration-300",
					iconBg
				)}
			>
				{typeof icon === "function" ? (
					// @ts-ignore - Lucide icon component
					React.createElement(icon, { className: "size-6", fill: "currentColor" })
				) : (
					icon
				)}
			</div>
			<div className="min-w-0 flex-1">
				<p className="text-sm text-muted-foreground">{label}</p>
				<div className="flex items-baseline gap-2">
					<p className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
						{typeof value === "number" ? value.toLocaleString("fr-FR") : value}
					</p>
					{trend && (
						<span
							className={cn(
								"inline-flex items-center gap-0.5 text-xs font-medium",
								trend.value > 0 ? "text-emerald-600" : "text-rose-600"
							)}
						>
							{trend.value > 0 ? "+" : ""}
							{trend.value}%
						</span>
					)}
				</div>
				{description && <p className="text-xs text-muted-foreground/70 mt-0.5">{description}</p>}
			</div>
			{href && (
				<ArrowRight className="size-5 text-muted-foreground/50 group-hover:text-foreground transition-colors shrink-0" />
			)}
		</div>
	);

	if (href) {
		return <Link href={href}>{content}</Link>;
	}

	return content;
}
