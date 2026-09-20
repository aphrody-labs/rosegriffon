"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { createAchilleaClient } from "@/lib/achillea";
import type { ClanDTO } from "@rosegriffon/achillea-types";
import { ClanCard } from "@/components/achillea/ClanCard";
import { Button, Input, Skeleton, Badge } from "@rosegriffon/ui";
import {
	Search,
	Users,
	Plus,
	SlidersHorizontal,
	ArrowUpDown,
	Filter,
	Sparkles,
} from "lucide-react";

export default function ClansPage() {
	const [clans, setClans] = useState<ClanDTO[]>([]);
	const [loading, setLoading] = useState(true);

	// Filtres
	const [query, setQuery] = useState("");
	const [onlyRecruiting, setOnlyRecruiting] = useState(false);
	const [onlyAutoAccept, setOnlyAutoAccept] = useState(false);
	const [selectedLanguage, setSelectedLanguage] = useState<string>("all");
	const [sortBy, setSortBy] = useState<"level" | "fame" | "date">("level");
	const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

	useEffect(() => {
		let isMounted = true;
		async function fetchClans() {
			setLoading(true);
			try {
				const client = createAchilleaClient();
				const res = await client.clans.list({ page: 1, pagination: 100 });
				if (res.ok && isMounted) {
					setClans(res.value.data);
				}
			} finally {
				if (isMounted) setLoading(false);
			}
		}
		void fetchClans();
		return () => {
			isMounted = false;
		};
	}, []);

	const filteredClans = useMemo(() => {
		const q = query.trim().toLowerCase();
		return clans
			.filter((c) => {
				if (
					q &&
					!c.name.toLowerCase().includes(q) &&
					!c.shortenedName.toLowerCase().includes(q)
				) {
					return false;
				}
				if (onlyRecruiting && !c.isRecruiting) return false;
				if (onlyAutoAccept && !c.autoAcceptMembers) return false;
				if (
					selectedLanguage !== "all" &&
					!c.languages?.map((l) => l.toLowerCase()).includes(selectedLanguage)
				) {
					return false;
				}
				return true;
			})
			.sort((a, b) => {
				let diff = 0;
				if (sortBy === "level") {
					diff = (a.experience?.totalXp ?? 0) - (b.experience?.totalXp ?? 0);
				} else if (sortBy === "fame") {
					diff = (a.fame ?? 0) - (b.fame ?? 0);
				} else if (sortBy === "date") {
					diff =
						new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
				}
				return sortOrder === "asc" ? diff : -diff;
			});
	}, [clans, query, onlyRecruiting, onlyAutoAccept, selectedLanguage, sortBy, sortOrder]);

	return (
		<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
			{/* Header */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline/15 pb-6">
				<div className="space-y-1">
					<div className="flex items-center gap-2">
						<Users className="size-6 text-primary" />
						<h1 className="text-2xl sm:text-3xl font-black text-on-surface">
							Clans Achilléa
						</h1>
					</div>
					<p className="text-sm text-on-surface-variant">
						Rejoins une équipe compétitive, progresse ensemble et gagne des points de clan.
					</p>
				</div>

				<Button asChild className="rounded-xl font-bold text-xs gap-1.5 shadow-md self-start md:self-auto">
					<Link href="/achillea/clans/create">
						<Plus className="size-4" />
						Créer mon clan
					</Link>
				</Button>
			</div>

			{/* Filters toolbar */}
			<div className="p-4 rounded-2xl border border-outline/20 bg-surface/80 backdrop-blur-md space-y-4">
				<div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
					{/* Search input */}
					<div className="relative sm:col-span-2">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-on-surface-variant" />
						<input
							type="search"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Rechercher par nom ou tag (ex. RG, Inazuma)..."
							className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-outline/25 bg-surface-variant/30 text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary"
						/>
					</div>

					{/* Langue */}
					<div>
						<select
							value={selectedLanguage}
							onChange={(e) => setSelectedLanguage(e.target.value)}
							className="w-full px-3 py-2 text-sm rounded-xl border border-outline/25 bg-surface-variant/30 text-on-surface focus:outline-none focus:border-primary"
						>
							<option value="all">Toutes les langues</option>
							<option value="fr">Français</option>
							<option value="en">Anglais</option>
							<option value="de">Allemand</option>
							<option value="it">Italien</option>
							<option value="es">Espagnol</option>
							<option value="jp">Japonais</option>
						</select>
					</div>

					{/* Tri */}
					<div className="flex gap-2">
						<select
							value={sortBy}
							onChange={(e) => setSortBy(e.target.value as any)}
							className="flex-1 px-3 py-2 text-sm rounded-xl border border-outline/25 bg-surface-variant/30 text-on-surface focus:outline-none focus:border-primary"
						>
							<option value="level">Niveau & XP</option>
							<option value="fame">Notoriété</option>
							<option value="date">Date de création</option>
						</select>
						<Button
							variant="outline"
							size="icon"
							onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
							className="shrink-0 rounded-xl"
							title={sortOrder === "asc" ? "Croissant" : "Décroissant"}
						>
							<ArrowUpDown className="size-4" />
						</Button>
					</div>
				</div>

				{/* Checkbox filters */}
				<div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-on-surface-variant">
					<label className="flex items-center gap-2 cursor-pointer select-none">
						<input
							type="checkbox"
							checked={onlyRecruiting}
							onChange={(e) => setOnlyRecruiting(e.target.checked)}
							className="rounded text-primary focus:ring-primary size-4"
						/>
						<span>Recrutement ouvert uniquement</span>
					</label>

					<label className="flex items-center gap-2 cursor-pointer select-none">
						<input
							type="checkbox"
							checked={onlyAutoAccept}
							onChange={(e) => setOnlyAutoAccept(e.target.checked)}
							className="rounded text-primary focus:ring-primary size-4"
						/>
						<span>Acceptation automatique</span>
					</label>

					<span className="ml-auto font-mono text-xs opacity-70">
						{filteredClans.length} clan{filteredClans.length > 1 ? "s" : ""} trouvé
						{filteredClans.length > 1 ? "s" : ""}
					</span>
				</div>
			</div>

			{/* Clans grid */}
			{loading ? (
				<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
					{[1, 2, 3, 4, 5, 6].map((i) => (
						<Skeleton key={i} className="h-36 rounded-2xl w-full" />
					))}
				</div>
			) : filteredClans.length === 0 ? (
				<div className="text-center py-16 border border-dashed border-outline/30 rounded-3xl p-8 space-y-3">
					<Users className="size-12 mx-auto text-on-surface-variant opacity-40" />
					<h3 className="text-lg font-bold text-on-surface">Aucun clan ne correspond</h3>
					<p className="text-sm text-on-surface-variant max-w-sm mx-auto">
						Modifie tes critères de recherche ou sois le premier à fonder ton clan !
					</p>
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							setQuery("");
							setOnlyRecruiting(false);
							setOnlyAutoAccept(false);
							setSelectedLanguage("all");
						}}
					>
						Réinitialiser les filtres
					</Button>
				</div>
			) : (
				<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
					{filteredClans.map((clan) => (
						<ClanCard key={clan.id} clan={clan} />
					))}
				</div>
			)}
		</div>
	);
}
