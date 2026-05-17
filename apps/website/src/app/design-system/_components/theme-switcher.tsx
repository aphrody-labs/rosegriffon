"use client";

import { useEffect, useState } from "react";

const THEMES = [
	{
		id: "theme-azalee-light",
		label: "Azalée Light",
		swatch: "#F89C5A",
		mode: "light",
	},
	{
		id: "theme-azalee-dark",
		label: "Azalée Dark",
		swatch: "#1C1B1F",
		mode: "dark",
	},
	{ id: "theme-roy", label: "Roy", swatch: "#344E8C", mode: "light" },
	{ id: "theme-gaelle", label: "Gaëlle", swatch: "#B03519", mode: "light" },
] as const;

type ThemeId = (typeof THEMES)[number]["id"];

export function ThemeSwitcher() {
	const [active, setActive] = useState<ThemeId>("theme-azalee-light");

	useEffect(() => {
		const root = document.documentElement.parentElement;
		const container =
			document.querySelector("[data-design-system-root]") ?? root;
		if (!container) return;
		for (const t of THEMES) container.classList.remove(t.id);
		container.classList.add(active);
		if (active === "theme-azalee-dark") container.classList.add("dark");
		else container.classList.remove("dark");
	}, [active]);

	return (
		<div
			role="radiogroup"
			aria-label="Choisir un thème"
			className="inline-flex items-center gap-1 rounded-full border-2 border-on-surface p-1 font-mono-ds text-[11px] uppercase tracking-[0.18em]"
		>
			{THEMES.map((t) => {
				const isActive = t.id === active;
				return (
					<button
						key={t.id}
						type="button"
						role="radio"
						aria-checked={isActive}
						onClick={() => setActive(t.id)}
						className={`group flex items-center gap-2 rounded-full px-3 py-1.5 transition-all motion-safe:duration-200 outline-hidden focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
							isActive
								? "bg-on-surface text-surface"
								: "text-on-surface hover:bg-on-surface/10"
						}`}
					>
						<span
							className="inline-block size-2.5 rounded-full ring-1 ring-on-surface/40"
							style={{ background: t.swatch }}
							aria-hidden
						/>
						<span>{t.label}</span>
					</button>
				);
			})}
		</div>
	);
}
