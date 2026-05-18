import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";

interface DashboardStatsCardProps {
	title?: string;
	label?: string; // Alias for Azalee
	value: string | number;
	icon: LucideIcon | string;
	description?: string;
	href?: string;
	trend?: {
		value: number;
		label?: string;
	};
	accent?: "primary" | "emerald" | "sky" | "rose" | "amber" | "violet";
	accentColor?: string; // Legacy alias for Azalee
	className?: string;
}

const accentVariants = {
	primary: "bg-primary/10 text-primary",
	emerald: "bg-emerald-500/10 text-emerald-600",
	sky: "bg-sky-500/10 text-sky-600",
	rose: "bg-rose-500/10 text-rose-600",
	amber: "bg-amber-500/10 text-amber-600",
	violet: "bg-violet-500/10 text-violet-600",
};

/**
 * Shared Metric/Stats card for Dashboards.
 */
export function DashboardStatsCard({
	title,
	label,
	value,
	icon,
	description,
	href,
	trend,
	accent = "primary",
	accentColor,
	className,
}: DashboardStatsCardProps) {
	const Icon = icon;
	const displayTitle = title || label || "";
	const finalAccent = (accentColor || accent) as keyof typeof accentVariants;

	const content = (
		<div
			className={cn(
				"group relative overflow-hidden rounded-xl border border-border bg-card p-6 transition-all hover:shadow-md",
				className,
			)}
		>
			<div className="flex items-center justify-between">
				<div
					className={cn(
						"rounded-lg p-2.5",
						accentVariants[finalAccent] || accentVariants.primary,
					)}
				>
					{typeof Icon === "string" ? (
						<span className="material-icons size-5 text-center leading-none">
							{Icon}
						</span>
					) : (
						<Icon className="size-5" />
					)}
				</div>
				{trend && (
					<span
						className={cn(
							"text-xs font-medium",
							trend.value > 0 ? "text-emerald-600" : "text-rose-600",
						)}
					>
						{trend.value > 0 ? "+" : ""}
						{trend.value}%
					</span>
				)}
			</div>
			<div className="mt-4">
				<p className="text-sm font-medium text-muted-foreground">
					{displayTitle}
				</p>
				<h3 className="text-2xl font-bold tracking-tight text-foreground">
					{typeof value === "number" ? value.toLocaleString("fr-FR") : value}
				</h3>
				{description && (
					<p className="mt-1 text-xs text-muted-foreground">{description}</p>
				)}
			</div>
		</div>
	);

	if (href) {
		return <Link href={href}>{content}</Link>;
	}

	return content;
}
