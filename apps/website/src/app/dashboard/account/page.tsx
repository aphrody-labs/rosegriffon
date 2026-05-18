import { Button } from "@rose-griffon/ui";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getServerSession, getServerUser } from "@/lib/auth-helpers";
import { createAdminClient, createClient } from "@/lib/supabase/server";

import { AddressSection } from "./sections/address-section";
import { AccountTabs, type AccountTabValue } from "./sections/account-tabs";
import {
	ConnectionsSection,
	type LinkedAccount,
} from "./sections/connections-section";
import { ProfileSection } from "./sections/profile-section";
import { SecuritySection, type SessionItem } from "./sections/security-section";

export const dynamic = "force-dynamic";

const VALID_TABS: readonly AccountTabValue[] = [
	"profile",
	"address",
	"connections",
	"security",
];

export default async function AccountPage({
	searchParams,
}: {
	searchParams: Promise<{ tab?: string }>;
}) {
	const user = await getServerUser();
	if (!user) redirect("/login");

	const { tab: rawTab } = await searchParams;
	const initialTab: AccountTabValue = (
		VALID_TABS as readonly string[]
	).includes(rawTab ?? "")
		? (rawTab as AccountTabValue)
		: "profile";

	const supabase = await createClient();
	const { data: profile } = await supabase
		.from("profiles")
		.select("*")
		.eq("id", user.id)
		.single();

	const admin = createAdminClient();
	const accountsRes = admin
		? await admin
				.from("account")
				.select("provider_id, created_at, scope")
				.eq("user_id", user.id)
		: { data: null };
	const accounts: LinkedAccount[] = (accountsRes.data ?? []).map((row) => {
		const r = row as {
			provider_id: string;
			created_at: string;
			scope: string | null;
		};
		return {
			provider: r.provider_id,
			createdAt: r.created_at,
			scope: r.scope,
		};
	});

	const session = await getServerSession();
	const currentSessionId = session?.session?.id ?? null;
	const sessionsRaw = admin
		? await admin
				.from("session")
				.select("id, created_at, expires_at, ip_address, user_agent")
				.eq("user_id", user.id)
				.order("created_at", { ascending: false })
		: { data: null };
	const sessions: SessionItem[] = (sessionsRaw.data ?? []).map((row) => {
		const r = row as {
			id: string;
			created_at: string;
			expires_at: string;
			ip_address: string | null;
			user_agent: string | null;
		};
		return {
			id: r.id,
			currentSessionId: r.id === currentSessionId,
			createdAt: r.created_at,
			expiresAt: r.expires_at,
			ipAddress: r.ip_address,
			userAgent: r.user_agent,
		};
	});

	void auth;

	const profileTyped = profile as { username?: string } | null;
	const backHref = profileTyped?.username
		? `/profil/${profileTyped.username}`
		: "/";

	return (
		<main className="min-h-screen bg-muted/30">
			<div className="container mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
				<nav aria-label="Retour" className="mb-4">
					<Button variant="ghost" size="sm" asChild className="-ml-2">
						<Link href={backHref}>
							<ArrowLeft className="mr-2 size-4" aria-hidden="true" />
							Retour à mon profil
						</Link>
					</Button>
				</nav>

				<header className="mb-6 space-y-1">
					<h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
						Paramètres du compte
					</h1>
					<p className="text-sm text-muted-foreground">
						Connecté en tant que{" "}
						<span className="font-medium text-foreground">{user.email}</span>
					</p>
				</header>

				<AccountTabs
					initial={initialTab}
					profile={<ProfileSection profile={profile} />}
					address={<AddressSection profile={profile} />}
					connections={<ConnectionsSection accounts={accounts} />}
					security={<SecuritySection sessions={sessions} />}
				/>
			</div>
		</main>
	);
}