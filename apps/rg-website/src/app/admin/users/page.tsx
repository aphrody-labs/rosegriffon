import { Users } from "lucide-react";

import { AdminPageHeader } from "@rose-griffon/ui";
import { PaginationControls } from "@rose-griffon/ui";
import { createAdminClient } from "@/lib/supabase/server";

import { UserStats } from "./user-stats";
import { UsersTable } from "./users-table";

export const dynamic = "force-dynamic";

interface UsersPageProps {
	searchParams: Promise<{
		page?: string;
		query?: string;
	}>;
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
	const params = await searchParams;
	const page = Number(params.page) || 1;
	const query = params.query || "";
	const limit = 10;
	const from = (page - 1) * limit;
	const to = from + limit - 1;

	const supabase = createAdminClient();
	if (!supabase) {
		return (
			<div className="mx-auto max-w-7xl space-y-8 px-4 py-8 lg:px-8">
				<AdminPageHeader
					icon={<Users className="size-5" />}
					title="Utilisateurs"
					description="Service Supabase indisponible."
				/>
			</div>
		);
	}

	let usersQuery = supabase
		.from("profiles")
		.select("*", { count: "exact" })
		.order("updated_at", { ascending: false })
		.range(from, to);

	if (query) {
		usersQuery = usersQuery.ilike("email", `%${query}%`);
	}

	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	const [
		{ data: profiles, error, count },
		{ count: adminCount },
		{ count: moderatorCount },
		{ count: newUsersCount },
	] = await Promise.all([
		usersQuery,
		supabase
			.from("profiles")
			.select("*", { count: "exact", head: true })
			.eq("role", "admin"),
		supabase
			.from("profiles")
			.select("*", { count: "exact", head: true })
			.eq("role", "moderator"),
		supabase
			.from("profiles")
			.select("*", { count: "exact", head: true })
			.gt("updated_at", thirtyDaysAgo.toISOString()),
	]);

	if (error) {
		console.error("Erreur chargement profiles:", error);
	}

	const users = profiles || [];
	const totalPages = count ? Math.ceil(count / limit) : 1;

	return (
		<div className="mx-auto max-w-7xl space-y-8 px-4 py-8 lg:px-8">
			<AdminPageHeader
				icon={<Users className="size-5" />}
				title="Utilisateurs"
				description={`${count ?? 0} compte${count !== 1 ? "s" : ""} sur la plateforme`}
			/>

			<UserStats
				totalUsers={count || 0}
				adminUsers={adminCount || 0}
				moderatorUsers={moderatorCount || 0}
				newUsers={newUsersCount || 0}
			/>

			<UsersTable users={users} />

			<PaginationControls
				currentPage={page}
				totalPages={totalPages}
				baseUrl="/admin/users"
			/>
		</div>
	);
}
