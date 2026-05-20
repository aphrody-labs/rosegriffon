"use client";

import { closestCenter, DndContext, DragOverlay, KeyboardSensor, PointerSensor, pointerWithin, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { CollisionDetection, DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { toPng } from "html-to-image";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { deleteTeam, saveTeam, updateTeam } from "@/app/actions/teams";
import { Icon } from "@/components/ui/Icon";
import { FORMATIONS, ROLE_COLORS } from '@/lib/formations';
import type { Formation } from '@/lib/formations';
import type { SavedTeam, TeamData, TeamMember } from "@/lib/team-types";
import { cn } from "@/lib/utils";
import { CharacterPicker, CharacterPickerOverlay } from './CharacterPicker';
import type { PickerCharacter } from './CharacterPicker';
import { FormationField } from "./FormationField";
import { PlayerDetailPanel } from "./PlayerDetailPanel";
import { PlayerSlotOverlay } from "./PlayerSlot";
import { TeamStats } from "./TeamStats";

/* ── Types ────────────────────────────────────────────────── */

type DragData =
	| { type: "player"; character: PickerCharacter; origin: "roster" }
	| {
			type: "player";
			member: TeamMember;
			origin: "field" | "bench";
			slotId: string;
	  };

/* ── Collision ────────────────────────────────────────────── */

const customCollision: CollisionDetection = (args) => {
	const pointer = pointerWithin(args);
	if (pointer.length > 0) {return pointer;}
	return closestCenter(args);
};

/* ── LocalStorage helpers ─────────────────────────────────── */

const LS_KEY = "azalee-my-team";

function loadFromLocalStorage(): {
	formationIdx: number;
	members: Record<string, TeamMember>;
	teamName: string;
} | null {
	try {
		const raw = localStorage.getItem(LS_KEY);
		if (!raw) {return null;}
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

function saveToLocalStorage(
	formationIdx: number,
	members: Record<string, TeamMember>,
	teamName: string,
) {
	try {
		localStorage.setItem(
			LS_KEY,
			JSON.stringify({ formationIdx, members, teamName }),
		);
	} catch {
		/* Quota */
	}
}

/* ── URL share encoding ───────────────────────────────────── */

function encodeTeamToURL(
	formationId: string,
	members: Record<string, TeamMember>,
): string {
	const parts = [formationId];
	for (const m of Object.values(members)) {
		parts.push(`${m.slot}:${m.charaId}`);
	}
	return btoa(parts.join("|"));
}

function decodeTeamFromURL(
	encoded: string,
	characters: PickerCharacter[],
): { formationIdx: number; members: Record<string, TeamMember> } | null {
	try {
		const decoded = atob(encoded);
		const parts = decoded.split("|");
		const formationId = parts[0];
		const formationIdx = FORMATIONS.findIndex((f) => f.id === formationId);
		if (formationIdx === -1) {return null;}

		const charMap = new Map(characters.map((c) => [c.charaId, c]));
		const members: Record<string, TeamMember> = {};

		for (let i = 1; i < parts.length; i++) {
			const [slot, charaId] = parts[i].split(":");
			const char = charMap.get(charaId);
			if (char && slot) {
				members[slot] = {
					charaId: char.charaId,
					element: char.element,
					imageUrl: char.imageUrl,
					name: char.name,
					position: char.position,
					rarity: char.rarity,
					slot,
					slug: char.slug,
				};
			}
		}
		return { formationIdx, members };
	} catch {
		return null;
	}
}

/* ── Rarity score for auto-fill ───────────────────────────── */

const RARITY_SCORE: Record<string, number> = {
	BASARA: 6,
	Expérimenté: 3,
	Héros: 5,
	Normal: 1,
	Émérite: 4,
};

/* ── Formation Mini-Preview ───────────────────────────────── */

function FormationMiniPreview({ formation }: { formation: Formation }) {
	return (
		<svg viewBox="0 0 50 88" className="w-6 h-10 sm:w-7 sm:h-11">
			<rect
				x="1"
				y="1"
				width="48"
				height="86"
				rx="2"
				fill="none"
				stroke="currentColor"
				strokeOpacity="0.15"
				strokeWidth="1"
			/>
			<line
				x1="1"
				y1="44"
				x2="49"
				y2="44"
				stroke="currentColor"
				strokeOpacity="0.1"
				strokeWidth="0.5"
			/>
			<circle
				cx="25"
				cy="44"
				r="6"
				fill="none"
				stroke="currentColor"
				strokeOpacity="0.1"
				strokeWidth="0.5"
			/>
			{formation.positions.map((p) => (
				<circle
					key={p.index}
					cx={(p.left / 100) * 42 + 4 + 4}
					cy={(p.top / 50) * 80 + 4}
					r="2.5"
					fill={ROLE_COLORS[p.role]}
					opacity="0.8"
				/>
			))}
		</svg>
	);
}

/* ── Main Component ───────────────────────────────────────── */

interface TeamBuilderProps {
	characters: PickerCharacter[];
	initialTeam?: SavedTeam | null;
	isAuthenticated?: boolean;
}

export function TeamBuilder({
	characters,
	initialTeam,
	isAuthenticated,
}: TeamBuilderProps) {
	// ── Init from URL > initialTeam > localStorage ─────
	const [formationIdx, setFormationIdx] = useState(() => {
		if (typeof window !== "undefined") {
			const params = new URLSearchParams(window.location.search);
			const t = params.get("t");
			if (t) {
				const decoded = decodeTeamFromURL(t, characters);
				if (decoded) {return decoded.formationIdx;}
			}
		}
		if (initialTeam) {
			const idx = FORMATIONS.findIndex(
				(f) => f.id === initialTeam.formation_id,
			);
			return Math.max(idx, 0);
		}
		const ls = loadFromLocalStorage();
		return ls?.formationIdx ?? 0;
	});

	const [members, setMembers] = useState<Record<string, TeamMember>>(() => {
		if (typeof window !== "undefined") {
			const params = new URLSearchParams(window.location.search);
			const t = params.get("t");
			if (t) {
				const decoded = decodeTeamFromURL(t, characters);
				if (decoded) {return decoded.members;}
			}
		}
		if (initialTeam?.formation_data) {
			const data = initialTeam.formation_data as TeamData;
			const map: Record<string, TeamMember> = {};
			for (const m of data.members || []) {map[m.slot] = m;}
			return map;
		}
		const ls = loadFromLocalStorage();
		return ls?.members ?? {};
	});

	const [teamName, setTeamName] = useState(() => {
		if (initialTeam?.name) {return initialTeam.name;}
		const ls = loadFromLocalStorage();
		return ls?.teamName ?? "";
	});

	const [teamId, setTeamId] = useState(initialTeam?.id || null);
	const [saving, setSaving] = useState(false);
	const [activeDrag, setActiveDrag] = useState<DragData | null>(null);
	const [mobilePanel, setMobilePanel] = useState<"field" | "roster" | "stats">(
		"field",
	);
	const [selectedCharaId, setSelectedCharaId] = useState<string | null>(null);
	const [selectedMemberSlot, setSelectedMemberSlot] = useState<string | null>(
		null,
	);

	// ── Undo history ───────────────────────────────────
	const [history, setHistory] = useState<Array<Record<string, TeamMember>>>([]);
	const pushHistory = useCallback((state: Record<string, TeamMember>) => {
		setHistory((prev) => [...prev.slice(-19), state]);
	}, []);

	// ── Tap-to-select (mobile) ─────────────────────────
	const handleCharaTap = useCallback((char: PickerCharacter) => {
		setSelectedCharaId((prev) => (prev === char.charaId ? null : char.charaId));
		setMobilePanel("field");
	}, []);

	const handleSlotTap = useCallback(
		(slotId: string) => {
			if (!selectedCharaId) {return;}
			const char = characters.find((c) => c.charaId === selectedCharaId);
			if (!char) {return;}

			pushHistory({ ...members });
			setMembers((prev) => ({
				...prev,
				[slotId]: {
					charaId: char.charaId,
					element: char.element,
					imageUrl: char.imageUrl,
					name: char.name,
					position: char.position,
					rarity: char.rarity,
					slot: slotId,
					slug: char.slug,
					stats: char.stats,
				},
			}));
			setSelectedCharaId(null);
		},
		[selectedCharaId, characters, members, pushHistory],
	);

	const undo = useCallback(() => {
		setHistory((prev) => {
			if (prev.length === 0) {return prev;}
			const newHistory = [...prev];
			const last = newHistory.pop()!;
			setMembers(last);
			return newHistory;
		});
	}, []);

	// Ctrl+Z
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key === "z" && history.length > 0) {
				e.preventDefault();
				undo();
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [undo, history.length]);

	const formation = FORMATIONS[formationIdx];
	const fieldRef = useRef<HTMLDivElement>(null);

	// ── Auto-save to localStorage ──────────────────────
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	useEffect(() => {
		clearTimeout(saveTimerRef.current);
		saveTimerRef.current = setTimeout(() => {
			saveToLocalStorage(formationIdx, members, teamName);
		}, 500);
		return () => clearTimeout(saveTimerRef.current);
	}, [formationIdx, members, teamName]);

	// ── Sensors (Pointer + Touch + Keyboard) ───────────
	const pointerSensor = useSensor(PointerSensor, {
		activationConstraint: { distance: 5 },
	});
	const touchSensor = useSensor(TouchSensor, {
		activationConstraint: { delay: 200, tolerance: 5 },
	});
	const keyboardSensor = useSensor(KeyboardSensor, {
		coordinateGetter: sortableKeyboardCoordinates,
	});
	const sensors = useSensors(pointerSensor, touchSensor, keyboardSensor);

	// ── Placed IDs ─────────────────────────────────────
	const placedIds = useMemo(
		() => new Set(Object.values(members).map((m) => m.charaId)),
		[members],
	);

	// ── Drag handlers ──────────────────────────────────
	const handleDragStart = useCallback((event: DragStartEvent) => {
		setActiveDrag(event.active.data.current as DragData);
	}, []);

	const handleDragEnd = useCallback(
		(event: DragEndEvent) => {
			const { active, over } = event;
			setActiveDrag(null);
			if (!over) {return;}

			const dragData = active.data.current as DragData;
			const dropId = over.id as string;
			if (!over.data.current) {return;}

			// Save to undo before mutation
			pushHistory({ ...members });

			if (dragData.origin === "roster" && "character" in dragData) {
				const char = dragData.character;
				setMembers((prev) => ({
					...prev,
					[dropId]: {
						charaId: char.charaId,
						element: char.element,
						imageUrl: char.imageUrl,
						name: char.name,
						position: char.position,
						rarity: char.rarity,
						slot: dropId,
						slug: char.slug,
						stats: char.stats,
					},
				}));
			}

			if (
				(dragData.origin === "field" || dragData.origin === "bench") &&
				"member" in dragData
			) {
				const fromSlot = dragData.slotId;
				if (fromSlot === dropId) {return;}
				setMembers((prev) => {
					const next = { ...prev };
					const from = prev[fromSlot];
					const to = prev[dropId];
					if (from) {next[dropId] = { ...from, slot: dropId };}
					else {delete next[dropId];}
					if (to) {next[fromSlot] = { ...to, slot: fromSlot };}
					else {delete next[fromSlot];}
					return next;
				});
			}
		},
		[members, pushHistory],
	);

	// ── Member click (open detail panel) ────────────────
	const handleMemberClick = useCallback((slot: string) => {
		setSelectedMemberSlot((prev) => (prev === slot ? null : slot));
	}, []);

	// ── Remove ─────────────────────────────────────────
	const handleRemoveMember = useCallback(
		(slot: string) => {
			pushHistory({ ...members });
			setMembers((prev) => {
				const n = { ...prev };
				delete n[slot];
				return n;
			});
		},
		[members, pushHistory],
	);

	// ── Clear all ──────────────────────────────────────
	const handleClearAll = useCallback(() => {
		if (Object.keys(members).length === 0) {return;}
		pushHistory({ ...members });
		setMembers({});
	}, [members, pushHistory]);

	// ── Formation change ───────────────────────────────
	const handleFormationChange = useCallback(
		(idx: number) => {
			pushHistory({ ...members });
			setFormationIdx(idx);
			setMembers((prev) => {
				const next: Record<string, TeamMember> = {};
				for (const [slot, member] of Object.entries(prev)) {
					if (!slot.startsWith("field-")) {next[slot] = member;}
				}
				return next;
			});
		},
		[members, pushHistory],
	);

	// ── Auto-fill ──────────────────────────────────────
	const handleAutoFill = useCallback(() => {
		pushHistory({ ...members });
		const placed = new Set(Object.values(members).map((m) => m.charaId));
		const available = characters.filter((c) => !placed.has(c.charaId));

		// Sort by rarity (best first)
		available.sort(
			(a, b) => (RARITY_SCORE[b.rarity] || 0) - (RARITY_SCORE[a.rarity] || 0),
		);

		setMembers((prev) => {
			const next = { ...prev };
			const usedNow = new Set(placed);

			// Fill field positions
			for (const pos of formation.positions) {
				const slotId = `field-${pos.index}`;
				if (next[slotId]) {continue;}
				const match = available.find(
					(c) => c.position === pos.role && !usedNow.has(c.charaId),
				);
				if (match) {
					next[slotId] = {
						charaId: match.charaId,
						element: match.element,
						imageUrl: match.imageUrl,
						name: match.name,
						position: match.position,
						rarity: match.rarity,
						slot: slotId,
						slug: match.slug,
						stats: match.stats,
					};
					usedNow.add(match.charaId);
				}
			}

			// Fill reserves
			for (let i = 0; i < 5; i++) {
				const slotId = `reserve-${i}`;
				if (next[slotId]) {continue;}
				const match = available.find((c) => !usedNow.has(c.charaId));
				if (match) {
					next[slotId] = {
						charaId: match.charaId,
						element: match.element,
						imageUrl: match.imageUrl,
						name: match.name,
						position: match.position,
						rarity: match.rarity,
						slot: slotId,
						slug: match.slug,
						stats: match.stats,
					};
					usedNow.add(match.charaId);
				}
			}

			return next;
		});
		toast.success("Équipe auto-remplie");
	}, [characters, members, formation.positions, pushHistory]);

	// ── Save ───────────────────────────────────────────
	const handleSave = useCallback(async () => {
		const name = teamName.trim() || "Mon équipe";
		const data: TeamData = {
			formationId: formation.id,
			members: Object.values(members),
		};
		setSaving(true);
		try {
			if (teamId) {
				const result = await updateTeam(teamId, name, data);
				if ("error" in result) {toast.error(result.error);}
				else {toast.success("Équipe mise à jour");}
			} else {
				const result = await saveTeam(name, data);
				if ("error" in result) {toast.error(result.error);}
				else {
					setTeamId(result.id);
					toast.success("Équipe sauvegardée");
				}
			}
		} catch {
			toast.error("Erreur lors de la sauvegarde");
		}
		setSaving(false);
	}, [teamName, formation.id, members, teamId]);

	// ── Delete ─────────────────────────────────────────
	const handleDelete = useCallback(async () => {
		if (!teamId || !window.confirm("Supprimer cette équipe ?")) {return;}
		const result = await deleteTeam(teamId);
		if ("error" in result) {toast.error(result.error);}
		else {
			setTeamId(null);
			setMembers({});
			setTeamName("");
			toast.success("Équipe supprimée");
		}
	}, [teamId]);

	// ── Export ─────────────────────────────────────────
	const handleExport = useCallback(async () => {
		if (!fieldRef.current) {return;}
		try {
			const dataUrl = await toPng(fieldRef.current, {
				backgroundColor: "#064e3b",
				cacheBust: true,
				filter: (node) => !node.classList?.contains("no-export"),
				pixelRatio: 3,
			});
			const link = document.createElement("a");
			link.download = `${teamName || "mon-equipe"}-${formation.id}.png`;
			link.href = dataUrl;
			link.click();
			toast.success("Image exportée (3x)");
		} catch {
			toast.error("Erreur lors de l'export");
		}
	}, [formation.id, teamName]);

	// ── Share URL ──────────────────────────────────────
	const handleShare = useCallback(async () => {
		const encoded = encodeTeamToURL(formation.id, members);
		const url = `${window.location.origin}${window.location.pathname}?t=${encoded}`;
		try {
			await navigator.clipboard.writeText(url);
			toast.success("Lien de partage copié");
		} catch {
			/* Silent */
		}
	}, [formation.id, members]);

	const memberCount = Object.keys(members).length;

	return (
		<DndContext
			sensors={sensors}
			collisionDetection={customCollision}
			onDragStart={handleDragStart}
			onDragEnd={handleDragEnd}
		>
			<div className="w-full space-y-4">
				{/* Header */}
				<div className="space-y-2">
					<div className="flex items-center gap-3">
						<div className="min-w-0 flex-1">
							<input
								type="text"
								value={teamName}
								onChange={(e) => setTeamName(e.target.value)}
								placeholder="Nom de l'équipe..."
								aria-label="Nom de l'équipe"
								className="w-full bg-transparent font-[BradBunR] text-2xl sm:text-3xl md:text-4xl text-on-surface tracking-wide border-none focus:outline-hidden placeholder:text-on-surface-variant/30"
							/>
						</div>
						{isAuthenticated && (
							<button
								onClick={handleSave}
								disabled={saving}
								aria-label={teamId ? "Sauvegarder l'équipe" : "Créer l'équipe"}
								className="inline-flex items-center gap-2 h-11 sm:h-12 px-5 sm:px-6 rounded-2xl bg-primary text-on-primary font-bold text-sm elevation-2 hover:elevation-3 active:scale-[0.97] transition-all disabled:opacity-50 shrink-0"
							>
								<Icon name={teamId ? "save" : "add"} size={18} />
								<span className="hidden sm:inline">
									{teamId ? "Sauvegarder" : "Créer"}
								</span>
							</button>
						)}
					</div>

					{/* Quick stats strip + actions */}
					<div className="flex items-center justify-between gap-2">
						<div className="flex items-center gap-2 text-xs text-on-surface-variant">
							<span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-high font-bold">
								<Icon name="group" size={14} />
								{memberCount}/20
							</span>
							<span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-high font-medium">
								{formation.name}
							</span>
						</div>
						<div className="flex items-center gap-1">
							{history.length > 0 && (
								<button
									onClick={undo}
									className="p-2 rounded-full bg-surface-container-high state-layer text-on-surface-variant"
									title={`Annuler (${history.length})`}
									aria-label={`Annuler la dernière action (${history.length} restantes)`}
								>
									<Icon name="undo" size={18} />
								</button>
							)}
							<button
								onClick={handleAutoFill}
								className="p-2 rounded-full bg-surface-container-high state-layer text-on-surface-variant"
								title="Auto-remplir"
								aria-label="Auto-remplir l'équipe"
							>
								<Icon name="auto_fix_high" size={18} />
							</button>
							{memberCount > 0 && (
								<button
									onClick={handleClearAll}
									className="p-2 rounded-full bg-surface-container-high state-layer text-on-surface-variant"
									title="Tout effacer"
									aria-label="Retirer tous les joueurs"
								>
									<Icon name="delete_sweep" size={18} />
								</button>
							)}
							<button
								onClick={handleExport}
								className="p-2 rounded-full bg-surface-container-high state-layer text-on-surface-variant"
								title="Exporter en image"
								aria-label="Exporter l'équipe en image PNG"
							>
								<Icon name="download" size={18} />
							</button>
							<button
								onClick={handleShare}
								className="p-2 rounded-full bg-surface-container-high state-layer text-on-surface-variant"
								title="Partager"
								aria-label="Copier le lien de partage"
							>
								<Icon name="share" size={18} />
							</button>
							{teamId && (
								<button
									onClick={handleDelete}
									className="p-2 rounded-full bg-error-container text-on-error-container state-layer"
									title="Supprimer"
									aria-label="Supprimer l'équipe"
								>
									<Icon name="delete" size={18} />
								</button>
							)}
						</div>
					</div>
				</div>

				{/* Selected character banner */}
				{selectedCharaId &&
					(() => {
						const selChar = characters.find(
							(c) => c.charaId === selectedCharaId,
						);
						return (
							<div className="flex items-center gap-3 p-2.5 rounded-2xl bg-primary-container/90 backdrop-blur-sm elevation-2">
								{selChar && (
									<div className="relative size-10 rounded-xl overflow-hidden shrink-0 ring-2 ring-primary">
										<Image
											src={selChar.imageUrl}
											alt={selChar.name}
											width={40}
											height={40}
											sizes="40px"
											className="w-full h-full object-cover"
										/>
									</div>
								)}
								<div className="flex-1 min-w-0">
									<p className="text-sm font-bold text-on-primary-container truncate">
										{selChar?.name || "Joueur"}
									</p>
									<p className="text-[10px] text-on-primary-container/70 flex items-center gap-1">
										<Icon name="touch_app" size={12} />
										Touchez un emplacement
									</p>
								</div>
								<button
									onClick={() => setSelectedCharaId(null)}
									className="p-2 rounded-full hover:bg-on-primary-container/10 text-on-primary-container"
								>
									<Icon name="close" size={18} />
								</button>
							</div>
						);
					})()}

				{/* Not authenticated banner */}
				{!isAuthenticated && !selectedCharaId && (
					<div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-tertiary-container/30 text-on-surface-variant text-xs">
						<Icon name="info" size={16} className="shrink-0" />
						<span>
							Sauvegarde locale —{" "}
							<Link
								href="/login?returnTo=/tools/my-team"
								className="text-primary font-bold hover:underline"
							>
								connectez-vous
							</Link>{" "}
							pour sauvegarder en ligne.
						</span>
					</div>
				)}

				{/* Formation picker — horizontal scroll on all sizes */}
				<div>
					<p className="type-label-medium text-on-surface-variant mb-1.5">
						Formation
					</p>
					<div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
						{FORMATIONS.map((f, i) => {
							const isActive = i === formationIdx;
							return (
								<button
									key={f.id}
									onClick={() => handleFormationChange(i)}
									aria-label={`Formation ${f.name}`}
									aria-pressed={isActive}
									className={cn(
										"inline-flex items-center gap-1.5 h-10 pl-1.5 pr-3 rounded-xl text-xs font-bold transition-all shrink-0",
										isActive
											? "bg-secondary-container text-on-secondary-container elevation-1"
											: "border border-outline/40 text-on-surface-variant hover:bg-on-surface/[0.08]",
									)}
								>
									<FormationMiniPreview formation={f} />
									<span>{f.name}</span>
								</button>
							);
						})}
					</div>
				</div>

				{/* Mobile tab switcher — Material 3 segmented button */}
				<div
					className="relative flex lg:hidden h-12 rounded-2xl bg-surface-container-high/80 p-1 overflow-hidden"
					role="tablist"
					aria-label="Panneaux du Team Builder"
				>
					{/* Animated pill indicator */}
					{(() => {
						const tabIndex =
							mobilePanel === "field" ? 0 : (mobilePanel === "roster" ? 1 : 2);
						return (
							<div
								className="absolute top-1 bottom-1 rounded-xl bg-primary transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
								style={{
									left: `calc(4px + ${tabIndex} * (100% - 8px) / 3)`,
									width: "calc((100% - 8px) / 3)",
								}}
							/>
						);
					})()}
					{[
						{ icon: "stadium", key: "field" as const, label: "Terrain" },
						{ icon: "group", key: "roster" as const, label: "Joueurs" },
						{ icon: "analytics", key: "stats" as const, label: "Stats" },
					].map((tab) => (
						<button
							key={tab.key}
							onClick={() => setMobilePanel(tab.key)}
							role="tab"
							aria-selected={mobilePanel === tab.key}
							aria-label={`Afficher le panneau ${tab.label}`}
							className={cn(
								"relative z-10 flex-1 flex items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition-colors duration-200",
								mobilePanel === tab.key
									? "text-on-primary"
									: "text-on-surface-variant",
							)}
						>
							<Icon name={tab.icon} size={16} />
							{tab.label}
						</button>
					))}
				</div>

				{/* Main layout */}
				<div className="flex gap-4 lg:gap-5">
					{/* Left: field + stats */}
					<div
						className={cn(
							"w-full lg:w-[55%] xl:w-[50%] shrink-0 space-y-3",
							mobilePanel === "roster" && "hidden lg:block",
							mobilePanel === "stats" && "hidden lg:block",
						)}
					>
						{/* Edge-to-edge pitch on mobile */}
						<div className="-mx-4 sm:mx-0">
							<FormationField
								formation={formation}
								members={members}
								onRemoveMember={handleRemoveMember}
								fieldRef={fieldRef}
								teamName={teamName}
								onSlotTap={handleSlotTap}
								selectedCharaId={selectedCharaId}
								onMemberClick={handleMemberClick}
								selectedMemberSlot={selectedMemberSlot}
							/>
						</div>

						{/* Player detail panel */}
						{selectedMemberSlot && members[selectedMemberSlot] && (
							<div className="px-4 sm:px-0">
								<PlayerDetailPanel
									member={members[selectedMemberSlot]}
									onClose={() => setSelectedMemberSlot(null)}
									onRemove={handleRemoveMember}
								/>
							</div>
						)}

						{/* Stats (desktop only — mobile has own tab) */}
						<div className="hidden lg:block">
							<TeamStats members={members} formation={formation} />
						</div>
					</div>

					{/* Right: character picker */}
					<div
						className={cn(
							"flex-1 min-w-0 bg-surface-container rounded-2xl elevation-1 overflow-hidden",
							"lg:max-h-[calc(100vh-200px)] lg:sticky lg:top-20",
							mobilePanel !== "roster" && "hidden lg:flex lg:flex-col",
							mobilePanel === "roster" && "flex flex-col",
						)}
					>
						<CharacterPicker
							characters={characters}
							placedIds={placedIds}
							selectedCharaId={selectedCharaId}
							onCharaTap={handleCharaTap}
						/>
					</div>

					{/* Mobile stats tab */}
					{mobilePanel === "stats" && (
						<div className="w-full lg:hidden space-y-3">
							<TeamStats members={members} formation={formation} />
							{/* Mobile action cards */}
							<div className="grid grid-cols-2 gap-2">
								<button
									onClick={handleExport}
									className="flex items-center justify-center gap-2.5 py-3.5 rounded-2xl bg-surface-container elevation-1 text-on-surface text-sm font-bold active:scale-[0.97] transition-transform"
								>
									<Icon name="download" size={20} /> Exporter
								</button>
								<button
									onClick={handleShare}
									className="flex items-center justify-center gap-2.5 py-3.5 rounded-2xl bg-surface-container elevation-1 text-on-surface text-sm font-bold active:scale-[0.97] transition-transform"
								>
									<Icon name="share" size={20} /> Partager
								</button>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Drag Overlay */}
			<DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
				{activeDrag?.origin === "roster" && "character" in activeDrag && (
					<CharacterPickerOverlay char={activeDrag.character} />
				)}
				{activeDrag &&
					(activeDrag.origin === "field" || activeDrag.origin === "bench") &&
					"member" in activeDrag && (
						<PlayerSlotOverlay member={activeDrag.member} />
					)}
			</DragOverlay>
		</DndContext>
	);
}
