#!/usr/bin/env bun
/**
 * Archive froide — déporte les données inactives sur le second VPS.
 *
 * Le VPS principal (51.77.147.152) sert toute la production : il héberge le
 * dump du jeu que le CDN décode en direct, et ce dump seul pèse 70 Go. Le
 * second VPS (51.255.162.6) ne fait tourner qu'achillea et shenron ; sa place
 * libre sert donc de **stockage secondaire** pour tout ce qui n'est lu par
 * aucun service : bases de reverse-engineering, outils d'extraction, archives.
 *
 * Le transfert passe par `rsync` sur SSH — c'est l'outil de référence pour
 * déplacer des arborescences (reprise, préservation des attributs, delta) et
 * réécrire un protocole de copie en Bun n'apporterait rien. Bun orchestre,
 * vérifie et tient l'index.
 *
 * Garde-fou central : **rien n'est supprimé localement avant que la copie
 * distante ait été vérifiée** — nombre de fichiers ET total d'octets doivent
 * concorder. En cas d'écart, la source reste intacte et la commande échoue.
 *
 * Usage :
 *   bun scripts/ops/archive-froid.ts pousser <chemin...>   # déporte
 *   bun scripts/ops/archive-froid.ts recuperer <nom>       # rapatrie
 *   bun scripts/ops/archive-froid.ts lister                # inventaire
 *   bun scripts/ops/archive-froid.ts espace                # place des deux côtés
 */

import { $ } from "bun";

/** Hôte SSH du stockage secondaire. */
const HOTE = Bun.env.RG_ARCHIVE_HOTE ?? "ubuntu@51.255.162.6";
/** Racine de l'archive sur l'hôte distant. */
const RACINE = Bun.env.RG_ARCHIVE_RACINE ?? "/srv/rg-archive";
/** Index NDJSON, tenu à distance (la source de vérité est là où sont les données). */
const INDEX = `${RACINE}/index.ndjson`;
/** Suffixe du témoin laissé à la place de ce qui a été déporté. */
const TEMOIN = ".archive-froid.json";

interface Entree {
	/** Nom canonique dans l'archive (chemin d'origine aplati). */
	nom: string;
	/** Chemin absolu d'origine sur le VPS principal. */
	source: string;
	/** Nombre de fichiers vérifié après transfert. */
	fichiers: number;
	/** Total d'octets vérifié après transfert. */
	octets: number;
	/** Date ISO du dépôt. */
	depose: string;
	/** Raison du déport, pour qu'on sache plus tard si on peut jeter. */
	motif: string;
}

/** Formate des octets en unité lisible (base 1024, comme `du -h`). */
function taille(octets: number): string {
	const unites = ["o", "Ko", "Mo", "Go", "To"];
	let valeur = octets;
	let index = 0;
	while (valeur >= 1024 && index < unites.length - 1) {
		valeur /= 1024;
		index += 1;
	}
	return `${valeur.toFixed(valeur >= 100 || index === 0 ? 0 : 1)} ${unites[index]}`;
}

/**
 * Empreinte d'une arborescence : nombre de fichiers et total d'octets.
 *
 * C'est la mesure comparée avant/après transfert. On compte les fichiers
 * réguliers uniquement : `du` seul suffirait pour le volume mais raterait un
 * fichier manquant compensé par la taille d'un autre.
 */
const MESURE = (chemin: string) =>
	`if [ -d "${chemin}" ]; then find "${chemin}" -type f -printf '%s\\n' | awk '{n++; s+=$1} END {printf "%d %d", n+0, s+0}';` +
	` elif [ -f "${chemin}" ]; then stat -c '1 %s' "${chemin}"; else echo "0 0"; fi`;

/** Mesure locale. */
async function mesurerLocal(chemin: string): Promise<{ fichiers: number; octets: number }> {
	const sortie = await $`bash -c ${MESURE(chemin)}`.text();
	const [fichiers, octets] = sortie.trim().split(/\s+/).map(Number);
	return { fichiers: fichiers ?? 0, octets: octets ?? 0 };
}

/** Mesure distante, exécutée sur l'hôte de stockage. */
async function mesurerDistant(chemin: string): Promise<{ fichiers: number; octets: number }> {
	const sortie = await $`ssh -o BatchMode=yes ${HOTE} ${MESURE(chemin)}`.text();
	const [fichiers, octets] = sortie.trim().split(/\s+/).map(Number);
	return { fichiers: fichiers ?? 0, octets: octets ?? 0 };
}

/** Nom canonique : chemin absolu aplati, sans le préfixe du dossier personnel. */
function nomCanonique(absolu: string): string {
	return absolu.replace(/^\/home\/ubuntu\//, "").replace(/^\//, "").replaceAll("/", "_");
}

/** Lit l'index distant. Absent = archive vide. */
async function lireIndex(): Promise<Entree[]> {
	const brut = await $`ssh -o BatchMode=yes ${HOTE} cat ${INDEX} 2>/dev/null || true`.text();
	return brut
		.split("\n")
		.filter((ligne) => ligne.trim().length > 0)
		.map((ligne) => JSON.parse(ligne) as Entree);
}

/** Réécrit l'index distant en entier (les entrées sont peu nombreuses). */
async function ecrireIndex(entrees: Entree[]): Promise<void> {
	const contenu = entrees.map((entree) => JSON.stringify(entree)).join("\n");
	// Bun Shell redirige un tampon vers l'entrée standard avec `< ${…}` ; il n'y
	// a pas de méthode `.stdin()` sur la promesse.
	await $`ssh -o BatchMode=yes ${HOTE} ${`cat > ${INDEX}`} < ${Buffer.from(`${contenu}\n`)}`.quiet();
}

/**
 * Déporte un chemin vers le stockage secondaire.
 *
 * Séquence : mesure locale → rsync → mesure distante → comparaison stricte →
 * suppression locale → témoin JSON → index. Toute divergence interrompt avant
 * la suppression, si bien qu'un transfert incomplet ne peut pas détruire la
 * source.
 */
async function pousser(chemin: string, motif: string): Promise<void> {
	const absolu = (await $`readlink -f ${chemin}`.text()).trim();
	if (!absolu || absolu === "/") throw new Error(`chemin invalide : ${chemin}`);

	const avant = await mesurerLocal(absolu);
	if (avant.fichiers === 0) {
		console.log(`ignoré  ${absolu} (inexistant ou vide)`);
		return;
	}

	const nom = nomCanonique(absolu);
	const cible = `${RACINE}/${nom}`;
	console.log(`envoi   ${absolu} → ${HOTE}:${cible} (${avant.fichiers} fichiers, ${taille(avant.octets)})`);

	await $`ssh -o BatchMode=yes ${HOTE} mkdir -p ${cible}`.quiet();
	// Le `/` final sur la source copie le *contenu* du dossier dans la cible ;
	// pour un fichier isolé rsync le dépose tel quel dans la cible.
	const source = avant.fichiers === 1 && !absolu.endsWith("/") ? absolu : `${absolu}/`;
	const transfert = await $`rsync -a --partial --inplace -e ${"ssh -o BatchMode=yes"} ${source} ${`${HOTE}:${cible}/`}`.nothrow();
	if (transfert.exitCode !== 0) {
		throw new Error(`rsync a échoué (${transfert.exitCode}) — source conservée`);
	}

	const apres = await mesurerDistant(cible);
	if (apres.fichiers !== avant.fichiers || apres.octets !== avant.octets) {
		throw new Error(
			`vérification échouée pour ${nom} : local ${avant.fichiers}/${avant.octets} ≠ distant ${apres.fichiers}/${apres.octets} — source conservée`
		);
	}

	await $`rm -rf ${absolu}`;
	const entree: Entree = {
		depose: new Date().toISOString(),
		fichiers: apres.fichiers,
		motif,
		nom,
		octets: apres.octets,
		source: absolu,
	};
	await Bun.write(`${absolu}${TEMOIN}`, `${JSON.stringify({ ...entree, hote: HOTE, cible }, null, "\t")}\n`);

	const index = (await lireIndex()).filter((e) => e.nom !== nom);
	index.push(entree);
	await ecrireIndex(index);
	console.log(`libéré  ${taille(apres.octets)} — ${absolu}${TEMOIN} indique où le retrouver`);
}

/** Rapatrie une entrée à son emplacement d'origine. */
async function recuperer(nom: string): Promise<void> {
	const index = await lireIndex();
	const entree = index.find((e) => e.nom === nom || e.source === nom);
	if (!entree) throw new Error(`entrée inconnue : ${nom} (voir « lister »)`);

	const cible = `${RACINE}/${entree.nom}`;
	console.log(`retour  ${HOTE}:${cible} → ${entree.source} (${taille(entree.octets)})`);
	await $`mkdir -p ${entree.source}`;
	const transfert = await $`rsync -a --partial -e ${"ssh -o BatchMode=yes"} ${`${HOTE}:${cible}/`} ${`${entree.source}/`}`.nothrow();
	if (transfert.exitCode !== 0) throw new Error(`rsync a échoué (${transfert.exitCode})`);

	const verif = await mesurerLocal(entree.source);
	if (verif.fichiers !== entree.fichiers) {
		throw new Error(`rapatriement incomplet : ${verif.fichiers}/${entree.fichiers} fichiers`);
	}
	await $`rm -f ${`${entree.source}${TEMOIN}`}`.nothrow().quiet();
	console.log(`ok      ${entree.fichiers} fichiers restaurés (copie distante conservée)`);
}

/** Affiche l'inventaire de l'archive. */
async function lister(): Promise<void> {
	const index = await lireIndex();
	if (index.length === 0) {
		console.log("archive vide");
		return;
	}
	const total = index.reduce((somme, entree) => somme + entree.octets, 0);
	for (const entree of index.sort((a, b) => b.octets - a.octets)) {
		console.log(
			`${taille(entree.octets).padStart(8)}  ${entree.nom}\n          ${entree.source} · ${entree.fichiers} fichiers · ${entree.depose.slice(0, 10)} · ${entree.motif}`
		);
	}
	console.log(`\n${index.length} entrées · ${taille(total)} déportés`);
}

/** Affiche la place disponible des deux côtés. */
async function espace(): Promise<void> {
	const ici = (await $`df -h --output=size,used,avail,pcent / | tail -1`.text()).trim();
	const distant = (
		await $`ssh -o BatchMode=yes ${HOTE} df -h --output=size,used,avail,pcent / | tail -1`.text()
	).trim();
	console.log(`principal  ${ici}`);
	console.log(`stockage   ${distant}   (${HOTE})`);
}

const [commande, ...arguments_] = Bun.argv.slice(2);
const motif = Bun.env.RG_ARCHIVE_MOTIF ?? "données froides, aucun service ne les lit";

switch (commande) {
	case "pousser": {
		if (arguments_.length === 0) throw new Error("usage : pousser <chemin...>");
		for (const chemin of arguments_) await pousser(chemin, motif);
		await espace();
		break;
	}
	case "recuperer": {
		if (!arguments_[0]) throw new Error("usage : recuperer <nom>");
		await recuperer(arguments_[0]);
		break;
	}
	case "lister":
		await lister();
		break;
	case "espace":
		await espace();
		break;
	default:
		console.log(
			"archive-froid — stockage secondaire sur le second VPS\n\n" +
				"  pousser <chemin...>  déporte et libère la place (vérifié avant suppression)\n" +
				"  recuperer <nom>      rapatrie à l'emplacement d'origine\n" +
				"  lister               inventaire de ce qui est déporté\n" +
				"  espace               place disponible des deux côtés"
		);
		process.exit(commande ? 1 : 0);
}
