"use client";

/**
 * Arbre de navigation **virtualisé + lazy** de l'index CPK (react-arborist).
 *
 * - Virtualisation react-window : tient les 250 800 fichiers (seuls ~30 nœuds rendus).
 * - Lazy par dossier : `onToggle` fetch `/api/cpk?path=` à la 1re ouverture (cf. lib/cpk/tree).
 * - Style Material 3 : rangées 36px, state-layer hover/focus, sélection `primary container`,
 *   icônes typées par extension. Fond `surface container` (nav rail M3).
 */
import { Tree, type NodeRendererProps } from "react-arborist";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { cpkPreviewKind } from "@/lib/cpk/shared";
import {
	type CpkNode,
	ancestorPaths,
	fetchChildren,
	isUnloaded,
	setChildren,
} from "@/lib/cpk/tree";

/** Icône Material Symbols selon le type de nœud / l'extension. */
function nodeIcon(node: CpkNode, open: boolean): string {
	if (node.kind === "dir") return open ? "folder_open" : "folder";
	switch (cpkPreviewKind(node.ext ?? "")) {
		case "image":
			return "image";
		case "model":
			return "deployed_code";
		case "sound":
			return "music_note";
		case "movie":
			return "movie";
		case "config":
		case "package":
			return "data_object";
		case "text":
			return "description";
		default:
			return "draft";
	}
}

/** Rangée M3 d'un nœud (indentation via `style` arborist). */
function Row({ node, style, dragHandle, tree }: NodeRendererProps<CpkNode>) {
	const data = node.data;
	const selected = node.isSelected;
	return (
		<div
			ref={dragHandle}
			style={style}
			onClick={() => (node.isInternal ? node.toggle() : node.activate())}
			className={`group flex items-center gap-1.5 h-9 pr-2 rounded-full cursor-pointer select-none text-sm transition-colors ${
				selected
					? "bg-primary-container text-on-primary-container"
					: "text-on-surface hover:bg-on-surface/[0.08]"
			}`}
		>
			{node.isInternal ? (
				<Icon
					name={node.isOpen ? "expand_more" : "chevron_right"}
					size={18}
					className="shrink-0 text-on-surface-variant"
				/>
			) : (
				<span className="w-[18px] shrink-0" />
			)}
			<Icon
				name={nodeIcon(data, node.isOpen)}
				size={18}
				className={`shrink-0 ${selected ? "text-on-primary-container" : "text-on-surface-variant"}`}
			/>
			<span className="truncate flex-1">{data.name}</span>
			{data.kind === "dir" && typeof data.count === "number" && (
				<span className="shrink-0 text-[11px] tabular-nums text-on-surface-variant/70">
					{data.count.toLocaleString("fr")}
				</span>
			)}
		</div>
	);
}

export function CpkTree({
	initialPath,
	onSelectFile,
	onSelectDir,
}: {
	initialPath?: string;
	onSelectFile?: (node: CpkNode) => void;
	onSelectDir?: (node: CpkNode) => void;
}) {
	const [data, setData] = useState<CpkNode[]>([]);
	const [size, setSize] = useState({ w: 320, h: 600 });
	// Ouvre d'emblée les ancêtres d'un deep-link (révèle le fichier sélectionné).
	const initialOpenState =
		initialPath && initialPath !== "data"
			? Object.fromEntries(ancestorPaths(initialPath).slice(0, -1).map((p) => [p, true]))
			: undefined;
	const boxRef = useRef<HTMLDivElement>(null);
	// Évite les états périmés dans les callbacks async.
	const dataRef = useRef<CpkNode[]>([]);
	dataRef.current = data;

	// Dimensionne l'arbre à son conteneur (react-arborist exige width/height).
	useEffect(() => {
		const el = boxRef.current;
		if (!el) return;
		const ro = new ResizeObserver(() => {
			setSize({ w: el.clientWidth, h: el.clientHeight });
		});
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	// Charge la racine, puis auto-déplie les ancêtres d'un deep-link.
	useEffect(() => {
		let cancelled = false;
		(async () => {
			const roots = await fetchChildren("data");
			if (cancelled) return;
			let tree = roots;
			// Auto-expansion progressive vers initialPath.
			if (initialPath && initialPath !== "data") {
				for (const anc of ancestorPaths(initialPath)) {
					const kids = await fetchChildren(anc);
					if (cancelled) return;
					tree = setChildren(tree, anc, kids);
				}
			}
			setData(tree);
		})();
		return () => {
			cancelled = true;
		};
	}, [initialPath]);

	const onToggle = useCallback(async (id: string) => {
		// react-arborist appelle onToggle APRÈS le changement d'état d'ouverture.
		const { findNode } = await import("@/lib/cpk/tree");
		const node = findNode(dataRef.current, id);
		if (node && isUnloaded(node)) {
			const kids = await fetchChildren(id);
			setData((d) => setChildren(d, id, kids));
		}
	}, []);

	const onActivate = useCallback(
		(node: { data: CpkNode }) => {
			if (node.data.kind === "file") onSelectFile?.(node.data);
			else onSelectDir?.(node.data);
		},
		[onSelectFile, onSelectDir],
	);

	return (
		<div ref={boxRef} className="h-full w-full">
			<Tree<CpkNode>
				data={data}
				idAccessor="id"
				childrenAccessor="children"
				openByDefault={false}
				rowHeight={36}
				indent={14}
				width={size.w}
				height={size.h}
				initialOpenState={initialOpenState}
				disableDrag
				disableEdit
				onToggle={onToggle}
				onActivate={onActivate}
			>
				{Row}
			</Tree>
		</div>
	);
}
