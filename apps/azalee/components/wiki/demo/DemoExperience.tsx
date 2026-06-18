"use client";

/**
 * ORCHESTRATEUR de la démo 3D (`/demo`). Généralise `CutinViewer` : réutilise le MÊME moteur
 * `CutinScene` (R3F + caméra scénarisée + Bloom + Theatre + export MP4) comme scène unique, et
 * n'ajoute qu'une couche d'orchestration au-dessus de l'infra existante (`lib/cutin/*`,
 * `lib/nie-engine`, `lib/cpk/shared`, `lib/skills-cutin`).
 *
 * CONTRAINTE (vérifiée dans `CutinScene.fitObject`) : chaque GLB est recentré/normalisé à ~2 u
 * INDIVIDUELLEMENT → la scène n'affiche qu'UNE option à la fois (forme seule = mesh normal ; cut-in
 * = waza + couches d'effet superposées). La composition spatiale perso+waza est hors-scope.
 *
 * Frontière stricte : que des libs PURES/client-safe ; la scène R3F est chargée via
 * `next/dynamic { ssr:false }` et montée À LA DEMANDE (lazy).
 */
import { Box, Download, Film, Loader2, Pause, Play, RotateCcw, Sparkles } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { defaultCutinShots, type CutinStoryboard } from "@/lib/cutin/camera";
import {
	downloadBlob,
	exportCutinVideo,
	isVideoExportSupported,
	type CutinAudioSource,
} from "@/lib/cutin/export";
import { fetchCutinManifest } from "@/lib/cutin/listing";
import { loadCutinStoryboard } from "@/lib/cutin/decode";
import { createTheatreSequencer } from "@/lib/cutin/theatre-sequencer";
import type { CutinGlbLayer, CutinManifest } from "@/lib/cutin/types";
import { getSkillCutin } from "@/lib/skills-cutin";
import type { CutinSceneHandle } from "@/components/wiki/cutin/CutinScene";
import { DemoModelSelector } from "./DemoModelSelector";
import { DemoSkillsSection } from "./DemoSkillsSection";
import { DemoStatsPanel } from "./DemoStatsPanel";
import { DemoTextureGallery } from "./DemoTextureGallery";
import { DemoVoicePlayer } from "./DemoVoicePlayer";
import type { DemoData, DemoModelOption, DemoSkill } from "./types";

// La scène R3F n'est chargée QUE côté client (chunk WebGL/wasm lourd) — jamais en SSR.
const CutinScene = dynamic(() => import("@/components/wiki/cutin/CutinScene"), {
	ssr: false,
	loading: () => <SceneSkeleton />,
});

/** Squelette pendant le chargement du chunk R3F. */
function SceneSkeleton(): React.JSX.Element {
	return (
		<div className="flex aspect-square w-full items-center justify-center rounded-xl bg-surface-container-high">
			<Loader2 className="size-8 animate-spin text-primary" />
		</div>
	);
}

/** Attend la prochaine peinture (laisse React appliquer scrub/orbit off avant l'export). */
function nextPaint(): Promise<void> {
	return new Promise((resolve) => {
		requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
	});
}

/** Couche GLB depuis une option (URL directe, aucun décode — cf. `mainModelLayer`). */
function optionLayer(o: DemoModelOption): CutinGlbLayer {
	return { id: o.id, blobUrl: o.glbUrl, fromEffect: o.fromEffect, revocable: false };
}

/** Manifeste stub pour une FORME : `CutinScene` ne lit que `manifest.eventId` (clé du sheet). */
function formManifest(code: string): CutinManifest {
	return {
		eventId: `demo-${code}`,
		effectsDir: "",
		modelGlbUrl: "",
		cameraG4cmUrl: null,
		layers: [],
		telops: [],
		soundRawUrl: null,
	};
}

/** Manifeste stub pour un waza sans entrée cut-in résolvable (mesh seul, caméra générique). */
function wazaStubManifest(o: DemoModelOption): CutinManifest {
	return {
		eventId: o.eventIdName ?? o.id,
		effectsDir: "",
		modelGlbUrl: o.glbUrl,
		cameraG4cmUrl: null,
		layers: [],
		telops: [],
		soundRawUrl: null,
	};
}

export function DemoExperience({ data }: { data: DemoData }): React.JSX.Element {
	// --- Registre d'options : formes (mesh normal) + cut-ins 3D servis (mesh émissif). ---
	const options = useMemo<DemoModelOption[]>(() => {
		const forms: DemoModelOption[] = data.forms.map((f) => ({
			id: `form:${f.code}`,
			label: f.label,
			kind: "form",
			code: f.code,
			glbUrl: f.modelGlbUrl,
			fromEffect: false,
			voiceUrl: f.voiceUrl,
			iconUrl: f.iconUrl,
			eventIdName: null,
		}));
		const wazas: DemoModelOption[] = data.skills
			.filter((s) => s.has3d)
			.map((s) => ({
				id: `waza:${s.eventIdName}`,
				label: `${s.elementName.fr} ${s.categoryName.fr}`,
				kind: "waza",
				code: s.eventIdName,
				glbUrl: s.wazaGlbUrl,
				fromEffect: true,
				voiceUrl: null,
				iconUrl: s.textureUrl,
				eventIdName: s.eventIdName,
			}));
		return [...forms, ...wazas];
	}, [data.forms, data.skills]);

	const optionById = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
	const skillByEvent = useMemo(
		() => new Map(data.skills.map((s) => [s.eventIdName, s])),
		[data.skills],
	);

	// --- État scène (calque sur CutinViewer). ---
	const [mounted, setMounted] = useState(false);
	const [selectedId, setSelectedId] = useState<string>(options[0]?.id ?? "");
	const [manifest, setManifest] = useState<CutinManifest | null>(null);
	const [storyboard, setStoryboard] = useState<CutinStoryboard | null>(null);
	const [glbLayers, setGlbLayers] = useState<CutinGlbLayer[]>([]);
	const [visibility, setVisibility] = useState<Record<string, boolean>>({});
	const [activeTelop, setActiveTelop] = useState<string | null>(null);

	const [bloom, setBloom] = useState(true);
	const [orbit, setOrbit] = useState(false);
	const [playing, setPlaying] = useState(true);
	const [scrubSec, setScrubSec] = useState<number | null>(null);
	const [displayPos, setDisplayPos] = useState(0);
	const [shotName, setShotName] = useState("");

	const [exporting, setExporting] = useState(false);
	const [exportPct, setExportPct] = useState(0);
	const canExport = useMemo(() => isVideoExportSupported(), []);

	const handleRef = useRef<CutinSceneHandle | null>(null);
	const currentOption = optionById.get(selectedId);

	// --- Chargement de l'option courante une fois la scène montée (forme synchrone, waza async). ---
	useEffect(() => {
		if (!mounted) return;
		const opt = optionById.get(selectedId);
		if (!opt) return;

		if (opt.kind === "form") {
			setManifest(formManifest(opt.code));
			setStoryboard(defaultCutinShots());
			setGlbLayers([optionLayer(opt)]);
			setVisibility({ [opt.id]: true });
			setActiveTelop(null);
			setPlaying(true);
			setScrubSec(null);
			return;
		}

		// Cut-in : on réutilise l'infra (manifeste réel → eventId + caméra g4cm + telops).
		const ac = new AbortController();
		(async () => {
			try {
				const skill = opt.eventIdName ? skillByEvent.get(opt.eventIdName) : undefined;
				const cutin = skill ? (getSkillCutin(skill.skillIdStr)?.cutin ?? null) : null;
				let m: CutinManifest;
				let story: CutinStoryboard;
				if (cutin) {
					m = await fetchCutinManifest(cutin, ac.signal);
					story = await loadCutinStoryboard(m, ac.signal);
				} else {
					m = wazaStubManifest(opt);
					story = defaultCutinShots();
				}
				if (ac.signal.aborted) return;
				setManifest(m);
				setStoryboard(story);
				setGlbLayers([optionLayer(opt)]);
				setVisibility({ [opt.id]: true });
				setActiveTelop(skill?.telopUrl ?? null);
				setPlaying(true);
				setScrubSec(null);
			} catch (err) {
				if (err instanceof DOMException && err.name === "AbortError") return;
				// Repli : mesh seul + caméra générique.
				setManifest(wazaStubManifest(opt));
				setStoryboard(defaultCutinShots());
				setGlbLayers([optionLayer(opt)]);
				setVisibility({ [opt.id]: true });
			}
		})();
		return () => ac.abort();
	}, [mounted, selectedId, optionById, skillByEvent]);

	// Slider/overlay : suit la position de la timeline pendant la lecture.
	useEffect(() => {
		if (!playing || scrubSec != null) return;
		let raf = 0;
		const tick = () => {
			const h = handleRef.current;
			const dur = storyboard?.duration ?? 0;
			if (h && dur > 0) setDisplayPos(h.sequence.position % dur);
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [playing, scrubSec, storyboard]);

	const onReady = useCallback((h: CutinSceneHandle) => {
		handleRef.current = h;
	}, []);

	// Sélection d'une option (forme ou waza) → monte la scène si besoin.
	const onSelect = useCallback((id: string) => {
		setMounted(true);
		setSelectedId(id);
	}, []);

	// Lancement d'un cut-in depuis la section Techniques (pilote la scène héro).
	const launchCutin = useCallback((skill: DemoSkill) => {
		setMounted(true);
		setSelectedId(`waza:${skill.eventIdName}`);
		// Remonte vers la scène pour voir le résultat.
		if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
	}, []);

	const resetCamera = useCallback(() => {
		setOrbit(false);
		setScrubSec(null);
		setPlaying(true);
	}, []);

	const onScrub = useCallback((value: number) => {
		setPlaying(false);
		setScrubSec(value);
		setDisplayPos(value);
	}, []);

	const togglePlay = useCallback(() => {
		setPlaying((p) => {
			const next = !p;
			if (next) setScrubSec(null);
			return next;
		});
	}, []);

	// Export MP4 (copie de CutinViewer.handleExport) + piste audio = voix de la forme courante.
	const handleExport = useCallback(async () => {
		const h = handleRef.current;
		if (!h || !storyboard || exporting) return;
		setExporting(true);
		setExportPct(0);
		setOrbit(false);
		setPlaying(false);
		setScrubSec(null);
		await nextPaint();
		h.setFrameloop("never");
		try {
			let audio: CutinAudioSource | undefined;
			const voiceUrl = currentOption?.voiceUrl;
			if (voiceUrl) {
				const r = await fetch(voiceUrl);
				if (r.ok) audio = { wav: new Uint8Array(await r.arrayBuffer()) }; // `/audio` renvoie du WAV
			}
			const renderAt = createTheatreSequencer({ sequence: h.sequence, r3f: h });
			const blob = await exportCutinVideo({
				canvas: h.gl.domElement,
				durationSec: storyboard.duration,
				fps: storyboard.fps,
				renderAt,
				audio,
				onProgress: (done, total) => setExportPct(done / total),
			});
			downloadBlob(blob, `aphrodi_${currentOption?.code ?? "demo"}`);
		} catch {
			/* échec d'encodage : on retombe sur l'état interactif sans bloquer l'UI */
		} finally {
			h.setFrameloop("always");
			setExporting(false);
			setPlaying(true);
		}
	}, [storyboard, exporting, currentOption]);

	const duration = storyboard?.duration ?? 0;
	const fps = storyboard?.fps ?? 60;
	const poster = data.forms[0]?.iconUrl ?? data.forms[0]?.faceTextureUrl ?? null;

	return (
		<div className="space-y-6">
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				{/* Colonne scène. */}
				<div className="space-y-2">
					<div className="relative aspect-square w-full overflow-hidden rounded-xl bg-surface-container-high">
						{!mounted ? (
							<button
								type="button"
								onClick={() => setMounted(true)}
								className="group absolute inset-0 size-full"
							>
								{poster && (
									// eslint-disable-next-line @next/next/no-img-element
									<img
										src={poster}
										alt="Aperçu"
										className="absolute inset-0 size-full object-cover opacity-30 blur-sm [image-rendering:pixelated]"
									/>
								)}
								<span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-on-surface">
									<Sparkles className="size-10 text-primary transition-transform group-hover:scale-110" />
									<span className="text-sm font-semibold">Charger la scène 3D</span>
									<span className="text-xs text-on-surface-variant">
										modèles · cut-ins · timeline · export MP4
									</span>
								</span>
							</button>
						) : storyboard && manifest ? (
							<CutinScene
								manifest={manifest}
								storyboard={storyboard}
								glbLayers={glbLayers}
								visibility={visibility}
								bloom={bloom}
								orbit={orbit && !exporting}
								playing={playing}
								scrubSec={scrubSec}
								onShot={setShotName}
								onReady={onReady}
							/>
						) : (
							<SceneSkeleton />
						)}
						{/* Overlay plan courant. */}
						{mounted && shotName && (
							<span className="pointer-events-none absolute left-2 top-2 rounded bg-surface/60 px-2 py-0.5 font-mono text-xs text-on-surface-variant backdrop-blur">
								{shotName}
							</span>
						)}
						{/* Telop du cut-in courant. */}
						{mounted && activeTelop && (
							// eslint-disable-next-line @next/next/no-img-element
							<img
								src={activeTelop}
								alt="Telop"
								className="pointer-events-none absolute inset-x-3 bottom-3 mx-auto aspect-[24/5] w-3/4 object-contain drop-shadow"
							/>
						)}
						{/* Progression d'export. */}
						{exporting && (
							<div className="absolute inset-x-0 bottom-0 h-1.5 bg-surface/40">
								<div
									className="h-full bg-primary transition-[width]"
									style={{ width: `${Math.round(exportPct * 100)}%` }}
								/>
							</div>
						)}
					</div>

					{/* Timeline : play/pause + scrub. */}
					{mounted && (
						<>
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={togglePlay}
									className="inline-flex size-8 items-center justify-center rounded-full bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
									title={playing ? "Pause" : "Lecture"}
								>
									{playing ? <Pause className="size-4" /> : <Play className="size-4" />}
								</button>
								<input
									type="range"
									min={0}
									max={duration || 1}
									step={1 / fps}
									value={scrubSec ?? displayPos}
									onChange={(e) => onScrub(Number(e.target.value))}
									className="h-1 flex-1 accent-primary"
									aria-label="Position de la timeline"
								/>
								<span className="w-12 text-right font-mono text-xs text-on-surface-variant">
									{(scrubSec ?? displayPos).toFixed(1)}s
								</span>
							</div>

							{/* Actions : bloom, orbit, reset, download GLB, export. */}
							<div className="flex flex-wrap items-center gap-1.5">
								<button
									type="button"
									onClick={() => setBloom((b) => !b)}
									className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
										bloom
											? "bg-primary text-on-primary"
											: "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
									}`}
								>
									<Sparkles className="size-3" /> Bloom
								</button>
								<button
									type="button"
									onClick={() => setOrbit((o) => !o)}
									className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
										orbit
											? "bg-primary text-on-primary"
											: "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
									}`}
									title="Caméra libre (orbit)"
								>
									<Box className="size-3" /> Orbit
								</button>
								<button
									type="button"
									onClick={resetCamera}
									className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2.5 py-1 text-xs font-medium text-on-surface-variant hover:bg-surface-container-highest"
									title="Réinitialiser la caméra"
								>
									<RotateCcw className="size-3" /> Reset
								</button>
								{currentOption && (
									<a
										href={currentOption.glbUrl}
										download={`${currentOption.code}.glb`}
										className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2.5 py-1 text-xs font-medium text-on-surface-variant hover:bg-surface-container-highest"
										title="Télécharger le modèle (GLB)"
									>
										<Download className="size-3" /> GLB
									</a>
								)}
								{canExport && (
									<button
										type="button"
										onClick={() => void handleExport()}
										disabled={exporting}
										className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-on-primary hover:opacity-90 disabled:opacity-50"
										title="Exporter en MP4 (avec voix si forme)"
									>
										{exporting ? (
											<Loader2 className="size-3 animate-spin" />
										) : (
											<Film className="size-3" />
										)}
										{exporting ? `Export ${Math.round(exportPct * 100)}%` : "Exporter MP4"}
									</button>
								)}
							</div>
						</>
					)}
				</div>

				{/* Colonne sélecteur + voix. */}
				<div className="space-y-4">
					<div className="space-y-2">
						<h2 className="text-sm font-bold text-on-surface">
							Modèles ({options.length}) — un à la fois
						</h2>
						<DemoModelSelector options={options} selectedId={selectedId} onSelect={onSelect} />
						<p className="text-[11px] text-on-surface-variant/70">
							Chaque GLB est recentré individuellement : la scène affiche une forme OU un cut-in à la
							fois (pas de composition spatiale).
						</p>
					</div>
					<DemoVoicePlayer forms={data.forms} />
				</div>
			</div>

			{/* Statistiques (moteur niers). */}
			<DemoStatsPanel forms={data.forms} precomputed={data.precomputedStats} />

			{/* Techniques (pilotent la scène héro). */}
			<DemoSkillsSection
				skills={data.skills}
				activeEventId={currentOption?.eventIdName ?? null}
				onPlayCutin={launchCutin}
			/>

			{/* Textures téléchargeables. */}
			<DemoTextureGallery textures={data.textures} />
		</div>
	);
}
