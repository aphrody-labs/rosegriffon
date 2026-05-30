/**
 * @license
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync } from "node:child_process";

const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

async function purgeCloudflare() {
	if (!ZONE_ID || !API_TOKEN) {
		console.log("[CDN Invalidate] Cloudflare Zone ID or API Token missing. Skipping Cloudflare purge.");
		return;
	}

	console.log("[CDN Invalidate] Purging Cloudflare cache...");
	const url = `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/purge_cache`;
	
	try {
		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Authorization": `Bearer ${API_TOKEN}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ purge_everything: true }),
		});

		if (response.ok) {
			const data = await response.json();
			if (data.success) {
				console.log("[CDN Invalidate] Cloudflare cache purged successfully!");
			} else {
				console.error("[CDN Invalidate] Cloudflare purge failed:", data.errors);
			}
		} else {
			console.error("[CDN Invalidate] Cloudflare API responded with status:", response.status, await response.text());
		}
	} catch (err) {
		console.error("[CDN Invalidate] Error calling Cloudflare API:", err);
	}
}

function reloadNginx() {
	console.log("[CDN Invalidate] Reloading local Nginx service to refresh file cache...");
	try {
		// Try reloading Nginx directly
		execSync("sudo systemctl reload nginx", { stdio: "inherit" });
		console.log("[CDN Invalidate] Nginx reloaded successfully!");
	} catch (err: any) {
		console.warn("[CDN Invalidate] Could not reload Nginx via systemctl (might lack sudo permissions):", err.message || err);
		try {
			// Try reload using nginx command
			execSync("sudo nginx -s reload", { stdio: "inherit" });
			console.log("[CDN Invalidate] Nginx reloaded using nginx command!");
		} catch (nginxErr: any) {
			console.warn("[CDN Invalidate] Nginx reload failed:", nginxErr.message || nginxErr);
		}
	}
}

async function main() {
	console.log("[CDN Invalidate] Démarrage de l'invalidation du CDN...");
	
	// 1. Invalider le cache local (Nginx open_file_cache)
	reloadNginx();

	// 2. Invalider le CDN edge (Cloudflare)
	await purgeCloudflare();

	console.log("[CDN Invalidate] Opérations d'invalidation CDN terminées.");
}

main().catch((err) => {
	console.error("[CDN Invalidate] Critical error:", err);
	process.exit(1);
});
