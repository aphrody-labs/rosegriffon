"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

export interface UnifiedSearchBarProps extends React.ComponentProps<"div"> {
	placeholder?: string;
	defaultValue?: string;
	searchPath?: string;
	onSearch?: (query: string) => void;
}

export function UnifiedSearchBar({
	placeholder = "Rechercher (articles, wiki, tournois)...",
	defaultValue = "",
	searchPath = "/search",
	onSearch,
	className,
	...props
}: UnifiedSearchBarProps) {
	const router = useRouter();
	const [query, setQuery] = React.useState(defaultValue);
	const inputRef = React.useRef<HTMLInputElement>(null);

	// Raccourci global Ctrl+K / Cmd+K pour focaliser
	React.useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				inputRef.current?.focus();
				inputRef.current?.select();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	const handleSubmit = (value: string) => {
		const trimmed = value.trim();
		if (!trimmed) return;
		if (onSearch) {
			onSearch(trimmed);
		} else {
			router.push(`${searchPath}?q=${encodeURIComponent(trimmed)}`);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			handleSubmit(query);
		} else if (e.key === "Escape") {
			inputRef.current?.blur();
		}
	};

	const handleClear = () => {
		setQuery("");
		inputRef.current?.focus();
	};

	return (
		<div
			role="search"
			className={`relative flex items-center w-full max-w-[480px] h-10 px-3.5 rounded-full bg-surface-container-high/70 hover:bg-surface-container-high focus-within:bg-surface-container-highest border border-outline-variant/15 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-200 group ${
				className ?? ""
			}`}
			{...props}
		>
			<Search
				size={18}
				className="text-on-surface-variant/70 group-focus-within:text-primary transition-colors shrink-0 mr-2.5"
				aria-hidden="true"
			/>
			<input
				ref={inputRef}
				type="text"
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				aria-label="Recherche unifiée"
				className="flex-1 bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/60 outline-hidden min-w-0"
			/>

			{query ? (
				<button
					type="button"
					onClick={handleClear}
					aria-label="Effacer la recherche"
					className="size-5 rounded-full flex items-center justify-center text-on-surface-variant/60 hover:text-on-surface hover:bg-on-surface/10 transition-colors ml-1 shrink-0"
				>
					<X size={13} aria-hidden="true" />
				</button>
			) : (
				<kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold text-on-surface-variant/60 bg-surface-container-low border border-outline-variant/20 rounded shadow-xs ml-1 select-none pointer-events-none">
					<span className="text-[11px]">⌘</span>K
				</kbd>
			)}
		</div>
	);
}

export default UnifiedSearchBar;
