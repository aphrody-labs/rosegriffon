/**
 * Modèle d'arbre **lazy** pour l'explorateur /cpk (react-arborist, données contrôlées).
 *
 * react-arborist ne charge pas les enfants à la demande nativement : on maintient nous-mêmes
 * l'état `data` et, à l'ouverture d'un dossier (`onToggle`), on fetch ses enfants via
 * `/api/cpk?path=<dir>` puis on les fusionne immuablement. Un dossier non chargé porte un enfant
 * sentinelle `__loading__` pour rester « internal » (flèche d'expansion visible) tant qu'on n'a
 * pas récupéré son contenu réel. Échelle : par dossier, les enfants directs sont bornés (pire cas
 * ~15k, virtualisés par react-window) — cf. docs/cpk-explorer-design.md.
 */

/** Un nœud de l'arbre CPK : dossier (avec enfants lazy) ou fichier (feuille). */
export interface CpkNode {
	/** Chemin d'index complet (`data/...`) — sert d'`id` arborist unique. */
	id: string;
	/** Nom affiché (dernier segment). */
	name: string;
	/** `dir` = dossier navigable, `file` = feuille. */
	kind: "dir" | "file";
	/** Extension (fichiers uniquement, sans point). */
	ext?: string;
	/** Nombre de descendants (dossiers uniquement, indicatif). */
	count?: number;
	/** Enfants : `undefined` pour un fichier (feuille) ; `[sentinelle]` si non chargé. */
	children?: CpkNode[];
}

/** Réponse de `/api/cpk?path=<dir>`. */
interface CpkListing {
	dir: string;
	dirs: { name: string; count: number }[];
	files: { name: string; ext: string; path: string }[];
}

const SENTINEL = "__loading__";

/** Crée le placeholder qui maintient un dossier « expandable » avant chargement. */
function loadingChild(parentId: string): CpkNode {
	return { id: `${parentId}/${SENTINEL}`, name: "…", kind: "dir", children: [] };
}

/** `true` si le dossier n'a pas encore chargé ses vrais enfants. */
export function isUnloaded(node: CpkNode): boolean {
	return (
		node.kind === "dir" &&
		!!node.children &&
		node.children.length === 1 &&
		node.children[0].id.endsWith(`/${SENTINEL}`)
	);
}

/** Construit un nœud dossier (enfants lazy non chargés). */
function dirNode(parentPath: string, name: string, count: number): CpkNode {
	const id = `${parentPath}/${name}`;
	return { id, name, kind: "dir", count, children: [loadingChild(id)] };
}

/** Construit un nœud fichier (feuille). */
function fileNode(file: { name: string; ext: string; path: string }): CpkNode {
	return { id: file.path, name: file.name, kind: "file", ext: file.ext };
}

/** Fetch les enfants directs d'un dossier (`data/...` ou `data`) et les transforme en nœuds. */
export async function fetchChildren(dirPath: string): Promise<CpkNode[]> {
	const res = await fetch(`/api/cpk?path=${encodeURIComponent(dirPath)}`);
	if (!res.ok) return [];
	const listing = (await res.json()) as CpkListing;
	const dirs = listing.dirs.map((d) => dirNode(dirPath, d.name, d.count));
	const files = listing.files.map(fileNode);
	return [...dirs, ...files];
}

/** Remplace immuablement les enfants du nœud `id` dans l'arbre. */
export function setChildren(tree: CpkNode[], id: string, children: CpkNode[]): CpkNode[] {
	return tree.map((n) => {
		if (n.id === id) return { ...n, children };
		if (n.children && id.startsWith(`${n.id}/`)) {
			return { ...n, children: setChildren(n.children, id, children) };
		}
		return n;
	});
}

/** Trouve un nœud par id (DFS). */
export function findNode(tree: CpkNode[], id: string): CpkNode | null {
	for (const n of tree) {
		if (n.id === id) return n;
		if (n.children && id.startsWith(`${n.id}/`)) {
			const hit = findNode(n.children, id);
			if (hit) return hit;
		}
	}
	return null;
}

/** Liste des ancêtres (`data/a`, `data/a/b`, …) d'un chemin, pour l'auto-expansion d'un deep-link. */
export function ancestorPaths(indexPath: string): string[] {
	const segs = indexPath.split("/");
	const out: string[] = [];
	for (let i = 1; i < segs.length; i++) out.push(segs.slice(0, i + 1).join("/"));
	return out;
}
