import { ArrowDownRightIcon, PlusIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";

import { ThemeSwitcher } from "./_components/theme-switcher";

const M3_COLORS = [
	{ name: "primary", bg: "bg-primary", text: "text-on-primary" },
	{
		name: "primary-container",
		bg: "bg-primary-container",
		text: "text-on-primary-container",
	},
	{ name: "secondary", bg: "bg-secondary", text: "text-on-secondary" },
	{
		name: "secondary-container",
		bg: "bg-secondary-container",
		text: "text-on-secondary-container",
	},
	{ name: "tertiary", bg: "bg-tertiary", text: "text-on-tertiary" },
	{
		name: "tertiary-container",
		bg: "bg-tertiary-container",
		text: "text-on-tertiary-container",
	},
	{ name: "error", bg: "bg-error", text: "text-on-error" },
	{
		name: "error-container",
		bg: "bg-error-container",
		text: "text-on-error-container",
	},
] as const;

const M3_SURFACES = [
	{ name: "surface-dim", bg: "bg-surface-dim" },
	{ name: "surface", bg: "bg-surface" },
	{ name: "surface-bright", bg: "bg-surface-bright" },
	{ name: "surface-container-lowest", bg: "bg-surface-container-lowest" },
	{ name: "surface-container-low", bg: "bg-surface-container-low" },
	{ name: "surface-container", bg: "bg-surface-container" },
	{ name: "surface-container-high", bg: "bg-surface-container-high" },
	{ name: "surface-container-highest", bg: "bg-surface-container-highest" },
] as const;

const TYPESCALE = [
	{ cls: "type-display-large", label: "Display L", spec: "57 / 64" },
	{ cls: "type-display-medium", label: "Display M", spec: "45 / 52" },
	{ cls: "type-display-small", label: "Display S", spec: "36 / 44" },
	{ cls: "type-headline-large", label: "Headline L", spec: "32 / 40" },
	{ cls: "type-headline-medium", label: "Headline M", spec: "28 / 36" },
	{ cls: "type-headline-small", label: "Headline S", spec: "24 / 32" },
	{ cls: "type-title-large", label: "Title L", spec: "22 / 28" },
	{ cls: "type-title-medium", label: "Title M", spec: "16 / 24 · +0.15" },
	{ cls: "type-title-small", label: "Title S", spec: "14 / 20 · +0.1" },
	{ cls: "type-body-large", label: "Body L", spec: "16 / 24 · +0.5" },
	{ cls: "type-body-medium", label: "Body M", spec: "14 / 20 · +0.25" },
	{ cls: "type-body-small", label: "Body S", spec: "12 / 16 · +0.4" },
	{ cls: "type-label-large", label: "Label L", spec: "14 / 20 · +0.1" },
	{ cls: "type-label-medium", label: "Label M", spec: "12 / 16 · +0.5" },
	{ cls: "type-label-small", label: "Label S", spec: "11 / 16 · +0.5" },
];

const SHAPE_SCALE = [
	{ name: "none", value: "0" },
	{ name: "extra-small", value: "4" },
	{ name: "small", value: "8" },
	{ name: "medium", value: "12" },
	{ name: "large", value: "16" },
	{ name: "extra-large", value: "28" },
	{ name: "full", value: "9999" },
];

const MOTION_DURATIONS = [
	{ tier: "short", values: ["50", "100", "150", "200"] },
	{ tier: "medium", values: ["250", "300", "350", "400"] },
	{ tier: "long", values: ["450", "500", "550", "600"] },
	{ tier: "x-long", values: ["700", "800", "900", "1000"] },
];

const ELEVATION_LEVELS = ["0", "1", "2", "3", "4", "5"];

const NOISE_SVG = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.45 0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.35'/></svg>`;

export default function DesignSystemShowcase() {
	return (
		<main
			data-design-system-root
			className="theme-azalee-light relative isolate font-mono-ds"
			style={{
				fontFamily: "var(--font-mono-ds), ui-monospace, monospace",
			}}
		>
			{/* Grain background */}
			<div
				aria-hidden
				className="pointer-events-none fixed inset-0 z-0 opacity-40 mix-blend-multiply"
				style={{
					backgroundImage: `url("${NOISE_SVG}")`,
					backgroundSize: "200px 200px",
				}}
			/>

			{/* ────────────────────────────────────────────── HERO */}
			<section className="relative z-10 mx-auto grid min-h-[88svh] max-w-[1440px] grid-cols-12 gap-6 px-6 pt-10 pb-24 md:px-12">
				<header className="col-span-12 flex items-start justify-between gap-6 pb-16">
					<div className="font-mono-ds text-[11px] uppercase tracking-[0.32em] text-on-surface-variant">
						<span className="block">@rg/ui</span>
						<span className="block">Design&nbsp;System · v0.1.0</span>
					</div>
					<ThemeSwitcher />
				</header>

				<div className="col-span-12 grid grid-cols-12 gap-6 md:col-span-12">
					<div className="col-span-12 lg:col-span-8">
						<p
							className="mb-8 inline-flex items-center gap-3 rounded-full border border-on-surface/30 px-4 py-1.5 text-[11px] uppercase tracking-[0.28em] text-on-surface-variant"
							style={{ animationDelay: "0ms" }}
						>
							<SparklesIcon className="size-3" aria-hidden />
							<span>Material Design 3 · Tailwind v4 · 55 composants</span>
						</p>
						<h1
							className="font-display-ds text-on-surface"
							style={{
								fontFamily:
									"var(--font-display-ds), 'Fraunces', ui-serif, serif",
								fontWeight: 360,
								fontSize: "clamp(60px, 9vw, 156px)",
								lineHeight: 0.86,
								letterSpacing: "-0.04em",
								fontVariationSettings: "'opsz' 144, 'SOFT' 100, 'WONK' 0",
							}}
						>
							Le{" "}
							<em
								className="text-primary"
								style={{
									fontStyle: "italic",
									fontVariationSettings: "'opsz' 144, 'SOFT' 100, 'WONK' 1",
								}}
							>
								design
							</em>
							<br />
							s'<span className="text-tertiary">écrit</span>
							<br />
							en tokens.
						</h1>
					</div>

					<aside className="col-span-12 mt-10 flex flex-col gap-6 self-end lg:col-span-4 lg:mt-0">
						<p
							className="text-[15px] leading-[1.55] text-on-surface-variant"
							style={{ fontFamily: "var(--font-mono-ds), monospace" }}
						>
							Catalogue vivant des 55 composants{" "}
							<strong className="text-on-surface">@rg/ui</strong>, de la palette{" "}
							<strong className="text-on-surface">MD3</strong> complète et des 4
							thèmes unifiés — Roy, Gaëlle, Azalée light & dark.
						</p>
						<dl className="grid grid-cols-3 gap-3 border-t border-on-surface/20 pt-6 text-on-surface">
							{[
								{ k: "Composants", v: "58" },
								{ k: "Tokens", v: "212" },
								{ k: "Thèmes", v: "4" },
							].map((stat) => (
								<div key={stat.k}>
									<dd
										className="font-display-ds text-[40px] leading-none tracking-tight"
										style={{
											fontFamily: "var(--font-display-ds), serif",
											fontWeight: 500,
										}}
									>
										{stat.v}
									</dd>
									<dt className="mt-1 text-[10px] uppercase tracking-[0.22em] text-on-surface-variant">
										{stat.k}
									</dt>
								</div>
							))}
						</dl>
					</aside>
				</div>

				<a
					href="#palette"
					className="col-span-12 mt-12 inline-flex items-center gap-3 self-end text-[11px] uppercase tracking-[0.28em] text-on-surface-variant transition-colors motion-safe:duration-200 hover:text-primary"
				>
					<span>Scroll · Système</span>
					<ArrowDownRightIcon className="size-4" aria-hidden />
				</a>
			</section>

			{/* ────────────────────────────────────────────── PALETTE */}
			<section
				id="palette"
				className="relative z-10 border-t border-on-surface/15 bg-surface-container-low"
			>
				<div className="mx-auto max-w-[1440px] px-6 py-24 md:px-12">
					<SectionLabel kicker="01 · Color" title="Palette MD3" />

					<div className="mt-14 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
						{M3_COLORS.map((c) => (
							<div
								key={c.name}
								className={`${c.bg} ${c.text} group flex aspect-[5/3] flex-col justify-between p-5`}
							>
								<span className="font-mono-ds text-[10px] uppercase tracking-[0.18em] opacity-70">
									{c.name}
								</span>
								<span
									className="font-display-ds text-[40px] leading-[0.9] tracking-tight"
									style={{
										fontFamily: "var(--font-display-ds), serif",
										fontWeight: 400,
									}}
								>
									Aa
								</span>
							</div>
						))}
					</div>

					<h3 className="mt-20 mb-6 font-mono-ds text-[11px] uppercase tracking-[0.24em] text-on-surface-variant">
						Surface tonal stack
					</h3>
					<div className="grid grid-cols-2 gap-px overflow-hidden md:grid-cols-4 lg:grid-cols-8">
						{M3_SURFACES.map((s) => (
							<div
								key={s.name}
								className={`${s.bg} flex aspect-square flex-col items-center justify-center p-3 text-center text-on-surface`}
							>
								<span className="font-mono-ds text-[9px] uppercase tracking-[0.16em] opacity-70">
									{s.name.replace("surface-", "") || "default"}
								</span>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* ────────────────────────────────────────────── TYPESCALE */}
			<section className="relative z-10 border-t border-on-surface/15">
				<div className="mx-auto max-w-[1440px] px-6 py-24 md:px-12">
					<SectionLabel kicker="02 · Type" title="Typescale M3" />

					<ul className="mt-12 divide-y divide-on-surface/15 border-y border-on-surface/15">
						{TYPESCALE.map((t) => (
							<li
								key={t.cls}
								className="group grid grid-cols-12 items-baseline gap-4 py-4 transition-colors motion-safe:duration-200 hover:bg-surface-container-low"
							>
								<span
									className={`${t.cls} col-span-12 truncate text-on-surface md:col-span-7`}
									style={{ fontFamily: "var(--font-display-ds), serif" }}
								>
									Quelle est ta couleur ?
								</span>
								<span className="col-span-6 font-mono-ds text-[11px] uppercase tracking-[0.18em] text-on-surface-variant md:col-span-3">
									{t.label}
								</span>
								<span className="col-span-6 text-right font-mono-ds text-[10px] text-on-surface-variant md:col-span-2">
									{t.spec}
								</span>
							</li>
						))}
					</ul>
				</div>
			</section>

			{/* ────────────────────────────────────────────── COMPONENTS */}
			<section className="relative z-10 border-t border-on-surface/15 bg-surface-container-low">
				<div className="mx-auto grid max-w-[1440px] grid-cols-12 gap-6 px-6 py-24 md:px-12">
					<div className="col-span-12 mb-12">
						<SectionLabel kicker="03 · Components" title="Buttons & FAB" />
					</div>

					<div className="col-span-12 grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-3">
						<ComponentTile title="Filled Button">
							<button
								type="button"
								className="inline-flex h-10 items-center justify-center gap-2 rounded-(--md-sys-shape-corner-full) bg-primary px-6 font-mono-ds text-[13px] font-medium text-on-primary transition-all motion-safe:duration-200 hover:shadow-(--md-sys-elevation-level1) outline-hidden focus-visible:ring-[3px] focus-visible:ring-primary/40"
							>
								<PlusIcon className="size-4" aria-hidden /> Nouvelle action
							</button>
						</ComponentTile>

						<ComponentTile title="Tonal Button">
							<button
								type="button"
								className="inline-flex h-10 items-center justify-center gap-2 rounded-(--md-sys-shape-corner-full) bg-secondary-container px-6 font-mono-ds text-[13px] font-medium text-on-secondary-container transition-all motion-safe:duration-200 hover:shadow-(--md-sys-elevation-level1) outline-hidden focus-visible:ring-[3px] focus-visible:ring-primary/40"
							>
								Tonal
							</button>
						</ComponentTile>

						<ComponentTile title="Outlined Button">
							<button
								type="button"
								className="inline-flex h-10 items-center justify-center gap-2 rounded-(--md-sys-shape-corner-full) border border-outline px-6 font-mono-ds text-[13px] font-medium text-primary transition-all motion-safe:duration-200 hover:bg-primary/8 outline-hidden focus-visible:ring-[3px] focus-visible:ring-primary/40"
							>
								Outlined
							</button>
						</ComponentTile>

						<ComponentTile title="FAB · Primary">
							<button
								type="button"
								aria-label="Ajouter"
								className="grid size-14 place-items-center rounded-(--md-sys-shape-corner-extra-large) bg-primary-container text-on-primary-container shadow-(--md-sys-elevation-level3) transition-shadow motion-safe:duration-200 hover:shadow-(--md-sys-elevation-level4) outline-hidden focus-visible:ring-[3px] focus-visible:ring-primary/40"
							>
								<PlusIcon className="size-6" aria-hidden />
							</button>
						</ComponentTile>

						<ComponentTile title="FAB Extended">
							<button
								type="button"
								className="inline-flex h-14 items-center gap-3 rounded-(--md-sys-shape-corner-extra-large) bg-tertiary-container px-5 font-mono-ds text-[14px] font-medium text-on-tertiary-container shadow-(--md-sys-elevation-level3) transition-shadow motion-safe:duration-200 hover:shadow-(--md-sys-elevation-level4) outline-hidden focus-visible:ring-[3px] focus-visible:ring-primary/40"
							>
								<PlusIcon className="size-5" aria-hidden /> Composer
							</button>
						</ComponentTile>

						<ComponentTile title="Badge stack">
							<div className="flex flex-wrap items-center gap-2 font-mono-ds text-[11px] uppercase tracking-[0.12em]">
								<span className="rounded-full bg-primary px-2.5 py-1 text-on-primary">
									Primary
								</span>
								<span className="rounded-full bg-secondary-container px-2.5 py-1 text-on-secondary-container">
									Secondary
								</span>
								<span className="rounded-full bg-tertiary-container px-2.5 py-1 text-on-tertiary-container">
									Tertiary
								</span>
								<span className="rounded-full bg-error-container px-2.5 py-1 text-on-error-container">
									Error
								</span>
								<span className="rounded-full border border-outline px-2.5 py-1 text-on-surface">
									Outline
								</span>
							</div>
						</ComponentTile>
					</div>

					{/* Card preview avec elevation tonale */}
					<div className="col-span-12 mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
						{ELEVATION_LEVELS.slice(0, 3).map((lvl, i) => (
							<article
								key={lvl}
								className="bg-surface-container-low rounded-(--md-sys-shape-corner-large) p-6"
								style={{
									boxShadow: `var(--md-sys-elevation-level${i + 1})`,
								}}
							>
								<header className="mb-3 flex items-center justify-between">
									<span className="font-mono-ds text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
										Card · elev {lvl}
									</span>
									<span className="grid size-7 place-items-center rounded-full bg-primary-container text-on-primary-container">
										<SparklesIcon className="size-3.5" aria-hidden />
									</span>
								</header>
								<h4
									className="font-display-ds text-[28px] leading-tight text-on-surface"
									style={{ fontFamily: "var(--font-display-ds), serif" }}
								>
									{["Roy", "Gaëlle", "Azalée"][i]}
								</h4>
								<p className="mt-2 text-[13px] text-on-surface-variant">
									Tonale élévation niveau {i + 1}, surface container low.
								</p>
							</article>
						))}
					</div>
				</div>
			</section>

			{/* ────────────────────────────────────────────── SHAPE */}
			<section className="relative z-10 border-t border-on-surface/15">
				<div className="mx-auto max-w-[1440px] px-6 py-24 md:px-12">
					<SectionLabel kicker="04 · Shape" title="Corner scale" />
					<div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
						{SHAPE_SCALE.map((s) => (
							<div
								key={s.name}
								className="group flex flex-col items-center gap-3"
							>
								<div
									className="grid aspect-square w-full place-items-center bg-primary-container text-on-primary-container transition-transform motion-safe:duration-200 group-hover:-translate-y-1"
									style={{
										borderRadius: s.name === "full" ? "9999px" : `${s.value}px`,
									}}
								>
									<span
										className="font-display-ds text-[28px]"
										style={{
											fontFamily: "var(--font-display-ds), serif",
											fontWeight: 500,
										}}
									>
										{s.value === "9999" ? "∞" : s.value}
									</span>
								</div>
								<span className="text-center font-mono-ds text-[10px] uppercase tracking-[0.16em] text-on-surface-variant">
									{s.name}
								</span>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* ────────────────────────────────────────────── MOTION */}
			<section className="relative z-10 border-t border-on-surface/15 bg-surface-container">
				<div className="mx-auto max-w-[1440px] px-6 py-24 md:px-12">
					<SectionLabel kicker="05 · Motion" title="Durations & easings" />

					<div className="mt-12 grid gap-10 lg:grid-cols-2">
						<div>
							<h3 className="mb-6 font-mono-ds text-[11px] uppercase tracking-[0.22em] text-on-surface-variant">
								Durations
							</h3>
							<div className="space-y-2">
								{MOTION_DURATIONS.map((row) => (
									<div
										key={row.tier}
										className="flex items-center gap-3 font-mono-ds text-[11px]"
									>
										<span className="w-16 uppercase tracking-[0.16em] text-on-surface-variant">
											{row.tier}
										</span>
										{row.values.map((ms) => (
											<span
												key={ms}
												className="flex-1 rounded-md bg-secondary-container px-2 py-3 text-center text-on-secondary-container"
											>
												{ms}ms
											</span>
										))}
									</div>
								))}
							</div>
						</div>

						<div>
							<h3 className="mb-6 font-mono-ds text-[11px] uppercase tracking-[0.22em] text-on-surface-variant">
								Easings
							</h3>
							<div className="space-y-3 font-mono-ds text-[11px]">
								{[
									{ name: "standard", curve: "cubic-bezier(.2,0,0,1)" },
									{ name: "emphasized", curve: "cubic-bezier(.3,0,0,1)" },
									{ name: "standard-decel", curve: "cubic-bezier(0,0,0,1)" },
									{
										name: "emphasized-decel",
										curve: "cubic-bezier(.05,.7,.1,1)",
									},
								].map((e) => (
									<div
										key={e.name}
										className="rounded-md border border-outline-variant bg-surface px-4 py-3"
									>
										<div className="flex justify-between text-on-surface">
											<span className="uppercase tracking-[0.18em]">
												{e.name}
											</span>
											<span className="text-on-surface-variant">{e.curve}</span>
										</div>
									</div>
								))}
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* ────────────────────────────────────────────── ELEVATION */}
			<section className="relative z-10 border-t border-on-surface/15">
				<div className="mx-auto max-w-[1440px] px-6 py-24 md:px-12">
					<SectionLabel kicker="06 · Elevation" title="6 levels" />
					<div className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
						{ELEVATION_LEVELS.map((lvl) => (
							<div key={lvl} className="flex flex-col items-center gap-4">
								<div
									className="grid size-24 place-items-center rounded-(--md-sys-shape-corner-medium) bg-surface text-on-surface"
									style={{
										boxShadow: `var(--md-sys-elevation-level${lvl})`,
									}}
								>
									<span
										className="font-display-ds text-[24px]"
										style={{ fontFamily: "var(--font-display-ds), serif" }}
									>
										{lvl}
									</span>
								</div>
								<span className="font-mono-ds text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
									level{lvl}
								</span>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* ────────────────────────────────────────────── FOOTER */}
			<footer className="relative z-10 border-t border-on-surface/15 bg-surface-container-highest">
				<div className="mx-auto max-w-[1440px] px-6 py-16 md:px-12">
					<div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
						<div>
							<p
								className="font-display-ds text-[44px] leading-none tracking-tight text-on-surface md:text-[64px]"
								style={{
									fontFamily: "var(--font-display-ds), serif",
									fontWeight: 380,
								}}
							>
								Tu{" "}
								<em className="text-primary" style={{ fontStyle: "italic" }}>
									composes
								</em>
								,
								<br />
								la couleur <span className="text-tertiary">suit</span>.
							</p>
						</div>
						<dl className="space-y-2 font-mono-ds text-[11px] uppercase tracking-[0.18em] text-on-surface-variant md:text-right">
							<div>
								<dt className="inline">Package · </dt>
								<dd className="inline text-on-surface">@rg/ui</dd>
							</div>
							<div>
								<dt className="inline">Version · </dt>
								<dd className="inline text-on-surface">0.1.0</dd>
							</div>
							<div>
								<dt className="inline">Stack · </dt>
								<dd className="inline text-on-surface">
									Tailwind v4 · Radix · MD3
								</dd>
							</div>
							<div>
								<dt className="inline">Docs · </dt>
								<dd className="inline">
									<Link
										className="text-on-surface underline-offset-4 hover:underline"
										href="https://github.com/rose-griffon/rg/blob/main/packages/ui/README.md"
									>
										packages/ui/README.md
									</Link>
								</dd>
							</div>
						</dl>
					</div>
				</div>
			</footer>
		</main>
	);
}

function SectionLabel({ kicker, title }: { kicker: string; title: string }) {
	return (
		<div className="grid grid-cols-12 items-end gap-6">
			<span className="col-span-12 font-mono-ds text-[10px] uppercase tracking-[0.32em] text-on-surface-variant md:col-span-3">
				{kicker}
			</span>
			<h2
				className="col-span-12 font-display-ds text-on-surface md:col-span-9"
				style={{
					fontFamily: "var(--font-display-ds), serif",
					fontWeight: 380,
					fontSize: "clamp(40px, 6vw, 80px)",
					lineHeight: 0.92,
					letterSpacing: "-0.025em",
					fontVariationSettings: "'opsz' 144, 'SOFT' 100, 'WONK' 0",
				}}
			>
				{title}
			</h2>
		</div>
	);
}

function ComponentTile({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-5 border-t border-on-surface/15 pt-5">
			<span className="font-mono-ds text-[10px] uppercase tracking-[0.22em] text-on-surface-variant">
				{title}
			</span>
			<div className="grid min-h-[120px] place-items-center rounded-(--md-sys-shape-corner-medium) bg-surface p-8">
				{children}
			</div>
		</div>
	);
}
