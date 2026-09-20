import { Badge, Button, Input } from "@rosegriffon/ui";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Search, ShieldCheck, Zap } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { WikiPagination } from "@/components/shared/WikiPagination";
import { getPgPool } from "@/lib/db/pg";
import { cn } from "@/lib/utils";

interface DiscordMember {
	discord_id: string;
	username: string;
	display_name: string | null;
	nickname: string | null;
	avatar_url: string | null;
	joined_at: string | null;
	premium_since: string | null;
	roles: string[];
	is_bot: boolean | null;
	updated_at: string | null;
}

interface DiscordRoleRow {
	role_id: string;
	position: number | null;
}

const MEDAILLE_ROLE_ID = "1364903623783612498";
const ADMIN_ROLE_ID = "1072993826400124958";
const VICE_ADMIN_ROLE_ID = "1371547071362105374";
const MOD_RESP_ROLE_ID = "1267847004919300096";
const ITEMS_PER_PAGE = 24;

function MemberCard({ member }: { member: DiscordMember }) {
	const isMedaille = member.roles?.includes(MEDAILLE_ROLE_ID);
	const isBooster = Boolean(member.premium_since);
	const displayName = member.nickname || member.display_name || member.username;

	return (
		<div
			className={cn(
				"flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-colors",
				isMedaille
					? "border-primary/40 bg-surface-container"
					: "border-outline-variant/15 bg-surface-container-low hover:bg-surface-container"
			)}
		>
			<div className="relative size-14 overflow-hidden rounded-full border border-outline-variant/30">
				<Image
					src={member.avatar_url || "/default-avatar.webp"}
					alt={member.username}
					fill
					sizes="56px"
					className="object-cover"
				/>
			</div>
			<div className="w-full">
				<div className="flex items-center justify-center gap-1">
					<h3
						className="max-w-[9rem] truncate text-sm font-semibold text-on-surface"
						title={displayName}
					>
						{displayName}
					</h3>
					{isMedaille && (
						<span title="Équipe Azalée">
							<ShieldCheck className="size-3.5 text-primary" />
						</span>
					)}
					{isBooster && (
						<span title="Booster">
							<Zap className="size-3.5 fill-secondary text-secondary" />
						</span>
					)}
				</div>
				<p className="truncate text-xs text-on-surface-variant/70">@{member.username}</p>
			</div>
			{member.joined_at && (
				<span className="text-[10px] text-on-surface-variant/50">
					Depuis {formatDistanceToNow(new Date(member.joined_at), { locale: fr })}
				</span>
			)}
		</div>
	);
}

/**
 * Annuaire des membres du Discord.
 *
 * Les quatre sections dérivées (admins, modération, équipe Azalée, boosters)
 * ont disparu : elles répétaient les mêmes cartes trois écrans plus haut que la
 * liste complète, qui est DÉJÀ triée par rang. Un badge sur la carte dit la
 * même chose sans tripler la hauteur de la page.
 */
export async function MembersDirectory({
	query,
	currentPage,
}: {
	query: string;
	currentPage: number;
}) {
	const pool = getPgPool();

	const roleMap = new Map<string, number>([
		[ADMIN_ROLE_ID, 10_000],
		[VICE_ADMIN_ROLE_ID, 9000],
		[MOD_RESP_ROLE_ID, 8000],
		[MEDAILLE_ROLE_ID, 5000],
	]);

	try {
		const { rows } = await pool.query<DiscordRoleRow>("SELECT role_id, position FROM discord_roles");
		for (const role of rows) {
			roleMap.set(role.role_id, role.position ?? 0);
		}
	} catch (error) {
		console.error("Error fetching discord_roles:", error);
	}

	const conditions = ["is_bot = false"];
	const params: unknown[] = [];
	if (query) {
		params.push(`%${query}%`);
		conditions.push(
			`(username ILIKE $${params.length} OR display_name ILIKE $${params.length} OR nickname ILIKE $${params.length})`
		);
	}

	let members: DiscordMember[] = [];
	try {
		const { rows } = await pool.query<DiscordMember>(
			`SELECT * FROM discord_members WHERE ${conditions.join(" AND ")}`,
			params
		);
		members = rows;
	} catch (error) {
		console.error("Error fetching discord_members:", error);
	}

	const rang = (m: DiscordMember) =>
		m.roles?.length ? Math.max(...m.roles.map((r) => roleMap.get(r) || 0)) : 0;

	members.sort((a, b) => {
		const diff = rang(b) - rang(a);
		return diff === 0
			? new Date(b.joined_at || 0).getTime() - new Date(a.joined_at || 0).getTime()
			: diff;
	});

	const page = members.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

	return (
		<div className="flex flex-col gap-4">
			<form action="/community" className="relative max-w-md">
				<input type="hidden" name="vue" value="membres" />
				<Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-on-surface-variant/50" />
				<Input
					name="q"
					defaultValue={query}
					placeholder="Chercher un membre"
					className="h-10 rounded-full pl-9"
				/>
			</form>

			{page.length > 0 ? (
				<>
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
						{page.map((member) => (
							<MemberCard key={member.discord_id} member={member} />
						))}
					</div>
					<WikiPagination
						totalItems={members.length}
						itemsPerPage={ITEMS_PER_PAGE}
						currentPage={currentPage}
					/>
				</>
			) : (
				<div className="rounded-2xl border border-dashed border-outline-variant/30 py-16 text-center">
					<p className="text-on-surface-variant">Aucun membre trouvé.</p>
					<Button variant="link" asChild className="text-primary">
						<Link href="/community?vue=membres">Voir tous les membres</Link>
					</Button>
				</div>
			)}
		</div>
	);
}
