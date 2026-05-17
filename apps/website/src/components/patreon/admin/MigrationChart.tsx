interface Props {
	pending: number;
	reactivated: number;
	churned: number;
	grandfathered?: number;
}

export function MigrationChart({
	pending,
	reactivated,
	churned,
	grandfathered = 0,
}: Props) {
	const total = pending + reactivated + churned + grandfathered;
	if (total === 0) {
		return (
			<div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-white/10 text-sm text-white/40">
				Aucun membre encore importé
			</div>
		);
	}

	const segments = [
		{
			label: "Réactivés",
			value: reactivated,
			color: "#5fa893",
			pct: (reactivated / total) * 100,
		},
		{
			label: "Grandfathered",
			value: grandfathered,
			color: "#aac9d9",
			pct: (grandfathered / total) * 100,
		},
		{
			label: "En attente",
			value: pending,
			color: "#c9a958",
			pct: (pending / total) * 100,
		},
		{
			label: "Churn",
			value: churned,
			color: "#e54a4a",
			pct: (churned / total) * 100,
		},
	].filter((s) => s.value > 0);

	return (
		<div className="space-y-4">
			<div className="flex h-3 overflow-hidden rounded-full bg-white/5">
				{segments.map((s) => (
					<div
						key={s.label}
						className="h-full transition-all"
						style={{ width: `${s.pct}%`, backgroundColor: s.color }}
						title={`${s.label}: ${s.value} (${s.pct.toFixed(1)}%)`}
					/>
				))}
			</div>
			<div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
				{segments.map((s) => (
					<div key={s.label} className="flex items-center gap-2">
						<span
							className="h-2.5 w-2.5 shrink-0 rounded-full"
							style={{ backgroundColor: s.color }}
						/>
						<span className="text-white/70">{s.label}</span>
						<span className="font-bold text-white">{s.value}</span>
						<span className="text-xs text-white/40">{s.pct.toFixed(0)}%</span>
					</div>
				))}
			</div>
		</div>
	);
}
