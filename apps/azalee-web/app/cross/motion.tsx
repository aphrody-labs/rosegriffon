"use client";

/**
 * Primitives d'animation pour la page /cross.
 *
 * Reproduisent fidèlement les animations du site officiel inazuma-cross.jp :
 *  - Reveal : éléments `.animation` → `.is-action` au scroll (IntersectionObserver,
 *    seuil 65 % du viewport, 85 % pour les blocs « system »). Effet `fadeup`
 *    (translateY(20→0)+opacity) — cf. home.css @keyframes fadeup.
 *  - KenBurns : boucle lente du key visual (équivalent @keyframes bgLoop : pan/zoom continu).
 *  - StampPop : tampons « 達成 » des récompenses (scale 2.5→0.9→1.05→1, staggered) — @keyframes stamp-pop.
 *  - Carousel : remplace Swiper 11 (slidesPerView auto, navigation prev/next + dots).
 *  - Float : flottement doux des éléments décoratifs.
 *
 * Tout respecte `prefers-reduced-motion` (motion/react `useReducedMotion`).
 */

import { useReducedMotion, motion, type Variants } from "motion/react";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";

// fadeup : translateY(20px)+opacity 0 → 0+1, cubic-bezier proche du site (ease-out doux).
const FADEUP: Variants = {
	hidden: { opacity: 0, y: 24 },
	show: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
	},
};

const FADEUP_BLUR: Variants = {
	hidden: { opacity: 0, y: 16, filter: "blur(12px)" },
	show: {
		opacity: 1,
		y: 0,
		filter: "blur(0px)",
		transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
	},
};

export function Reveal({
	children,
	className,
	delay = 0,
	blur = false,
	as = "div",
	amount = 0.35,
}: {
	children: ReactNode;
	className?: string;
	delay?: number;
	blur?: boolean;
	as?: "div" | "section" | "li" | "article";
	amount?: number;
}) {
	const reduce = useReducedMotion();
	const MotionTag = motion[as] as typeof motion.div;
	if (reduce) {
		const Tag = as;
		return <Tag className={className}>{children}</Tag>;
	}
	return (
		<MotionTag
			className={className}
			variants={blur ? FADEUP_BLUR : FADEUP}
			initial="hidden"
			whileInView="show"
			viewport={{ once: true, amount }}
			transition={{ delay }}
		>
			{children}
		</MotionTag>
	);
}

/** Conteneur qui décale (stagger) le reveal de ses enfants `RevealChild`. */
export function RevealGroup({
	children,
	className,
	stagger = 0.1,
	as = "div",
}: {
	children: ReactNode;
	className?: string;
	stagger?: number;
	as?: "div" | "ul" | "section";
}) {
	const reduce = useReducedMotion();
	const MotionTag = motion[as] as typeof motion.div;
	if (reduce) {
		const Tag = as;
		return <Tag className={className}>{children}</Tag>;
	}
	return (
		<MotionTag
			className={className}
			initial="hidden"
			whileInView="show"
			viewport={{ once: true, amount: 0.2 }}
			variants={{ show: { transition: { staggerChildren: stagger } } }}
		>
			{children}
		</MotionTag>
	);
}

export function RevealChild({
	children,
	className,
	blur = false,
	as = "div",
}: {
	children: ReactNode;
	className?: string;
	blur?: boolean;
	as?: "div" | "li" | "article";
}) {
	const reduce = useReducedMotion();
	const MotionTag = motion[as] as typeof motion.div;
	if (reduce) {
		const Tag = as;
		return <Tag className={className}>{children}</Tag>;
	}
	return (
		<MotionTag className={className} variants={blur ? FADEUP_BLUR : FADEUP}>
			{children}
		</MotionTag>
	);
}

/** Tampon « 達成 » — reproduit @keyframes stamp-pop (overshoot puis settle), staggered au reveal. */
export function StampPop({
	src,
	alt,
	delay = 0,
	className,
}: {
	src: string;
	alt: string;
	delay?: number;
	className?: string;
}) {
	const reduce = useReducedMotion();
	if (reduce) {
		// eslint-disable-next-line @next/next/no-img-element
		return <img src={src} alt={alt} className={className} />;
	}
	return (
		<motion.img
			src={src}
			alt={alt}
			className={className}
			initial={{ scale: 2.4, opacity: 0 }}
			whileInView={{
				scale: [2.4, 0.9, 1.05, 1],
				opacity: [0, 1, 1, 1],
			}}
			viewport={{ once: true, amount: 0.6 }}
			transition={{
				duration: 0.45,
				delay,
				ease: [0.18, 0.89, 0.32, 1.28],
				times: [0, 0.55, 0.8, 1],
			}}
		/>
	);
}

/**
 * KenBurns : enveloppe le key visual du hero et applique une boucle lente
 * de pan + zoom (équivalent @keyframes bgLoop du site, qui fait défiler la
 * background-position en continu). Désactivé en reduced-motion.
 */
export function KenBurns({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	const reduce = useReducedMotion();
	if (reduce) return <div className={className}>{children}</div>;
	return (
		<motion.div
			className={className}
			initial={{ scale: 1.06, x: "-1%", y: "-1%" }}
			animate={{ scale: [1.06, 1.14, 1.06], x: ["-1%", "1%", "-1%"], y: ["-1%", "1%", "-1%"] }}
			transition={{ duration: 28, ease: "easeInOut", repeat: Infinity }}
		>
			{children}
		</motion.div>
	);
}

/** Flottement doux (décoratif). */
export function Float({
	children,
	className,
	distance = 8,
	duration = 4,
}: {
	children: ReactNode;
	className?: string;
	distance?: number;
	duration?: number;
}) {
	const reduce = useReducedMotion();
	if (reduce) return <div className={className}>{children}</div>;
	return (
		<motion.div
			className={className}
			animate={{ y: [0, -distance, 0] }}
			transition={{ duration, ease: "easeInOut", repeat: Infinity }}
		>
			{children}
		</motion.div>
	);
}

/**
 * Carousel : remplace le Swiper 11 du site (slidesPerView auto, snap, nav prev/next + dots).
 * Scroll-snap natif + boutons + indicateurs. Mobile-first, drag tactile via overflow.
 */
export function Carousel({
	children,
	count,
	className,
	itemClassName,
	ariaLabel,
}: {
	children: ReactNode[];
	count: number;
	className?: string;
	itemClassName?: string;
	ariaLabel: string;
}) {
	const trackRef = useRef<HTMLDivElement>(null);
	const [active, setActive] = useState(0);

	const scrollToIndex = useCallback((i: number) => {
		const track = trackRef.current;
		if (!track) return;
		const child = track.children[i] as HTMLElement | undefined;
		if (child) {
			track.scrollTo({ left: child.offsetLeft - track.offsetLeft, behavior: "smooth" });
		}
	}, []);

	const onScroll = useCallback(() => {
		const track = trackRef.current;
		if (!track) return;
		const center = track.scrollLeft + track.clientWidth / 2;
		let best = 0;
		let bestDist = Infinity;
		Array.from(track.children).forEach((c, i) => {
			const el = c as HTMLElement;
			const mid = el.offsetLeft - track.offsetLeft + el.clientWidth / 2;
			const d = Math.abs(mid - center);
			if (d < bestDist) {
				bestDist = d;
				best = i;
			}
		});
		setActive(best);
	}, []);

	useEffect(() => {
		const track = trackRef.current;
		if (!track) return;
		track.addEventListener("scroll", onScroll, { passive: true });
		return () => track.removeEventListener("scroll", onScroll);
	}, [onScroll]);

	return (
		<div className={className} role="group" aria-label={ariaLabel}>
			<div className="relative">
				<div
					ref={trackRef}
					className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
				>
					{children.map((child, i) => (
						<div key={i} className={`shrink-0 snap-center ${itemClassName ?? ""}`}>
							{child}
						</div>
					))}
				</div>
				<button
					type="button"
					aria-label="Précédent"
					onClick={() => scrollToIndex(Math.max(0, active - 1))}
					disabled={active <= 0}
					className="absolute top-1/2 left-1 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-surface/80 text-on-surface shadow-level-1 backdrop-blur transition hover:bg-surface disabled:opacity-30 sm:-left-3"
				>
					‹
				</button>
				<button
					type="button"
					aria-label="Suivant"
					onClick={() => scrollToIndex(Math.min(count - 1, active + 1))}
					disabled={active >= count - 1}
					className="absolute top-1/2 right-1 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-surface/80 text-on-surface shadow-level-1 backdrop-blur transition hover:bg-surface disabled:opacity-30 sm:-right-3"
				>
					›
				</button>
			</div>
			<div className="mt-3 flex justify-center gap-2">
				{Array.from({ length: count }).map((_, i) => (
					<button
						key={i}
						type="button"
						aria-label={`Aller à l'élément ${i + 1}`}
						onClick={() => scrollToIndex(i)}
						className={`h-2 rounded-full transition-all ${
							i === active ? "w-6 bg-primary" : "w-2 bg-outline-variant"
						}`}
					/>
				))}
			</div>
		</div>
	);
}
