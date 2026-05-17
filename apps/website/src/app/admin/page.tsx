import {
	Activity,
	BookOpen,
	CalendarClock,
	FileText,
	Heart,
	LayoutDashboard,
	MonitorSmartphone,
	Users,
} from "lucide-react";

import { StatsCard } from "@/components/admin/dashboard/stats-card";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { createAdminClient } from "@/lib/supabase/server";

import { QuickActions } from "./_components/quick-actions";
import { RecentArticles } from "./_components/recent-articles";
import { RecentUsers } from "./_components/recent-users";
import { SignupsChart, type SignupPoint } from "./_components/signups-chart";
import { UpcomingEvents } from "./_components/upcoming-events";

function buildDailySignups(
	rows: { created_at: string | null }[],
): SignupPoint[] {
	const today = new Date();
	today.setUTCHours(0, 0, 0, 0);
	const buckets = new Map<string, number>();
	for (let i = 29; i >= 0; i--) {
		const d = new Date(today);
		d.setUTCDate(d.getUTCDate() - i);
		buckets.set(d.toISOString().slice(0, 10), 0);
	}
	for (const row of rows) {
		if (!row.created_at) continue;
		const key = row.created_at.slice(0, 10);
		if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
	}
	return Array.from(buckets, ([date, count]) => ({ date, count }));
}

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
	const supabase = createAdminClient();
	if (!supabase) {
		return (
			<div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
				<AdminPageHeader
					icon={<LayoutDashboard className="size-5" />}
					title="Tableau de bord"
					description="Service Supabase indisponible."
				/>
			</div>
		);
	}

	const now = new Date();
	const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
	const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
	const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
	const nowIso = now.toISOString();

	const [
		usersCountRes,
		newUsersTodayRes,
		newUsersWeekRes,
		articlesCountRes,
		draftsCountRes,
		eventsCountRes,
		upcomingEventsCountRes,
		activeSessionsRes,
		patreonLinkedRes,
		recentUsersRes,
		recentArticlesRes,
		upcomingEventsListRes,
		signupsTimelineRes,
	] = await Promise.all([
		supabase.from("profiles").select("*", { count: "exact", head: true }),
		supabase
			.from("profiles")
			.select("*", { count: "exact", head: true })
			.gt("created_at", oneDayAgo.toISOString()),
		supabase
			.from("profiles")
			.select("*", { count: "exact", head: true })
			.gt("created_at", sevenDaysAgo.toISOString()),
		supabase
			.from("articles")
			.select("*", { count: "exact", head: true })
			.eq("status", "published"),
		supabase
			.from("articles")
			.select("*", { count: "exact", head: true })
			.neq("status", "published"),
		supabase.from("events").select("*", { count: "exact", head: true }),
		supabase
			.from("events")
			.select("*", { count: "exact", head: true })
			.gt("start_time", nowIso),
		supabase
			.from("session")
			.select("id", { count: "exact", head: true })
			.gt("expires_at", nowIso),
		supabase
			.from("account")
			.select("user_id", { count: "exact", head: true })
			.eq("provider_id", "patreon"),
		supabase
			.from("profiles")
			.select("id, username, full_name, avatar_url, created_at, role")
			.order("created_at", { ascending: false })
			.limit(5),
		supabase
			.from("articles")
			.select("id, title, slug, status, published_at, updated_at, view_count")
			.order("updated_at", { ascending: false })
			.limit(5),
		supabase
			.from("events")
			.select("id, title, start_time, location")
			.gt("start_time", nowIso)
			.order("start_time", { ascending: true })
			.limit(5),
		supabase
			.from("profiles")
			.select("created_at")
			.gte("created_at", thirtyDaysAgo.toISOString())
			.order("created_at", { ascending: true }),
	]);

	const usersCount = usersCountRes.count ?? 0;
	const newUsersToday = newUsersTodayRes.count ?? 0;
	const newUsersWeek = newUsersWeekRes.count ?? 0;
	const articlesCount = articlesCountRes.count ?? 0;
	const draftsCount = draftsCountRes.count ?? 0;
	const eventsCount = eventsCountRes.count ?? 0;
	const upcomingEventsCount = upcomingEventsCountRes.count ?? 0;
	const activeSessions = activeSessionsRes.count ?? 0;
	const patreonLinked = patreonLinkedRes.count ?? 0;
	const signupsTimeline = buildDailySignups(signupsTimelineRes.data ?? []);

	return (
		<div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
			<AdminPageHeader
				icon={<LayoutDashboard className="size-5" />}
				title="Tableau de bord"
				description="Vue d'ensemble de l'activité de Rose Griffon."
			/>

			<section aria-labelledby="kpis-title" className="space-y-3">
				<h2
					id="kpis-title"
					className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
				>
					Indicateurs clés
				</h2>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<StatsCard
						title="Utilisateurs"
						value={usersCount}
						description={`+${newUsersWeek} sur 7 jours`}
						icon={Users}
						href="/admin/users"
						accent="sky"
					/>
					<StatsCard
						title="Inscriptions 24h"
						value={newUsersToday}
						description="Nouveaux comptes du jour"
						icon={Activity}
						accent="emerald"
					/>
					<StatsCard
						title="Sessions actives"
						value={activeSessions}
						description="Connexions en cours"
						icon={MonitorSmartphone}
						accent="primary"
					/>
					<StatsCard
						title="Patreon liés"
						value={patreonLinked}
						description="Comptes connectés"
						icon={Heart}
						href="/admin/patreon"
						accent="rose"
					/>
				</div>
			</section>

			<section aria-labelledby="content-stats-title" className="space-y-3">
				<h2
					id="content-stats-title"
					className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
				>
					Contenu
				</h2>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<StatsCard
						title="Articles publiés"
						value={articlesCount}
						description="Visibles par les visiteurs"
						icon={BookOpen}
						href="/admin/chroniques"
						accent="violet"
					/>
					<StatsCard
						title="Brouillons"
						value={draftsCount}
						description="En attente de publication"
						icon={FileText}
						href="/admin/chroniques?status=draft"
						accent="amber"
					/>
					<StatsCard
						title="Événements"
						value={eventsCount}
						description="Total créés"
						icon={CalendarClock}
						href="/admin/events"
						accent="amber"
					/>
					<StatsCard
						title="À venir"
						value={upcomingEventsCount}
						description="Événements futurs"
						icon={CalendarClock}
						href="/admin/events"
						accent="emerald"
					/>
				</div>
			</section>

			<SignupsChart data={signupsTimeline} />

			<section
				aria-labelledby="recent-title"
				className="grid gap-6 lg:grid-cols-3"
			>
				<h2 id="recent-title" className="sr-only">
					Activité récente
				</h2>
				<RecentUsers users={recentUsersRes.data ?? []} />
				<RecentArticles articles={recentArticlesRes.data ?? []} />
				<UpcomingEvents events={upcomingEventsListRes.data ?? []} />
			</section>

			<QuickActions />
		</div>
	);
}
