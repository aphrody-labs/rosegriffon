"use client";

import {
	Badge,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@rose-griffon/ui";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Heart, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

export interface LinkedAccount {
	provider: string;
	createdAt: string;
	scope: string | null;
}

const PROVIDER_META: Record<string, { label: string; color: string; description: string }> = {
	discord: {
		color: "bg-[#5865F2] hover:bg-[#5865F2]/90",
		description: "Connexion principale + sync rôles serveur RG.",
		label: "Discord",
	},
	patreon: {
		color: "bg-[#FF424D] hover:bg-[#FF424D]/90",
		description: "Sync membership + tier + réduction 20% boutique.",
		label: "Patreon",
	},
	twitch: {
		color: "bg-[#9146FF] hover:bg-[#9146FF]/90",
		description: "Sync follows + abonnements (usage futur).",
		label: "Twitch",
	},
};

export function ConnectionsSection({ accounts }: { accounts: LinkedAccount[] }) {
	const [busy, setBusy] = useState<string | null>(null);
	const [confirmUnlink, setConfirmUnlink] = useState<string | null>(null);

	const linked = new Set(accounts.map((a) => a.provider));

	const linkPatreon = async () => {
		setBusy("patreon");
		try {
			const res = await authClient.signIn.oauth2({
				callbackURL: "/dashboard/account?tab=connections",
				providerId: "patreon",
			});
			const err = (res as { error?: { message?: string } | null })?.error;
			if (err) {
				toast.error(err.message ?? "Erreur lors du link Patreon");
				setBusy(null);
			}
		} catch (error) {
			console.error(error);
			toast.error("Erreur lors du link Patreon");
			setBusy(null);
		}
	};

	const refreshPatreon = async () => {
		setBusy("patreon-refresh");
		try {
			const res = await fetch("/api/auth/patreon/refresh", { method: "POST" });
			if (!res.ok) {
				throw new Error(`HTTP ${res.status}`);
			}
			toast.success("Patreon synchronisé");
			window.location.reload();
		} catch (error) {
			console.error(error);
			toast.error("Erreur lors de la synchronisation");
		} finally {
			setBusy(null);
		}
	};

	const unlink = async (provider: string) => {
		setBusy(provider);
		try {
			if (provider === "patreon") {
				const res = await fetch("/api/auth/patreon/disconnect", {
					method: "POST",
				});
				if (!res.ok) {
					throw new Error(`HTTP ${res.status}`);
				}
			} else {
				// Better Auth expose unlinkAccount via le client
				const ba = authClient as unknown as {
					unlinkAccount: (p: { providerId: string }) => Promise<{
						error?: { message?: string } | null;
					}>;
				};
				const res = await ba.unlinkAccount({ providerId: provider });
				if (res.error) {
					throw new Error(res.error.message);
				}
			}
			toast.success(`Compte ${PROVIDER_META[provider]?.label ?? provider} dissocié`);
			window.location.reload();
		} catch (error) {
			console.error(error);
			const msg =
				error instanceof Error
					? error.message
					: "Impossible de dissocier ce compte (provider principal ?)";
			toast.error(msg);
		} finally {
			setBusy(null);
			setConfirmUnlink(null);
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Comptes connectés</CardTitle>
				<CardDescription>
					Liez vos comptes externes pour synchroniser vos rôles, abonnements et avantages. Le
					dernier compte actif ne peut pas être dissocié.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				{(["discord", "twitch", "patreon"] as const).map((provider) => {
					const meta = PROVIDER_META[provider]!;
					const account = accounts.find((a) => a.provider === provider);
					const isLinked = linked.has(provider);
					const onlyOne = accounts.length === 1 && isLinked;

					return (
						<div
							key={provider}
							className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
						>
							<div className="min-w-0 flex-1">
								<div className="flex flex-wrap items-center gap-2">
									<p className="font-semibold text-foreground">{meta.label}</p>
									{isLinked ? (
										<Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
											Connecté
										</Badge>
									) : (
										<Badge variant="outline" className="text-muted-foreground">
											Non connecté
										</Badge>
									)}
								</div>
								<p className="mt-1 text-xs text-muted-foreground">{meta.description}</p>
								{account?.createdAt && (
									<p className="mt-1 text-xs text-muted-foreground">
										Lié le{" "}
										{format(new Date(account.createdAt), "d MMM yyyy", {
											locale: fr,
										})}
									</p>
								)}
							</div>

							<div className="flex flex-wrap items-center gap-2">
								{provider === "patreon" && isLinked && (
									<Button
										size="sm"
										variant="outline"
										onClick={refreshPatreon}
										disabled={busy !== null}
									>
										{busy === "patreon-refresh" ? (
											<Loader2 className="mr-2 size-4 animate-spin" />
										) : null}
										Synchroniser
									</Button>
								)}
								{!isLinked && provider === "patreon" && (
									<Button
										size="sm"
										onClick={linkPatreon}
										disabled={busy !== null}
										className={`${meta.color} text-white`}
									>
										{busy === "patreon" ? (
											<Loader2 className="mr-2 size-4 animate-spin" />
										) : (
											<Heart className="mr-2 size-4" />
										)}
										Lier Patreon
									</Button>
								)}
								{!isLinked && provider !== "patreon" && (
									<Button size="sm" variant="outline" asChild>
										<Link href="/login">Se connecter avec {meta.label}</Link>
									</Button>
								)}
								{isLinked && !onlyOne && (
									<Button
										size="sm"
										variant="outline"
										onClick={() => setConfirmUnlink(provider)}
										disabled={busy !== null}
									>
										<X className="mr-2 size-4" />
										Dissocier
									</Button>
								)}
								{isLinked && onlyOne && (
									<p
										className="text-xs text-muted-foreground"
										title="Au moins un compte doit rester lié"
									>
										Compte principal
									</p>
								)}
							</div>
						</div>
					);
				})}

				<AlertDialog
					open={Boolean(confirmUnlink)}
					onOpenChange={(o) => !o && setConfirmUnlink(null)}
				>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>
								Dissocier {confirmUnlink ? PROVIDER_META[confirmUnlink]?.label : "ce compte"} ?
							</AlertDialogTitle>
							<AlertDialogDescription>
								Vous pourrez relier ce compte à tout moment. Vos données Patreon seront conservées
								en base mais plus rafraîchies.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel disabled={busy !== null}>Annuler</AlertDialogCancel>
							<AlertDialogAction
								onClick={(e) => {
									e.preventDefault();
									if (confirmUnlink) {
										unlink(confirmUnlink);
									}
								}}
								disabled={busy !== null}
								className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							>
								{busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
								Dissocier
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</CardContent>
		</Card>
	);
}
