import React from "react";

interface EnumMember {
	name: string;
	value: number;
}

interface EnumInfo {
	name: string;
	short: string;
	members: EnumMember[];
}

interface EnumsTabProps {
	enums: EnumInfo[];
}

export function EnumsTab({ enums }: EnumsTabProps) {
	return (
		<section>
			<h2 className="text-lg font-black text-on-surface mb-3">
				Énumérations <span className="text-on-surface-variant font-normal">({enums.length})</span>
			</h2>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
				{enums.slice(0, 60).map((e) => (
					<div key={e.name} className="rounded-2xl bg-surface-container p-4 border border-outline-variant/50">
						<div className="font-bold text-on-surface text-sm">{e.short}</div>
						<div className="flex flex-wrap gap-1.5 mt-2">
							{e.members.slice(0, 24).map((m) => (
								<span
									key={`${e.name}.${m.name}`}
									className="rounded-md bg-surface-container-highest text-on-surface-variant px-1.5 py-0.5 text-[11px]"
									title={`= ${m.value}`}
								>
									{m.name}
								</span>
							))}
							{e.members.length > 24 && (
								<span className="text-[11px] text-on-surface-variant">+{e.members.length - 24}</span>
							)}
						</div>
					</div>
				))}
			</div>
			{enums.length > 60 && (
				<p className="text-xs text-on-surface-variant mt-3">
					{enums.length - 60} énumérations supplémentaires (affinez la recherche).
				</p>
			)}
		</section>
	);
}
