"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { searchTranslations } from "@/app/actions/translate";
import type { TranslationResult } from "@/app/actions/translate";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@rose-griffon/ui";
import { cn } from "@/lib/utils";
import { RagAssistant } from "@/components/wiki/RagAssistant";

const ENTITY_TYPES = [
	{ label: "Tous", value: undefined },
	{ label: "Personnages", value: "character" },
	{ label: "Techniques", value: "skill" },
	{ label: "Objets", value: "item" },
	{ label: "Tactiques", value: "tactic" },
	{ label: "Équipes", value: "team" },
	{ label: "Esprits G.", value: "keshin" },
	{ label: "Totems", value: "soul" },
] as const;

const LANGS = ["FR", "EN", "JA", "ROMA"] as const;
type Lang = (typeof LANGS)[number];

const LANG_LABELS: Record<Lang, string> = {
	EN: "English",
	FR: "Français",
	JA: "日本語",
	ROMA: "Romaji",
};

const TYPE_COLORS: Record<string, string> = {
	character: "bg-blue-500/15 text-blue-400",
	item: "bg-emerald-500/15 text-emerald-400",
	keshin: "bg-cyan-500/15 text-cyan-400",
	skill: "bg-amber-500/15 text-amber-400",
	soul: "bg-teal-500/15 text-teal-400",
	tactic: "bg-purple-500/15 text-purple-400",
	team: "bg-rose-500/15 text-rose-400",
};

export function TranslatorClient() {
	const [query, setQuery] = useState("");
	const [entityType, setEntityType] = useState<string | undefined>();
	const [results, setResults] = useState<TranslationResult[]>([]);
	const [isSearching, setIsSearching] = useState(false);
	const [hasSearched, setHasSearched] = useState(false);
	const [selectedResult, setSelectedResult] = useState<TranslationResult | null>(null);
	const [copiedLang, setCopiedLang] = useState<string | null>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);

	const doSearch = useCallback(async (q: string, type?: string) => {
		if (q.length < 2) {
			setResults([]);
			setHasSearched(false);
			setSelectedResult(null);
			return;
		}
		setIsSearching(true);
		setHasSearched(true);
		try {
			const data = await searchTranslations(q, type);
			setResults(data);
			setSelectedResult(data.length > 0 ? data[0] : null);
		} catch {
			setResults([]);
			setSelectedResult(null);
		} finally {
			setIsSearching(false);
		}
	}, []);

	useEffect(() => {
		if (query.length < 2) {
			setResults([]);
			setHasSearched(false);
			setSelectedResult(null);
			return;
		}
		const timer = setTimeout(() => doSearch(query, entityType), 300);
		return () => clearTimeout(timer);
	}, [query, entityType, doSearch]);

	const clearQuery = () => {
		setQuery("");
		setResults([]);
		setHasSearched(false);
		setSelectedResult(null);
		inputRef.current?.focus();
	};

	const copyName = async (name: string, lang: string) => {
		try {
			await navigator.clipboard.writeText(name);
			setCopiedLang(lang);
			setTimeout(() => setCopiedLang(null), 1500);
		} catch {
			/* Silent */
		}
	};

	const active = selectedResult;

	const ragSuggestions = useMemo(() => {
		const list: string[] = [];
		if (active) {
			if (active.name_fr) list.push(active.name_fr);
			if (active.name_en) list.push(active.name_en);
			if (active.name_ja) list.push(active.name_ja);
		} else if (query.trim().length >= 2) {
			list.push(query);
		}
		list.push("Esprits Guerriers", "Victory Road", "Chroniques");
		return Array.from(new Set(list)).slice(0, 5);
	}, [active, query]);

	return (
		<div className="w-full space-y-4 sm:space-y-5">
			{/* Header */}
			<div>
				<h1 className="font-[BradBunR] text-2xl sm:text-3xl md:text-4xl text-on-surface tracking-wide">
					Traducteur
				</h1>
				<p className="type-body-small text-on-surface-variant mt-1">
					Noms FR / EN / JA / Romaji pour personnages, techniques, objets et plus.
				</p>
			</div>

			{/* Entity type filter chips */}
			<div
				className="flex flex-wrap gap-1.5 sm:gap-2"
				role="radiogroup"
				aria-label="Filtrer par type"
			>
				{ENTITY_TYPES.map((et) => {
					const isActive = entityType === et.value;
					return (
						<button
							key={et.value ?? "all"}
							onClick={() => setEntityType(et.value)}
							aria-pressed={isActive}
							className={cn(
								"inline-flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-bold transition-all",
								isActive
									? "bg-secondary-container text-on-secondary-container elevation-1"
									: "border border-outline text-on-surface-variant hover:bg-on-surface/[0.08]"
							)}
						>
							{isActive && <Icon name="check" size={16} />}
							{et.label}
						</button>
					);
				})}
			</div>

			{/* Main translator panel */}
			<div className="rounded-xl overflow-hidden bg-surface-container-low elevation-1">
				<div className="grid grid-cols-1 md:grid-cols-2 min-h-[220px] sm:min-h-[260px]">
					{/* LEFT: Input panel */}
					<div className="relative border-b md:border-b-0 md:border-r border-outline-variant/20 flex flex-col">
						{/* Language header */}
						<div className="flex items-center justify-between h-11 px-4 border-b border-outline-variant/15 bg-surface-container/40">
							<span className="type-label-large text-primary">Recherche</span>
							{query && (
								<button
									onClick={clearQuery}
									aria-label="Effacer la recherche"
									className="p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant/40 hover:text-on-surface-variant transition-colors"
								>
									<Icon name="close" size={16} />
								</button>
							)}
						</div>

						{/* Textarea */}
						<div className="flex-1 relative">
							<textarea
								ref={inputRef}
								value={query}
								onChange={(e) => setQuery(e.target.value.replaceAll("\n", ""))}
								placeholder="Mark Evans, Fire Tornado, 円堂守..."
								aria-label="Rechercher un nom"
								rows={3}
								className="w-full h-full min-h-[120px] sm:min-h-[160px] p-4 bg-transparent text-on-surface text-lg sm:text-xl placeholder:text-on-surface-variant/30 focus:outline-hidden resize-none"
							/>
						</div>

						{/* Footer */}
						<div className="px-4 py-2 border-t border-outline-variant/10 text-[10px] text-on-surface-variant/35 flex items-center gap-1.5">
							<span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/40" />
							Conversion romaji → katakana automatique
						</div>
					</div>

					{/* RIGHT: Translation output */}
					<div className="bg-surface-container/20 flex flex-col">
						{/* Language tabs header */}
						<div className="flex items-center h-11 px-4 border-b border-outline-variant/15 bg-surface-container/40">
							<div className="flex items-center gap-3">
								{LANGS.map((lang) => (
									<span key={lang} className="type-label-large text-on-surface-variant/70">
										{LANG_LABELS[lang]}
									</span>
								))}
							</div>
						</div>

						{/* Translation content */}
						<div className="flex-1 p-4 flex flex-col justify-center">
							{/* Initial state */}
							{!hasSearched && !isSearching && (
								<div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
									<div className="p-3 rounded-2xl bg-surface-container">
										<Icon name="translate" size={28} className="text-on-surface-variant/25" />
									</div>
									<div>
										<p className="type-body-small text-on-surface-variant/50">
											Les traductions apparaîtront ici
										</p>
										<p className="text-[11px] text-on-surface-variant/30 mt-0.5">
											Tapez au moins 2 caractères
										</p>
									</div>
								</div>
							)}

							{/* Loading */}
							{isSearching && (
								<div className="space-y-4 py-2">
									{LANGS.map((lang) => (
										<div key={lang} className="flex items-center gap-3">
											<Skeleton className="h-5 w-8 rounded" />
											<Skeleton className="h-6 w-48" />
										</div>
									))}
								</div>
							)}

							{/* No results */}
							{hasSearched && !isSearching && !active && (
								<div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
									<Icon name="search_off" size={24} className="text-on-surface-variant/25" />
									<p className="type-body-small text-on-surface-variant/50">
										Aucun résultat pour « {query} »
									</p>
								</div>
							)}

							{/* Active translation */}
							{active && !isSearching && (
								<div className="space-y-3 sm:space-y-4">
									{/* Type badge + link */}
									<div className="flex items-center justify-between">
										<span
											className={cn(
												"inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
												TYPE_COLORS[active.type] ||
													"bg-surface-container-high text-on-surface-variant"
											)}
										>
											{active.typeLabel}
										</span>
										<Link
											href={active.url}
											className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
										>
											Voir la fiche
											<Icon name="chevron_right" size={14} />
										</Link>
									</div>

									{/* Names — large display */}
									{LANGS.map((lang) => {
										const name =
											lang === "FR"
												? active.name_fr
												: lang === "EN"
													? active.name_en
													: lang === "JA"
														? active.name_ja
														: active.name_roma;
										return (
											<div key={lang} className="group flex items-center gap-3 min-h-[32px]">
												<span
													className={cn(
														"shrink-0 w-7 text-center px-1 py-0.5 rounded text-[9px] font-black leading-none",
														lang === "FR"
															? "bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)]"
															: lang === "EN"
																? "bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]"
																: lang === "JA"
																	? "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]"
																	: "bg-pink-500/15 text-pink-400"
													)}
												>
													{lang}
												</span>
												<div className="flex-1 min-w-0">
													{name ? (
														<span
															className={cn(
																"text-on-surface block truncate",
																lang === "JA"
																	? "text-lg sm:text-xl"
																	: lang === "ROMA"
																		? "text-base sm:text-lg italic text-on-surface-variant"
																		: "text-base sm:text-lg font-medium"
															)}
														>
															{name}
														</span>
													) : (
														<span className="text-on-surface-variant/25 text-base">—</span>
													)}
												</div>
												{name && (
													<button
														onClick={() => copyName(name, lang)}
														aria-label={`Copier le nom ${LANG_LABELS[lang]}`}
														className="shrink-0 p-1.5 rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-surface-container-high text-on-surface-variant/40 hover:text-on-surface-variant transition-all"
													>
														{copiedLang === lang ? (
															<Icon name="check" size={14} className="text-green-500" />
														) : (
															<Icon name="content_copy" size={14} />
														)}
													</button>
												)}
											</div>
										);
									})}
								</div>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Result list */}
			{hasSearched && !isSearching && results.length > 0 && (
				<div>
					<p className="type-label-medium text-on-surface-variant/60 mb-2">
						{results.length} résultat{results.length > 1 ? "s" : ""}
					</p>
					<div className="space-y-1">
						{results.map((result) => {
							const isActive = active?.id === result.id && active?.type === result.type;
							return (
								<button
									key={`${result.type}-${result.id}`}
									onClick={() => setSelectedResult(result)}
									className={cn(
										"w-full relative flex items-center gap-2.5 sm:gap-3 rounded-xl px-3 h-14 text-left transition-all overflow-hidden",
										isActive ? "bg-secondary-container" : "state-layer hover:bg-on-surface/[0.08]"
									)}
								>
									<span
										className={cn(
											"shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
											TYPE_COLORS[result.type] ||
												"bg-surface-container-high text-on-surface-variant"
										)}
									>
										{result.typeLabel}
									</span>

									<span className="flex-1 text-sm font-medium text-on-surface truncate">
										{result.name_fr || result.name_en || result.name_ja || "—"}
									</span>

									{result.name_en && result.name_en !== result.name_fr && (
										<span className="hidden sm:block text-xs text-on-surface-variant/40 truncate max-w-[180px]">
											{result.name_en}
										</span>
									)}

									<Link
										href={result.url}
										onClick={(e) => e.stopPropagation()}
										className="shrink-0 p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant/25 hover:text-primary transition-colors"
										aria-label={`Voir la fiche de ${result.name_fr || result.name_en}`}
									>
										<Icon name="chevron_right" size={16} />
									</Link>
								</button>
							);
						})}
					</div>
				</div>
			)}

			{/* RAG Tactical Assistant */}
			<RagAssistant
				initialQuery={active ? active.name_fr || active.name_en || "" : ""}
				suggestions={ragSuggestions}
				className="mt-6"
			/>
		</div>
	);
}
