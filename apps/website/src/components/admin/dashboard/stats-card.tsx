import Link from "next/link";
import type { ElementType } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatsCardProps {
	title: string;
	value: string | number;
	description?: string;
	icon: ElementType;
	href?: string;
	className?: string;
	accent?: "primary" | "emerald" | "amber" | "rose" | "sky" | "violet";
	trend?: { value: string; positive?: boolean };
}

const ACCENTS = {
	primary: "bg-primary/10 text-primary",
	emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
	amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
	rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
	sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
	violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
};

export function StatsCard({
	title,
	value,
	description,
	icon: Icon,
	href,
	className,
	accent = "primary",
	trend,
}: StatsCardProps) {
	const Wrapper = href ? Link : "div";
	const wrapperProps = href ? { href } : {};

	return (
		<Wrapper
			{...(wrapperProps as { href: string })}
			className={cn(href && "group block")}
		>
			<Card
				className={cn(
					"h-full transition-all",
					href &&
						"group-hover:border-primary/40 group-hover:shadow-md group-hover:-translate-y-0.5",
					className,
				)}
			>
				<CardContent className="p-5">
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0 flex-1">
							<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
								{title}
							</p>
							<p className="mt-2 text-3xl font-bold tabular-nums text-foreground">
								{value}
							</p>
							{description && (
								<p className="mt-1 text-xs text-muted-foreground">
									{description}
								</p>
							)}
							{trend && (
								<p
									className={cn(
										"mt-2 inline-flex items-center gap-1 text-xs font-medium",
										trend.positive
											? "text-emerald-600 dark:text-emerald-400"
											: "text-rose-600 dark:text-rose-400",
									)}
								>
									{trend.positive ? "↑" : "↓"} {trend.value}
								</p>
							)}
						</div>
						<div
							className={cn(
								"flex size-10 shrink-0 items-center justify-center rounded-lg",
								ACCENTS[accent],
							)}
						>
							<Icon className="size-5" />
						</div>
					</div>
				</CardContent>
			</Card>
		</Wrapper>
	);
}
