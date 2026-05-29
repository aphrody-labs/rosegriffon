/**
 * Tâches de déclenchement d'API et de pré-chauffage de cache pour les applications Next.js.
 */

export async function triggerPublishScheduled(): Promise<{ success: boolean; error?: string }> {
	const secret = process.env.CRON_SECRET;
	if (!secret) {
		return { success: false, error: "La variable d'environnement CRON_SECRET est manquante." };
	}
	const apiUrl = process.env.API_URL || "https://api.rosegriffon.fr";
	const url = `${apiUrl}/api/cron/publish-scheduled`;

	console.log(`[Cron API] Déclenchement de la publication programmée (Azalée) : ${url}...`);
	try {
		const res = await fetch(url, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${secret}`,
			},
		});

		if (res.ok) {
			const data = await res.json();
			console.log("[Cron API] Résultat publication programmée :", data);
			return { success: true };
		} else {
			const text = await res.text();
			const err = `HTTP ${res.status}: ${text}`;
			console.error("[Cron API] Échec du déclenchement publication programmée :", err);
			return { success: false, error: err };
		}
	} catch (err: any) {
		console.error("[Cron API] Erreur lors du déclenchement publication programmée :", err);
		return { success: false, error: err.message || String(err) };
	}
}

export async function triggerPatreonRefresh(): Promise<{ success: boolean; error?: string }> {
	const secret = process.env.CRON_SECRET;
	if (!secret) {
		return { success: false, error: "La variable d'environnement CRON_SECRET est manquante." };
	}
	const apiUrl = process.env.API_URL || "https://api.rosegriffon.fr";
	const url = `${apiUrl}/api/cron/patreon-refresh`;

	console.log(`[Cron API] Déclenchement du rafraîchissement Patreon (Website) : ${url}...`);
	try {
		const res = await fetch(url, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${secret}`,
			},
		});

		if (res.ok) {
			const data = await res.json();
			console.log("[Cron API] Résultat rafraîchissement Patreon :", data);
			return { success: true };
		} else {
			const text = await res.text();
			const err = `HTTP ${res.status}: ${text}`;
			console.error("[Cron API] Échec du déclenchement rafraîchissement Patreon :", err);
			return { success: false, error: err };
		}
	} catch (err: any) {
		console.error("[Cron API] Erreur lors du déclenchement rafraîchissement Patreon :", err);
		return { success: false, error: err.message || String(err) };
	}
}

export async function triggerPatreonReminders(
	stage = "announce"
): Promise<{ success: boolean; error?: string }> {
	const secret = process.env.CRON_SECRET;
	if (!secret) {
		return { success: false, error: "La variable d'environnement CRON_SECRET est manquante." };
	}
	const apiUrl = process.env.API_URL || "https://api.rosegriffon.fr";
	const url = `${apiUrl}/api/cron/patreon-reminders?stage=${stage}`;

	console.log(`[Cron API] Déclenchement des rappels Patreon (${stage}) (Website) : ${url}...`);
	try {
		const res = await fetch(url, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${secret}`,
			},
		});

		if (res.ok) {
			const data = await res.json();
			console.log(`[Cron API] Résultat rappels Patreon (${stage}) :`, data);
			return { success: true };
		} else {
			const text = await res.text();
			const err = `HTTP ${res.status}: ${text}`;
			console.error(`[Cron API] Échec du déclenchement rappels Patreon (${stage}) :`, err);
			return { success: false, error: err };
		}
	} catch (err: any) {
		console.error(`[Cron API] Erreur lors du déclenchement rappels Patreon (${stage}) :`, err);
		return { success: false, error: err.message || String(err) };
	}
}

export async function warmCaches(): Promise<{ success: boolean }> {
	const azaleeUrl = process.env.AZALEE_URL || "https://azalee.rosegriffon.fr";
	const websiteUrl = process.env.WEBSITE_URL || "https://rosegriffon.fr";
	const apiUrl = process.env.API_URL || "https://api.rosegriffon.fr";
	const cdnUrl = process.env.CDN_URL || "https://cdn.rosegriffon.fr";

	const paths = [
		`${azaleeUrl}/`,
		`${azaleeUrl}/wiki`,
		`${azaleeUrl}/wiki/zukan`,
		`${websiteUrl}/`,
		`${websiteUrl}/articles`,
		`${websiteUrl}/notre-equipe`,
		`${websiteUrl}/notre-equipe/staff`,
		`${apiUrl}/health`, // Vérifier l'état de l'API
		`${cdnUrl}/static/azalee/public/logo-og.png`, // Vérifier que le CDN répond correctement
		`${cdnUrl}/static/website/public/favicon.ico`,
	];

	console.log("[Cron Cache] Pré-chauffage des caches ISR...");
	for (const path of paths) {
		try {
			console.log(`[Cron Cache] Requête GET sur ${path}...`);
			const res = await fetch(path, { method: "GET" });
			console.log(`[Cron Cache] ${path} a renvoyé le statut HTTP ${res.status}`);
		} catch (err) {
			console.error(`[Cron Cache] Échec du pré-chauffage pour ${path} :`, err);
		}
	}
	return { success: true };
}

export async function triggerGithubPublishWorkflow(): Promise<{ success: boolean; error?: string }> {
	const token = process.env.GITHUB_TOKEN || process.env.NODE_AUTH_TOKEN;
	if (!token) {
		return { success: false, error: "La variable d'environnement GITHUB_TOKEN ou NODE_AUTH_TOKEN est manquante." };
	}

	const owner = "rose-griffon";
	const repo = "rg";
	const workflowId = "publish.yml";
	const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`;

	console.log(`[Cron API] Déclenchement du workflow GitHub Actions : ${workflowId}...`);
	try {
		const res = await fetch(url, {
			method: "POST",
			headers: {
				Accept: "application/vnd.github+json",
				Authorization: `Bearer ${token}`,
				"X-GitHub-Api-Version": "2022-11-28",
				"User-Agent": "Rose-Griffon-Cron",
			},
			body: JSON.stringify({
				ref: "vps", // Branche de production sur le VPS
			}),
		});

		if (res.status === 204) {
			console.log("[Cron API] Workflow GitHub Actions déclenché avec succès (204 No Content).");
			return { success: true };
		} else {
			const text = await res.text();
			const err = `HTTP ${res.status}: ${text}`;
			console.error("[Cron API] Échec du déclenchement du workflow GitHub Actions :", err);
			return { success: false, error: err };
		}
	} catch (err: any) {
		console.error("[Cron API] Erreur lors du déclenchement du workflow GitHub Actions :", err);
		return { success: false, error: err.message || String(err) };
	}
}

