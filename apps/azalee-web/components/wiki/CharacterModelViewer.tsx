"use client";

import { Box } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
	Button,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@rose-griffon/ui";

interface CharacterModelViewerProps {
	/** URL absolue du GLB complet (cdn.rosegriffon.fr/model-full/<code>.glb, nie-model-serve). */
	glbUrl: string;
	name?: string;
}

// Bundle <model-viewer> auto-hébergé (public/vendor) — pas de dépendance npm ni de
// CDN tiers (CSP reste script-src 'self'). Chargé une seule fois, à l'ouverture.
const MODEL_VIEWER_SRC = "/vendor/model-viewer.min.js";

let modelViewerLoading: Promise<void> | null = null;

function loadModelViewer(): Promise<void> {
	if (typeof window === "undefined") {
		return Promise.resolve();
	}
	if (window.customElements?.get("model-viewer")) {
		return Promise.resolve();
	}
	if (modelViewerLoading) {
		return modelViewerLoading;
	}
	modelViewerLoading = new Promise<void>((resolve, reject) => {
		const existing = document.querySelector<HTMLScriptElement>(
			`script[src="${MODEL_VIEWER_SRC}"]`
		);
		if (existing) {
			existing.addEventListener("load", () => resolve());
			existing.addEventListener("error", () => reject(new Error("model-viewer load failed")));
			return;
		}
		const script = document.createElement("script");
		script.src = MODEL_VIEWER_SRC;
		script.async = true;
		script.addEventListener("load", () => resolve());
		script.addEventListener("error", () => reject(new Error("model-viewer load failed")));
		document.head.appendChild(script);
	});
	return modelViewerLoading;
}

export default function CharacterModelViewer({ glbUrl, name }: CharacterModelViewerProps) {
	const [open, setOpen] = useState(false);
	const [ready, setReady] = useState(false);
	const [errored, setErrored] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	// Charge le custom element à la 1re ouverture, puis injecte <model-viewer>.
	useEffect(() => {
		if (!open) {
			return;
		}
		// Reset de l'état d'erreur à chaque (ré)ouverture : sinon un échec antérieur
		// (GLB 404/réseau) laisserait l'overlay « indisponible » collé après réouverture.
		setErrored(false);
		let cancelled = false;
		loadModelViewer()
			.then(() => {
				if (!cancelled) {
					setReady(true);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setErrored(true);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [open]);

	// Monte l'élément impérativement (custom element non typé par React/JSX).
	useEffect(() => {
		if (!open || !ready || !containerRef.current) {
			return;
		}
		const host = containerRef.current;
		host.innerHTML = "";
		const mv = document.createElement("model-viewer");
		mv.setAttribute("src", glbUrl);
		mv.setAttribute("alt", `Modèle 3D de ${name ?? "personnage"}`);
		mv.setAttribute("camera-controls", "");
		mv.setAttribute("auto-rotate", "");
		mv.setAttribute("rotation-per-second", "30deg");
		mv.setAttribute("shadow-intensity", "1");
		mv.setAttribute("exposure", "1");
		mv.setAttribute("touch-action", "pan-y");
		mv.style.width = "100%";
		mv.style.height = "100%";
		mv.style.backgroundColor = "transparent";
		mv.addEventListener("error", () => setErrored(true));
		host.appendChild(mv);
		return () => {
			host.innerHTML = "";
		};
	}, [open, ready, glbUrl, name]);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="size-8 text-on-surface-variant hover:text-primary"
				>
					<Box className="size-4" />
					<span className="sr-only">Voir le modèle 3D de {name}</span>
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[420px] bg-surface p-0 overflow-hidden border-outline-variant rounded-xl sm:rounded-2xl">
				{/* `pointer-events-none` sur le bandeau + `pr-10` laissent le bouton de
				    fermeture (coin haut-droit du DialogContent, sous ce header en z-10)
				    cliquable ; seul le titre capte les events. */}
				<DialogHeader className="p-4 pr-10 bg-surface-container/80 absolute top-0 w-full z-10 backdrop-blur-sm border-b border-outline-variant/20 pointer-events-none">
					<DialogTitle className="text-on-surface flex items-center gap-2 text-base pointer-events-auto">
						<Box className="size-4 text-primary" />
						{name || "Modèle 3D"}
					</DialogTitle>
				</DialogHeader>

				<div className="aspect-[3/4] relative bg-[url(/fond.webp)] bg-cover bg-center">
					<div ref={containerRef} className="absolute inset-0" />

					{!ready && !errored && (
						<div className="absolute inset-0 flex items-center justify-center bg-surface/50">
							<div className="animate-spin rounded-full size-8 border-b-2 border-primary" />
						</div>
					)}

					{errored && (
						<div className="absolute inset-0 flex items-center justify-center p-6 text-center">
							<span className="text-sm text-on-surface-variant">
								Modèle 3D indisponible.
							</span>
						</div>
					)}

					{ready && !errored && (
						<div className="absolute bottom-3 left-0 right-0 text-center pointer-events-none">
							<span className="text-xs text-on-surface-variant/60 bg-surface/40 px-2 py-1 rounded">
								Glissez pour tourner · molette pour zoomer
							</span>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
