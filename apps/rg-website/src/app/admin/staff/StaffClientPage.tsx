"use client";

import {
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	DashboardStatsCard as StatsCard,
	AdminPageHeader,
} from "@rose-griffon/ui";
import {
	ArrowDownAZ,
	ArrowUp01,
	Check,
	Edit,
	EyeOff,
	LayoutGrid,
	List,
	Plus,
	RotateCcw,
	Search,
	Trash2,
	Users as UsersIcon,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmationDialog } from "@/components/admin/confirmation-dialog";
import { AdminDataGrid } from "@/components/admin/shared/AdminDataGrid";

import { deleteTeamMember, updateTeamMember } from "./actions";
import type { TeamMember } from "./actions";
import { StaffMemberCard } from "./StaffMemberCard";
import { TeamMemberDialog } from "./TeamMemberDialog";

const TEAM_LABELS: Record<string, string> = {
	achilleateam: "Équipe Achilléa",
	assoteam: "Membres de l'Association",
	azaleeteam: "Équipe Azalée",
	bureauteam: "Bureau de l'Association",
	collabteam: "Partenaires & Collaborateurs",
	dessinateurteam: "Équipe Dessinateur",
	loreteam: "Équipe Lore",
	mediationteam: "Cellule de Médiation",
	productionteam: "Équipe Production",
	socialteam: "Équipe Réseaux",
};

interface StaffClientPageProps {
	initialMembers: TeamMember[];
}

export function StaffClientPage({ initialMembers }: StaffClientPageProps) {
	const router = useRouter();
	const [members, setMembers] = useState<TeamMember[]>(initialMembers);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [selectedMember, setSelectedMember] = useState<TeamMember | undefined>();
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedTeam, setSelectedTeam] = useState<string>("all");
	const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
	const [sortMode, setSortMode] = useState<"order" | "name">("order");
	const [deleteConfirmation, setDeleteConfirmation] = useState<{
		open: boolean;
		member?: TeamMember;
	}>({ open: false });

	useEffect(() => {
		setMembers(initialMembers);
	}, [initialMembers]);

	const handleAdd = () => {
		setSelectedMember(undefined);
		setDialogOpen(true);
	};

	const handleEdit = (member: TeamMember) => {
		setSelectedMember(member);
		setDialogOpen(true);
	};

	const confirmDelete = (member: TeamMember) => {
		setDeleteConfirmation({ member, open: true });
	};

	const handleDelete = async () => {
		if (!deleteConfirmation.member) {
			return;
		}
		const { member } = deleteConfirmation;

		const { error } = await deleteTeamMember(member.id);
		if (error) {
			toast.error("Erreur lors de la suppression", { description: error });
		} else {
			toast.success("Membre supprimé avec succès");
			// Optimistic update
			setMembers((prev) => prev.filter((m) => m.id !== member.id));
			router.refresh();
		}
		setDeleteConfirmation({ open: false });
	};

	const handleSetActive = async (member: TeamMember, isActive: boolean) => {
		const { error } = await updateTeamMember(member.id, {
			is_active: isActive,
		});
		if (error) {
			toast.error(isActive ? "Erreur lors de la réactivation" : "Erreur lors de la désactivation", {
				description: error,
			});
			return;
		}
		toast.success(isActive ? "Membre réactivé" : "Membre désactivé");
		setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, is_active: isActive } : m)));
		router.refresh();
	};

	const handleApprove = (member: TeamMember) => handleSetActive(member, true);
	const handleDeactivate = (member: TeamMember) => handleSetActive(member, false);

	const handleSuccess = () => {
		router.refresh();
	};

	// Distingue les imports Discord à valider (source='discord-sync')
	// Des staff désactivés volontairement (autres `is_active=false`).
	const inactiveMembers = members.filter((m) => m.is_active === false);
	const pendingMembers = inactiveMembers.filter((m) => m.source === "discord-sync");
	const deactivatedMembers = inactiveMembers.filter((m) => m.source !== "discord-sync");

	// Filtrer les membres actifs.
	const q = searchQuery.toLowerCase().trim();
	const activeMembers = members.filter((m) => {
		if (m.is_active === false) {
			return false;
		}
		const matchesSearch =
			!q ||
			m.name.toLowerCase().includes(q) ||
			m.role.toLowerCase().includes(q) ||
			(m.discord_user_id ?? "").toLowerCase().includes(q);
		const matchesTeam = selectedTeam === "all" || m.team_id === selectedTeam;
		return matchesSearch && matchesTeam;
	});

	// Grouper par équipe.
	const membersByTeam = activeMembers.reduce(
		(acc, member) => {
			if (!acc[member.team_id]) {
				acc[member.team_id] = [];
			}
			acc[member.team_id]?.push(member);
			return acc;
		},
		{} as Record<string, TeamMember[]>
	);

	const sortMembers = (list: TeamMember[]) =>
		[...list].toSorted((a, b) =>
			sortMode === "name"
				? a.name.localeCompare(b.name, "fr")
				: (a.display_index ?? 999) - (b.display_index ?? 999)
		);

	const populatedTeamsCount = new Set(
		members.filter((m) => m.is_active !== false).map((m) => m.team_id)
	).size;

	return (
		<div className="space-y-8">
			<AdminPageHeader
				icon={<UsersIcon className="size-5" />}
				title="Gestion du Staff"
				description="Gérez les membres de toutes les équipes Rose Griffon"
				actions={
					<Button onClick={handleAdd}>
						<Plus className="mr-2 size-4" />
						Ajouter un membre
					</Button>
				}
			/>

			{/* Stats rapides */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<StatsCard
					title="Actifs"
					value={members.filter((m) => m.is_active !== false).length}
					icon={UsersIcon}
					accent="emerald"
				/>
				<StatsCard title="À valider" value={pendingMembers.length} icon={Check} accent="amber" />
				<StatsCard
					title="Désactivés"
					value={deactivatedMembers.length}
					icon={EyeOff}
					accent="rose"
				/>
				<StatsCard
					title="Équipes"
					value={`${populatedTeamsCount} / ${Object.keys(TEAM_LABELS).length}`}
					icon={LayoutGrid}
					accent="sky"
				/>
			</div>

			{/* Filtres */}
			<div className="flex flex-col sm:flex-row gap-4">
				<div className="relative flex-1">
					<Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
					<Input
						placeholder="Nom, rôle, ID Discord…"
						className="pl-9"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
				</div>
				<Select value={selectedTeam} onValueChange={setSelectedTeam}>
					<SelectTrigger className="w-full sm:w-[250px]">
						<SelectValue placeholder="Toutes les équipes" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">Toutes les équipes</SelectItem>
						{Object.entries(TEAM_LABELS).map(([value, label]) => (
							<SelectItem key={value} value={value}>
								{label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<div className="flex items-center border rounded-md overflow-hidden bg-background">
					<Button
						variant="ghost"
						size="icon"
						title={
							sortMode === "order"
								? "Tri par ordre (cliquer pour A-Z)"
								: "Tri A-Z (cliquer pour ordre)"
						}
						className="rounded-none size-10"
						onClick={() => setSortMode((s) => (s === "order" ? "name" : "order"))}
					>
						{sortMode === "order" ? (
							<ArrowUp01 className="size-4" />
						) : (
							<ArrowDownAZ className="size-4" />
						)}
					</Button>
					<div className="w-[1px] h-6 bg-border" />
					<Button
						variant="ghost"
						size="icon"
						title="Vue liste"
						className={`rounded-none size-10 ${viewMode === "list" ? "bg-muted" : ""}`}
						onClick={() => setViewMode("list")}
					>
						<List className="size-4" />
					</Button>
					<div className="w-[1px] h-6 bg-border" />
					<Button
						variant="ghost"
						size="icon"
						title="Vue grille"
						className={`rounded-none size-10 ${viewMode === "grid" ? "bg-muted" : ""}`}
						onClick={() => setViewMode("grid")}
					>
						<LayoutGrid className="size-4" />
					</Button>
				</div>
			</div>

			{/* Imports Discord à valider */}
			{pendingMembers.length > 0 && (
				<AdminDataGrid
					title={`Imports Discord à valider (${pendingMembers.length})`}
					data={sortMembers(pendingMembers)}
					columns={[
						{
							cell: (member) => (
								<div className="relative size-10 rounded-full overflow-hidden bg-muted">
									{member.image_url ? (
										<Image src={member.image_url} alt={member.name} fill className="object-cover" />
									) : (
										<div className="w-full h-full flex items-center justify-center text-muted-foreground">
											<UsersIcon className="size-5" />
										</div>
									)}
								</div>
							),
							className: "w-[60px]",
							header: "Photo",
						},
						{
							accessorKey: "name",
							className: "font-medium",
							header: "Nom",
						},
						{
							accessorKey: "role",
							header: "Rôle détecté",
						},
						{
							cell: (member) => TEAM_LABELS[member.team_id] || member.team_id,
							header: "Équipe suggérée",
						},
						{
							cell: (member) => (
								<div className="flex justify-end gap-2">
									<Button
										variant="outline"
										size="sm"
										className="text-green-600 border-green-200 hover:bg-green-50"
										onClick={() => handleApprove(member)}
									>
										<Check className="size-4 mr-1" />
										Valider
									</Button>
									<Button variant="ghost" size="icon" onClick={() => handleEdit(member)}>
										<Edit className="size-4" />
									</Button>
									<Button variant="ghost" size="icon" onClick={() => confirmDelete(member)}>
										<Trash2 className="size-4 text-red-500" />
									</Button>
								</div>
							),
							className: "text-right w-[180px]",
							header: "Actions",
						},
					]}
				/>
			)}

			{/* Liste par équipe */}
			{Object.keys(membersByTeam).length === 0 && pendingMembers.length === 0 ? (
				<Card>
					<CardContent className="py-12 text-center">
						<UsersIcon className="size-12 mx-auto mb-4 text-muted-foreground" />
						<p className="text-muted-foreground">Aucun membre pour le moment</p>
						<Button onClick={handleAdd} className="mt-4">
							<Plus className="size-4 mr-2" />
							Ajouter le premier membre
						</Button>
					</CardContent>
				</Card>
			) : (
				viewMode === "list" &&
				Object.entries(membersByTeam)
					.toSorted((a, b) =>
						(TEAM_LABELS[a[0]] || a[0]).localeCompare(TEAM_LABELS[b[0]] || b[0], "fr")
					)
					.map(([teamId, teamMembers]) => (
						<AdminDataGrid
							key={teamId}
							title={`${TEAM_LABELS[teamId] || teamId} (${teamMembers.length})`}
							data={sortMembers(teamMembers)}
							columns={[
								{
									cell: (member) => (
										<div className="relative size-10 rounded-full overflow-hidden bg-muted">
											{member.image_url ? (
												<Image
													src={member.image_url}
													alt={member.name}
													fill
													className="object-cover"
												/>
											) : (
												<div className="w-full h-full flex items-center justify-center text-muted-foreground">
													<UsersIcon className="size-5" />
												</div>
											)}
										</div>
									),
									className: "w-[60px]",
									header: "Photo",
								},
								{
									accessorKey: "name",
									className: "font-medium",
									header: "Nom",
								},
								{
									accessorKey: "role",
									header: "Rôle",
								},
								{
									cell: (member) =>
										member.discord_user_id ? (
											<a
												href={`https://discord.com/users/${member.discord_user_id}`}
												target="_blank"
												rel="noopener noreferrer"
												className="text-xs text-indigo-600 hover:underline font-mono dark:text-indigo-400"
												title="Ouvrir le profil Discord"
											>
												{member.discord_user_id}
											</a>
										) : (
											<span className="text-xs text-muted-foreground">—</span>
										),
									className: "hidden md:table-cell",
									header: "Discord",
								},
								{
									accessorKey: "display_index",
									cell: (member) => member.display_index ?? "-",
									className: "w-[80px]",
									header: "Ordre",
								},
								{
									cell: (member) => (
										<div className="flex justify-end gap-1">
											<Button
												variant="ghost"
												size="icon"
												title="Modifier"
												onClick={() => handleEdit(member)}
											>
												<Edit className="size-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												title="Désactiver"
												onClick={() => handleDeactivate(member)}
											>
												<EyeOff className="size-4 text-orange-500" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												title="Supprimer"
												onClick={() => confirmDelete(member)}
											>
												<Trash2 className="size-4 text-red-500" />
											</Button>
										</div>
									),
									className: "text-right w-[140px]",
									header: "Actions",
								},
							]}
						/>
					))
			)}

			{/* Désactivés */}
			{deactivatedMembers.length > 0 && (
				<AdminDataGrid
					title={`Désactivés (${deactivatedMembers.length})`}
					data={sortMembers(deactivatedMembers)}
					columns={[
						{
							cell: (member) => (
								<div className="relative size-10 rounded-full overflow-hidden bg-muted opacity-60">
									{member.image_url ? (
										<Image src={member.image_url} alt={member.name} fill className="object-cover" />
									) : (
										<div className="w-full h-full flex items-center justify-center text-muted-foreground">
											<UsersIcon className="size-5" />
										</div>
									)}
								</div>
							),
							className: "w-[60px]",
							header: "Photo",
						},
						{
							accessorKey: "name",
							className: "font-medium text-muted-foreground",
							header: "Nom",
						},
						{ accessorKey: "role", header: "Rôle" },
						{
							cell: (member) => TEAM_LABELS[member.team_id] || member.team_id,
							header: "Équipe",
						},
						{
							cell: (member) => (
								<div className="flex justify-end gap-1">
									<Button
										variant="outline"
										size="sm"
										title="Réactiver"
										onClick={() => handleApprove(member)}
									>
										<RotateCcw className="size-4 mr-1" />
										Réactiver
									</Button>
									<Button
										variant="ghost"
										size="icon"
										title="Supprimer"
										onClick={() => confirmDelete(member)}
									>
										<Trash2 className="size-4 text-red-500" />
									</Button>
								</div>
							),
							className: "text-right w-[180px]",
							header: "Actions",
						},
					]}
				/>
			)}

			{/* Grid View Implementation */}
			{viewMode === "grid" &&
				Object.entries(membersByTeam)
					.toSorted((a, b) =>
						(TEAM_LABELS[a[0]] || a[0]).localeCompare(TEAM_LABELS[b[0]] || b[0], "fr")
					)
					.map(([teamId, teamMembers]) => (
						<Card key={teamId} className="bg-transparent border-none shadow-none">
							<CardHeader className="px-0 pt-6">
								<CardTitle className="text-xl flex items-center gap-2">
									{TEAM_LABELS[teamId] || teamId}
									<span className="text-sm font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
										{teamMembers.length}
									</span>
								</CardTitle>
							</CardHeader>
							<CardContent className="px-0">
								<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
									{sortMembers(teamMembers).map((member) => (
										<StaffMemberCard
											key={member.id}
											member={member}
											teamLabel={TEAM_LABELS[teamId] || teamId}
											onEdit={handleEdit}
											onDelete={confirmDelete}
											onDeactivate={handleDeactivate}
										/>
									))}
								</div>
							</CardContent>
						</Card>
					))}

			<TeamMemberDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				member={selectedMember}
				onSuccess={handleSuccess}
			/>

			<ConfirmationDialog
				open={deleteConfirmation.open}
				onCancel={() => setDeleteConfirmation({ open: false })}
				title="Supprimer un membre"
				message={`Êtes-vous sûr de vouloir supprimer ${deleteConfirmation.member?.name} ?`}
				confirmText="Supprimer"
				danger
				onConfirm={handleDelete}
			/>
		</div>
	);
}
