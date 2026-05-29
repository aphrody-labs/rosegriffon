"use client";

import {
	Button,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@rose-griffon/ui";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CheckCircle2, Loader2, RefreshCw, Search, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export interface AdminLegacyMember {
	id: string;
	patreon_member_id: string;
	full_name: string | null;
	email: string | null;
	tier_titles: string[] | null;
	patron_status: string;
	currently_entitled_cents: number | null;
	lifetime_support_cents: number | null;
	last_charge_status: string | null;
	last_charge_date: string | null;
	pledge_start: string | null;
	pledge_cadence: number | null;
	rg_subscription_status: string;
	resolved_user_id: string | null;
	imported_at: string;
	discord_user_id: string | null;
}

interface Props {
	members: AdminLegacyMember[];
	tierOptions: string[];
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
	churned: {
		cls: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
		label: "Churn",
	},
	grandfathered: {
		cls: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
		label: "Grandfathered",
	},
	pending: {
		cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
		label: "En attente",
	},
	reactivated: {
		cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
		label: "Réactivé",
	},
};

function formatEur(cents: number | null): string {
	if (cents === null || cents === undefined) {
		return "—";
	}
	return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}

function formatDate(iso: string | null): string {
	if (!iso) {
		return "—";
	}
	try {
		return format(new Date(iso), "d MMM yyyy", { locale: fr });
	} catch {
		return "—";
	}
}

export function PatreonMembersTable({ members, tierOptions }: Props) {
	const [q, setQ] = useState("");
	const [status, setStatus] = useState<string>("all");
	const [tier, setTier] = useState<string>("all");
	const [busyId, setBusyId] = useState<string | null>(null);

	const filtered = useMemo(() => {
		const needle = q.trim().toLowerCase();
		return members.filter((m) => {
			if (status !== "all" && m.rg_subscription_status !== status) {
				return false;
			}
			if (tier !== "all" && !(m.tier_titles ?? []).includes(tier)) {
				return false;
			}
			if (!needle) {
				return true;
			}
			return (
				(m.full_name ?? "").toLowerCase().includes(needle) ||
				(m.email ?? "").toLowerCase().includes(needle) ||
				(m.discord_user_id ?? "").toLowerCase().includes(needle)
			);
		});
	}, [members, q, status, tier]);

	const resync = async (memberId: string, rowId: string) => {
		setBusyId(rowId);
		try {
			const res = await fetch("/api/admin/patreon/resync-member", {
				body: JSON.stringify({ memberId }),
				headers: { "content-type": "application/json" },
				method: "POST",
			});
			const json = (await res.json()) as { ok?: boolean; detail?: string };
			if (!res.ok || !json.ok) {
				toast.error(`Resync échoué : ${json.detail ?? res.status}`);
			} else {
				toast.success("Membre re-synchronisé");
				setTimeout(() => window.location.reload(), 600);
			}
		} catch (error) {
			toast.error(`Erreur : ${error instanceof Error ? error.message : String(error)}`);
		} finally {
			setBusyId(null);
		}
	};

	const setStatusOf = async (id: string, newStatus: string) => {
		setBusyId(id);
		try {
			const res = await fetch("/api/admin/patreon/grandfather", {
				body: JSON.stringify({ id, status: newStatus }),
				headers: { "content-type": "application/json" },
				method: "POST",
			});
			const json = (await res.json()) as { ok?: boolean; detail?: string };
			if (!res.ok || !json.ok) {
				toast.error(`Mise à jour échouée : ${json.detail ?? res.status}`);
			} else {
				toast.success(`Statut → ${STATUS_LABELS[newStatus]?.label ?? newStatus}`);
				setTimeout(() => window.location.reload(), 600);
			}
		} catch (error) {
			toast.error(`Erreur : ${error instanceof Error ? error.message : String(error)}`);
		} finally {
			setBusyId(null);
		}
	};

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-3 sm:flex-row">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Rechercher : nom, email, Discord ID…"
						value={q}
						onChange={(e) => setQ(e.target.value)}
						className="pl-10"
					/>
				</div>
				<Select value={status} onValueChange={setStatus}>
					<SelectTrigger className="w-full sm:w-[200px]">
						<SelectValue placeholder="Statut" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">Tous statuts</SelectItem>
						<SelectItem value="pending">En attente</SelectItem>
						<SelectItem value="reactivated">Réactivé</SelectItem>
						<SelectItem value="churned">Churn</SelectItem>
						<SelectItem value="grandfathered">Grandfathered</SelectItem>
					</SelectContent>
				</Select>
				<Select value={tier} onValueChange={setTier}>
					<SelectTrigger className="w-full sm:w-[200px]">
						<SelectValue placeholder="Tier" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">Tous tiers</SelectItem>
						{tierOptions.map((t) => (
							<SelectItem key={t} value={t}>
								{t}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="overflow-x-auto rounded-lg border border-border bg-card">
				<table className="min-w-full text-sm">
					<thead className="bg-muted/50 text-left text-muted-foreground">
						<tr>
							<th className="px-4 py-3 font-medium">Membre</th>
							<th className="px-4 py-3 font-medium">Tier</th>
							<th className="px-4 py-3 font-medium">Pledge</th>
							<th className="px-4 py-3 font-medium">LTV</th>
							<th className="px-4 py-3 font-medium">Dernier paiement</th>
							<th className="px-4 py-3 font-medium">Depuis</th>
							<th className="px-4 py-3 font-medium">Migration</th>
							<th className="px-4 py-3 text-right font-medium">Actions</th>
						</tr>
					</thead>
					<tbody>
						{filtered.map((m) => {
							const statusCfg = STATUS_LABELS[m.rg_subscription_status] ?? {
								cls: "bg-muted text-muted-foreground",
								label: m.rg_subscription_status,
							};
							const isBusy = busyId === m.id;
							return (
								<tr
									key={m.id}
									className="border-t border-border/40 transition-colors hover:bg-muted/30"
								>
									<td className="px-4 py-3">
										<div className="font-medium text-foreground">
											{m.full_name ?? "—"}
											{m.resolved_user_id && (
												<CheckCircle2 className="ml-1 inline h-3.5 w-3.5 text-emerald-500" />
											)}
										</div>
										<div className="text-xs text-muted-foreground">{m.email ?? "—"}</div>
										{m.discord_user_id && (
											<div className="text-[10px] font-mono text-muted-foreground/60">
												discord:{m.discord_user_id}
											</div>
										)}
									</td>
									<td className="px-4 py-3">
										{m.tier_titles && m.tier_titles.length > 0 ? (
											<div className="space-y-0.5">
												{m.tier_titles.map((t) => (
													<div
														key={t}
														className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs"
													>
														<Star className="size-3 text-amber-500" />
														{t}
													</div>
												))}
											</div>
										) : (
											<span className="text-muted-foreground/50">—</span>
										)}
									</td>
									<td className="px-4 py-3 font-mono tabular-nums">
										{formatEur(m.currently_entitled_cents)}
									</td>
									<td className="px-4 py-3 font-mono tabular-nums text-muted-foreground">
										{formatEur(m.lifetime_support_cents)}
									</td>
									<td className="px-4 py-3 text-xs">
										<div className="text-foreground">{formatDate(m.last_charge_date)}</div>
										{m.last_charge_status && (
											<div
												className={
													m.last_charge_status === "Paid"
														? "text-emerald-600 dark:text-emerald-400"
														: "text-rose-600 dark:text-rose-400"
												}
											>
												{m.last_charge_status}
											</div>
										)}
									</td>
									<td className="px-4 py-3 text-xs text-muted-foreground">
										{formatDate(m.pledge_start)}
									</td>
									<td className="px-4 py-3">
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.cls}`}
										>
											{statusCfg.label}
										</span>
									</td>
									<td className="px-4 py-3 text-right">
										<div className="inline-flex gap-1">
											<Button
												variant="ghost"
												size="icon"
												title="Resync depuis Patreon"
												disabled={isBusy}
												onClick={() => resync(m.patreon_member_id, m.id)}
											>
												{isBusy ? (
													<Loader2 className="h-3.5 w-3.5 animate-spin" />
												) : (
													<RefreshCw className="h-3.5 w-3.5" />
												)}
											</Button>
											<Select
												value={m.rg_subscription_status}
												onValueChange={(v) => setStatusOf(m.id, v)}
												disabled={isBusy}
											>
												<SelectTrigger className="h-8 w-[140px] text-xs">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="pending">En attente</SelectItem>
													<SelectItem value="reactivated">Réactivé</SelectItem>
													<SelectItem value="churned">Churn</SelectItem>
													<SelectItem value="grandfathered">Grandfathered</SelectItem>
												</SelectContent>
											</Select>
										</div>
									</td>
								</tr>
							);
						})}
						{filtered.length === 0 && (
							<tr>
								<td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
									Aucun membre trouvé pour ces filtres.
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>

			<p className="text-xs text-muted-foreground">
				{filtered.length} / {members.length} membre
				{members.length > 1 ? "s" : ""}
			</p>
		</div>
	);
}
