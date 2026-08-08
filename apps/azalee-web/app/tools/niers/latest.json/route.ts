import { NextResponse } from "next/server";

// Endpoint updater Tauri pour l'app desktop niers (cf. `tauri.conf.json` → plugins.updater.endpoints
// du dépôt aphrody-code/niers). Proxy DYNAMIQUE de l'API GitHub Releases : ne redéploie jamais azalee
// à chaque nouvelle version niers — la dernière release non-draft/non-prerelease qui embarque un
// installeur NSIS signé (`*-setup.exe` + `*-setup.exe.sig`) devient automatiquement la mise à jour
// proposée. Format JSON statique attendu par le plugin (https://v2.tauri.app/plugin/updater) :
// { version, notes, pub_date, platforms: { "windows-x86_64": { signature, url } } }.
export const revalidate = 3600; // évite de marteler l'API GitHub (rate-limit anonyme 60 req/h/IP)

const REPO = "aphrody-code/niers";

interface GhAsset {
	name: string;
	browser_download_url: string;
}

interface GhRelease {
	tag_name: string;
	body: string | null;
	published_at: string;
	assets: GhAsset[];
	draft: boolean;
	prerelease: boolean;
}

async function fetchText(url: string): Promise<string | null> {
	const res = await fetch(url, { next: { revalidate } });
	if (!res.ok) return null;
	return (await res.text()).trim();
}

export async function GET() {
	const releasesRes = await fetch(`https://api.github.com/repos/${REPO}/releases`, {
		headers: { Accept: "application/vnd.github+json" },
		next: { revalidate },
	});
	if (!releasesRes.ok) {
		return NextResponse.json({ error: "GitHub indisponible" }, { status: 502 });
	}

	const releases = (await releasesRes.json()) as GhRelease[];
	// Dernière release publiée (pas brouillon/pré-version) qui embarque un installeur NSIS signé.
	const release = releases.find(
		(r) => !r.draft && !r.prerelease && r.assets.some((a) => a.name.endsWith("-setup.exe.sig"))
	);
	if (!release) {
		return NextResponse.json({ error: "Aucune release desktop signée publiée" }, { status: 404 });
	}

	const nsis = release.assets.find((a) => a.name.endsWith("-setup.exe"));
	const nsisSig = release.assets.find((a) => a.name === `${nsis?.name}.sig`);
	if (!nsis || !nsisSig) {
		return NextResponse.json({ error: "Asset NSIS ou signature manquant" }, { status: 404 });
	}

	const signature = await fetchText(nsisSig.browser_download_url);
	if (!signature) {
		return NextResponse.json({ error: "Signature illisible" }, { status: 502 });
	}

	return NextResponse.json({
		notes: release.body ?? "",
		platforms: {
			"windows-x86_64": { signature, url: nsis.browser_download_url },
		},
		pub_date: release.published_at,
		version: release.tag_name.replace(/^v/, ""),
	});
}
