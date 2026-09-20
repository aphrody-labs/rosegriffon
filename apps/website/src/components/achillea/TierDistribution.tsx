"use client";

import type { RankedTierInfo } from "@rosegriffon/achillea-types";

interface TierDistributionProps {
	tiers?: RankedTierInfo[];
	highlightKey?: string | null;
	className?: string;
}

export function TierDistribution({
	tiers = [],
	highlightKey,
	className,
}: TierDistributionProps) {
	const total = tiers.reduce((acc, t) => acc + (t.playerCount ?? 0), 0);
	const maxCount = Math.max(1, ...tiers.map((t) => t.playerCount ?? 0));

	if (!tiers.length || total === 0) return null;

	const percent = (count: number) => {
		if (maxCount === 0) return 0;
		return Math.max(2, Math.round((count / maxCount) * 100));
	};

	const percentLabel = (count: number) => {
		if (total === 0) return "0";
		const v = (count / total) * 100;
		if (v < 0.1 && count > 0) return "<0.1";
		return v.toFixed(1);
	};

	const gradient = (g?: string[] | null) => {
		if (!g || g.length < 2) return "linear-gradient(90deg, #555, #777)";
		return `linear-gradient(90deg, ${g.join(", ")})`;
	};

	return (
		<div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
			{tiers.map((t) => {
				const isMine = t.key === highlightKey;
				return (
					<div
						key={t.key}
						className={`flex items-center gap-2 transition-all ${
							isMine ? "font-bold text-primary" : "text-on-surface"
						}`}
					>
						<div className="w-24 md:w-28 text-xs md:text-sm text-right truncate">
							{t.key}
						</div>
						<div
							className={`flex-1 relative h-5 rounded-full overflow-hidden bg-surface-variant ${
								isMine ? "ring-2 ring-primary ring-offset-1" : ""
							}`}
						>
							<div
								className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
								style={{
									width: `${percent(t.playerCount ?? 0)}%`,
									background: gradient(t.gradient),
								}}
							/>
						</div>
						<div className="text-xs font-mono w-20 md:w-24 text-right tabular-nums opacity-80">
							{t.playerCount ?? 0}
							<span className="opacity-60 ml-1">
								({percentLabel(t.playerCount ?? 0)}%)
							</span>
						</div>
					</div>
				);
			})}
		</div>
	);
}
