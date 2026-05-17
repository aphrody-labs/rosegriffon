"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@/components/ui/command";
import {
	assoMenu,
	contactMenu,
	type MenuItem,
	type SubMenuItem,
} from "@/lib/sidebar-config";

interface SearchEntry {
	url: string;
	title: string;
	description?: string;
	icon: React.ElementType;
	section: string;
}

function flatten(section: string, items: MenuItem[]): SearchEntry[] {
	const out: SearchEntry[] = [];
	for (const item of items) {
		if (item.url) {
			out.push({
				url: item.url,
				title: item.title,
				description: item.description,
				icon: item.icon,
				section,
			});
		}
		if (Array.isArray(item.items)) {
			for (const sub of item.items as SubMenuItem[]) {
				out.push({
					url: sub.url,
					title: sub.title,
					description: sub.description,
					icon: sub.icon,
					section: `${section} · ${item.title}`,
				});
			}
		}
	}
	return out;
}

const SHORTCUTS: SearchEntry[] = [
	{
		url: "/dashboard/account",
		title: "Mon compte",
		description: "Profil, adresse, sécurité",
		icon: Search,
		section: "Raccourcis",
	},
	{
		url: "/login",
		title: "Se connecter",
		icon: Search,
		section: "Raccourcis",
	},
];

export function SidebarSearch() {
	const [open, setOpen] = React.useState(false);
	const router = useRouter();

	React.useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				setOpen((prev) => !prev);
			}
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, []);

	const navEntries = React.useMemo(
		() => [
			...flatten(assoMenu.label, assoMenu.items),
			...flatten(contactMenu.label, contactMenu.items),
		],
		[],
	);

	const grouped = React.useMemo(() => {
		const map = new Map<string, SearchEntry[]>();
		for (const entry of navEntries) {
			const list = map.get(entry.section) ?? [];
			list.push(entry);
			map.set(entry.section, list);
		}
		return Array.from(map.entries());
	}, [navEntries]);

	const handleSelect = (url: string) => {
		setOpen(false);
		router.push(url);
	};

	return (
		<>
			<Button
				type="button"
				variant="outline"
				onClick={() => setOpen(true)}
				className="h-9 w-full justify-start gap-2 border-sidebar-border/40 bg-sidebar-accent/30 px-2.5 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
				aria-label="Rechercher dans la navigation"
			>
				<Search className="size-4" aria-hidden="true" />
				<span className="flex-1 text-left text-sm">Rechercher…</span>
				<kbd className="hidden items-center gap-0.5 rounded border border-sidebar-border/40 bg-sidebar-accent/40 px-1.5 py-0.5 text-xs font-mono text-sidebar-foreground/85 sm:inline-flex">
					<span className="text-xs">⌘</span>K
				</kbd>
			</Button>

			<CommandDialog open={open} onOpenChange={setOpen}>
				<CommandInput placeholder="Aller vers une page, chercher un projet…" />
				<CommandList>
					<CommandEmpty>Aucun résultat.</CommandEmpty>
					{grouped.map(([section, entries], index) => (
						<React.Fragment key={section}>
							{index > 0 && <CommandSeparator />}
							<CommandGroup heading={section}>
								{entries.map((entry) => {
									const Icon = entry.icon;
									return (
										<CommandItem
											key={entry.url}
											value={`${entry.title} ${entry.description ?? ""} ${entry.section}`}
											onSelect={() => handleSelect(entry.url)}
										>
											<Icon className="mr-2 size-4" aria-hidden="true" />
											<div className="min-w-0 flex-1">
												<p className="truncate">{entry.title}</p>
												{entry.description && (
													<p className="truncate text-xs text-muted-foreground">
														{entry.description}
													</p>
												)}
											</div>
										</CommandItem>
									);
								})}
							</CommandGroup>
						</React.Fragment>
					))}
					<CommandSeparator />
					<CommandGroup heading="Raccourcis">
						{SHORTCUTS.map((entry) => {
							const Icon = entry.icon;
							return (
								<CommandItem
									key={entry.url}
									value={entry.title}
									onSelect={() => handleSelect(entry.url)}
								>
									<Icon className="mr-2 size-4" aria-hidden="true" />
									{entry.title}
								</CommandItem>
							);
						})}
					</CommandGroup>
				</CommandList>
			</CommandDialog>
		</>
	);
}
