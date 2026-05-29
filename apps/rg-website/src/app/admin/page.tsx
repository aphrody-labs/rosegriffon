import {
	Activity,
	BookOpen,
	Calendar,
	CalendarClock,
	Eye,
	FileText,
	Heart,
	LayoutDashboard,
	MonitorSmartphone,
	UserPlus,
	Users,
} from "lucide-react";

import {
	AdminPageHeader,
	DashboardGrid,
	RecentListCard,
	DashboardStatsCard as StatsCard,
} from "@rose-griffon/ui";
import { createAdminClient } from "@/lib/supabase/server";

import { QuickActions } from "./_components/quick-actions";
import { SignupsChart } from './_components/signups-chart';
import type { SignupPoint } from './_components/signups-chart';

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
		if (!row.created_at) {continue;}
		const key = row.created_at.slice(0, 10);
		if (buckets.has(key)) {buckets.set(key, (buckets.get(key) ?? 0) + 1);}
	}
	return Array.from(buckets, ([date, count]) => ({ count, date }));
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

			<DashboardGrid title="Indicateurs clés">
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
			</DashboardGrid>

			<DashboardGrid title="Contenu">
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
			</DashboardGrid>

			<SignupsChart data={signupsTimeline} />

			<section
				aria-labelledby="recent-title"
				className="grid gap-6 lg:grid-cols-3"
			>
				<h2 id="recent-title" className="sr-only">
					Activité récente
				</h2>
				<RecentListCard
					title="Utilisateurs récents"
					href="/admin/users"
					icon={UserPlus}
					accent="bg-sky-500/10 text-sky-600"
					items={(recentUsersRes.data ?? []).map((u) => ({
						date: u.created_at || undefined,
						id: u.id,
						subtitle: u.role || "Utilisateur",
						title: u.full_name || u.username || "Sans nom",
					}))}
				/>
				<RecentListCard
					title="Articles récents"
					href="/admin/chroniques"
					icon={FileText}
					accent="bg-violet-500/10 text-violet-600"
					items={(recentArticlesRes.data ?? []).map((a) => ({
						date: (a.published_at || a.updated_at) ?? undefined,
						id: a.id,
						meta:
							typeof a.view_count === "number" ? (
								<span className="flex items-center gap-1">
									<Eye className="size-3" aria-hidden="true" />
									{a.view_count}
								</span>
							) : undefined,
						status: a.status !== "published" ? "Brouillon" : undefined,
						title: a.title,
					}))}
				/>
				<RecentListCard
					title="Événements à venir"
					href="/admin/events"
					icon={Calendar}
					accent="bg-amber-500/10 text-amber-600"
					items={(upcomingEventsListRes.data ?? []).map((e) => ({
						date: e.start_time,
						id: e.id,
						subtitle: e.location || "Lieu non précisé",
						title: e.title,
					}))}
				/>
			</section>

			<QuickActions />
		</div>
	);
}
