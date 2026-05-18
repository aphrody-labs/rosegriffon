"use client";

import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@rosegriffon/ui";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
	Loader2,
	LogOut,
	Monitor,
	ShieldCheck,
	Smartphone,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

export interface SessionItem {
	id: string;
	currentSessionId: boolean;
	createdAt: string;
	expiresAt: string;
	ipAddress: string | null;
	userAgent: string | null;
}

function detectDevice(ua: string | null): "mobile" | "desktop" {
	if (!ua) return "desktop";
	return /Mobile|iPhone|iPad|Android/i.test(ua) ? "mobile" : "desktop";
}

function describeUserAgent(ua: string | null): string {
	if (!ua) return "Appareil inconnu";
	if (/iPhone/.test(ua)) return "iPhone";
	if (/iPad/.test(ua)) return "iPad";
	if (/Android/.test(ua)) return "Android";
	if (/Mac OS X/.test(ua)) return "macOS";
	if (/Windows/.test(ua)) return "Windows";
	if (/Linux/.test(ua)) return "Linux";
	return "Appareil inconnu";
}

export function SecuritySection({ sessions }: { sessions: SessionItem[] }) {
	const [busy, setBusy] = useState<string | null>(null);

	const revokeSession = async (sessionId: string) => {
		setBusy(sessionId);
		try {
			await authClient.revokeSession({ token: sessionId });
			toast.success("Session révoquée");
			window.location.reload();
		} catch (e) {
			console.error(e);
			toast.error("Erreur lors de la révocation");
		} finally {
			setBusy(null);
		}
	};

	const revokeAllOthers = async () => {
		setBusy("all");
		try {
			await authClient.revokeOtherSessions();
			toast.success("Toutes les autres sessions ont été révoquées");
			window.location.reload();
		} catch (e) {
			console.error(e);
			toast.error("Erreur lors de la révocation");
		} finally {
			setBusy(null);
		}
	};

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<ShieldCheck className="size-5 text-emerald-500" />
						Double authentification (2FA)
					</CardTitle>
					<CardDescription>
						Bientôt disponible. Active la 2FA via une app TOTP (Google
						Authenticator, Authy, 1Password) pour renforcer la sécurité de ton
						compte.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button disabled variant="outline" className="cursor-not-allowed">
						À venir
					</Button>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div>
							<CardTitle>Sessions actives</CardTitle>
							<CardDescription>
								Tu peux révoquer une session à distance si tu te connectes
								depuis un appareil que tu ne reconnais pas.
							</CardDescription>
						</div>
						{sessions.length > 1 && (
							<Button
								variant="outline"
								size="sm"
								onClick={revokeAllOthers}
								disabled={busy !== null}
							>
								{busy === "all" ? (
									<Loader2 className="mr-2 size-4 animate-spin" />
								) : (
									<LogOut className="mr-2 size-4" />
								)}
								Déconnecter tous les autres
							</Button>
						)}
					</div>
				</CardHeader>
				<CardContent className="space-y-3">
					{sessions.length === 0 && (
						<p className="text-sm text-muted-foreground">
							Aucune session active. (Tu ne devrais pas voir ce message —
							recharge la page.)
						</p>
					)}
					{sessions.map((s) => {
						const Icon =
							detectDevice(s.userAgent) === "mobile" ? Smartphone : Monitor;
						return (
							<div
								key={s.id}
								className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
							>
								<div className="flex min-w-0 items-start gap-3">
									<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
										<Icon className="size-4" />
									</div>
									<div className="min-w-0">
										<div className="flex flex-wrap items-center gap-2">
											<p className="font-semibold text-foreground">
												{describeUserAgent(s.userAgent)}
											</p>
											{s.currentSessionId && (
												<Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
													Session courante
												</Badge>
											)}
										</div>
										<p className="mt-0.5 text-xs text-muted-foreground">
											{s.ipAddress ?? "IP inconnue"} · Créée{" "}
											{formatDistanceToNow(new Date(s.createdAt), {
												locale: fr,
												addSuffix: true,
											})}
										</p>
										<p className="text-xs text-muted-foreground">
											Expire le{" "}
											{format(new Date(s.expiresAt), "d MMM yyyy à HH:mm", {
												locale: fr,
											})}
										</p>
									</div>
								</div>
								{!s.currentSessionId && (
									<Button
										variant="ghost"
										size="sm"
										onClick={() => revokeSession(s.id)}
										disabled={busy !== null}
										className="text-destructive hover:text-destructive hover:bg-destructive/10"
									>
										{busy === s.id ? (
											<Loader2 className="mr-2 size-4 animate-spin" />
										) : (
											<LogOut className="mr-2 size-4" />
										)}
										Révoquer
									</Button>
								)}
							</div>
						);
					})}
				</CardContent>
			</Card>
		</div>
	);
}