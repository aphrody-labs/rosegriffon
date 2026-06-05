import {
	Avatar,
	AvatarFallback,
	AvatarImage,
	Badge,
	Card,
	CardContent,
} from "@rose-griffon/ui";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
	IEVR_STEAM_APP_ID,
	type IevrPlayerAchievement,
	SteamWebApiClient,
	type SteamIevrAccount,
} from "@rose-griffon/better-auth-steam";

import { AccountSave } from "@/components/save/AccountSave";
import { Icon } from "@/components/ui/Icon";
import { requireAuth } from "@/lib/auth-helpers";

import { SteamConnectButton } from "./steam/steam-connect-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	alternates: { canonical: "/compte" },
	description:
		"Ta vue de jeu unifiée Inazuma Eleven: Victory Road — compte Steam (possession, temps de jeu, succès) et lecture de ta sauvegarde (joueur, niveau, roster résolu en noms réels). La sauvegarde reste dans ton navigateur.",
	title: "Mon compte IEVR | Azalée",
};

/**
 * Page « Mon compte IEVR » — vue de jeu UNIFIÉE combinant trois sources :
 *
 *  1. STEAM (better-auth-steam) — possession IEVR + temps de jeu + succès, résolus
 *     côté serveur via la Steam Web API (clé `STEAM_WEB_API_KEY` optionnelle).
 *  2. SAVE (wasm `nie-save`) — joueur, niveau, temps de jeu, roster complet RÉSOLU
 *     en noms réels via le miroir SQLite. La sauvegarde NE quitte JAMAIS le navigateur :
 *     seuls les IDs du roster transitent au serveur pour résolution.
 *  3. EA — note honnête : le build Steam d'IEVR n'utilise PAS EA Juno pour la
 *     progression cloud (EOS + Steam), et le flow OAuth Steam ne donne qu'un token
 *     d'identité Steam, pas de Bearer EA. Pas de fausse promesse.
 *
 * Anti-hallucination : aucune donnée inventée ; chaque section dégrade proprement
 * (Steam non lié, clé absente, profil privé, résolution échouée) sans crash.
 */
export default async function AccountPage() {
	const user = await requireAuth();
	if (!user) {
		redirect("/login?returnTo=/compte");
	}

	const steamId = (user as { steamId?: string | null }).steamId ?? null;

	// Résolution Steam server-side (seulement si lié + clé Web API présente).
	const apiKey = process.env.STEAM_WEB_API_KEY;
	let account: SteamIevrAccount | null = null;
	let apiError: string | null = null;
	if (steamId && apiKey) {
		try {
			const client = new SteamWebApiClient({ apiKey, appId: IEVR_STEAM_APP_ID });
			account = await client.getIevrAccount(steamId, "french");
		} catch (e) {
			apiError = e instanceof Error ? e.message : "Erreur Steam Web API";
		}
	}

	return (
		<main className="mx-auto w-full max-w-4xl px-4 py-10">
			<header className="mb-8">
				<h1 className="font-[BradBunR] text-2xl tracking-wide text-on-surface sm:text-3xl md:text-4xl">
					Mon compte IEVR
				</h1>
				<p className="mt-2 type-body-medium text-on-surface-variant leading-relaxed">
					Relie ton compte Steam et importe ta sauvegarde pour rassembler un maximum
					d&apos;informations sur ta partie en une seule page.
				</p>
			</header>

			{/* ─── STEAM ─────────────────────────────────────────────────────────── */}
			<section className="mb-10">
				<SectionTitle icon="bolt" label="Steam" />

				{!steamId ? (
					<Card>
						<CardContent className="flex flex-col gap-3 py-5">
							<p className="text-sm text-on-surface-variant">
								Lie ton compte Steam pour voir la possession d&apos;IEVR, ton temps de jeu et
								tes succès.
							</p>
							<div>
								<SteamConnectButton callbackURL="/compte" />
							</div>
						</CardContent>
					</Card>
				) : (
					<div className="flex flex-col gap-4">
						{!apiKey && (
							<Card>
								<CardContent className="py-4 text-sm text-on-surface-variant">
									La clé <code>STEAM_WEB_API_KEY</code> n&apos;est pas configurée : seul
									l&apos;identifiant Steam est disponible.
									<div className="mt-2 font-mono text-xs">SteamID64 : {steamId}</div>
								</CardContent>
							</Card>
						)}

						{apiError && (
							<Card className="border-error/50">
								<CardContent className="py-4 text-sm text-error">
									Impossible de joindre la Steam Web API : {apiError}
								</CardContent>
							</Card>
						)}

						{account?.summary && (
							<Card>
								<CardContent className="flex items-center gap-4 py-4">
									<Avatar className="size-16">
										<AvatarImage
											src={account.summary.avatarfull}
											alt={account.summary.personaname}
										/>
										<AvatarFallback>{account.summary.personaname.slice(0, 2)}</AvatarFallback>
									</Avatar>
									<div>
										<div className="text-lg font-semibold text-on-surface">
											{account.summary.personaname}
										</div>
										<Link
											href={account.summary.profileurl}
											target="_blank"
											rel="noopener noreferrer"
											className="text-sm text-primary underline"
										>
											Profil Steam
										</Link>
										<div className="mt-1 font-mono text-xs text-on-surface-variant">
											{steamId}
										</div>
									</div>
								</CardContent>
							</Card>
						)}

						<Card>
							<CardContent className="py-4">
								<h3 className="mb-3 text-base font-semibold text-on-surface">
									Inazuma Eleven Victory Road
								</h3>
								{account?.ievr ? (
									<div className="space-y-1 text-sm text-on-surface">
										<div className="mb-1 flex items-center gap-2">
											{account.ievr.img_icon_url && (
												<Image
													src={`https://cdn.cloudflare.steamstatic.com/steam/apps/${IEVR_STEAM_APP_ID}/${account.ievr.img_icon_url}.jpg`}
													alt="IEVR"
													width={32}
													height={32}
													className="rounded"
													unoptimized
												/>
											)}
											<Badge>Jeu possédé</Badge>
										</div>
										<div>
											Temps de jeu :{" "}
											<strong>{formatSteamPlaytime(account.ievr.playtime_forever)}</strong>
										</div>
										{account.ievr.playtime_2weeks ? (
											<div>
												2 dernières semaines :{" "}
												{formatSteamPlaytime(account.ievr.playtime_2weeks)}
											</div>
										) : null}
									</div>
								) : (
									<p className="text-sm text-on-surface-variant">
										{apiKey
											? "Jeu non détecté sur ce compte (non possédé ou profil Steam privé)."
											: "Possession indisponible sans clé Web API."}
									</p>
								)}
							</CardContent>
						</Card>

						{account?.ievr && (
							<Card>
								<CardContent className="py-4">
									<h3 className="mb-3 text-base font-semibold text-on-surface">Succès</h3>
									<p className="mb-3 text-sm text-on-surface">
										<strong>{account.achievementsUnlocked}</strong> /{" "}
										{account.achievementsTotal} débloqués
									</p>
									{account.achievementsTotal === 0 ? (
										<p className="text-sm text-on-surface-variant">
											Aucun succès disponible (profil privé ou clé publisher requise).
										</p>
									) : (
										<ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
											{account.achievements
												.slice(0, 52)
												.map((a: IevrPlayerAchievement) => (
													<li
														key={a.apiname}
														className={`text-sm ${a.achieved ? "text-on-surface" : "text-on-surface-variant line-through"}`}
													>
														{a.achieved ? "✓ " : "○ "}
														{a.displayName}
													</li>
												))}
										</ul>
									)}
								</CardContent>
							</Card>
						)}
					</div>
				)}
			</section>

			{/* ─── SAVE ──────────────────────────────────────────────────────────── */}
			<section className="mb-10">
				<SectionTitle icon="save" label="Sauvegarde" />
				<p className="mb-4 type-body-small text-on-surface-variant">
					Dépose ton fichier{" "}
					<code className="rounded bg-surface-container px-1.5 py-0.5">USERDATALIVE</code> : il est
					déchiffré et analysé <strong>entièrement dans ton navigateur</strong>. Seuls les
					identifiants du roster sont envoyés pour être résolus en noms réels — aucun octet de
					la sauvegarde ne quitte ton appareil.
				</p>
				<AccountSave />
			</section>

			{/* ─── EA (note honnête) ─────────────────────────────────────────────── */}
			<section>
				<SectionTitle icon="database" label="Progression cloud (EA)" />
				<Card>
					<CardContent className="flex items-start gap-3 py-4">
						<Icon name="build" size={20} className="mt-0.5 shrink-0 text-on-surface-variant" />
						<div className="text-sm text-on-surface-variant">
							<p>
								IEVR utilise un compte <strong>EA (Juno)</strong> pour son identité, mais la
								version Steam ne s&apos;appuie <strong>pas</strong> sur EA pour la progression
								cloud : elle utilise <strong>EOS (Epic Online Services) + Steam Cloud</strong>.
							</p>
							<p className="mt-2">
								Le flow OAuth Steam ne délivre qu&apos;un jeton d&apos;identité Steam (SteamID) —
								il ne donne aucun accès à la progression EA, qui exigerait un Bearer émis par
								les serveurs EA. La progression de jeu provient donc ici de Steam et de ta
								sauvegarde.
							</p>
						</div>
					</CardContent>
				</Card>
			</section>
		</main>
	);
}

/** Titre de section avec icône. */
function SectionTitle({ icon, label }: { icon: string; label: string }) {
	return (
		<div className="mb-3 flex items-center gap-2">
			<Icon name={icon} size={22} className="text-on-surface-variant" />
			<h2 className="text-xl font-semibold text-on-surface">{label}</h2>
		</div>
	);
}

/** Formate des minutes Steam en « Xh Ymin ». */
function formatSteamPlaytime(minutes: number): string {
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	if (h === 0) {
		return `${m} min`;
	}
	return `${h} h ${m.toString().padStart(2, "0")}`;
}
