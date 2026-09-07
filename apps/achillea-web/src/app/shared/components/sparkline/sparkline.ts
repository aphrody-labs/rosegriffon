import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { CommonModule } from "@angular/common";

// Sparkline SVG ultra-compact pour visualiser une serie de eloDelta
// (ex: 20 derniers matches). Pas de dependance Chart.js, render natif SVG.
@Component({
	selector: "app-sparkline",
	standalone: true,
	imports: [CommonModule],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (cumulative().length >= 2) {
			<svg
				[attr.viewBox]="'0 0 ' + width() + ' ' + height()"
				[style.width.px]="width()"
				[style.height.px]="height()"
				class="sparkline-svg"
				preserveAspectRatio="none"
			>
				<defs>
					<linearGradient [attr.id]="gradientId()" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" [attr.stop-color]="strokeColor()" stop-opacity="0.45" />
						<stop offset="100%" [attr.stop-color]="strokeColor()" stop-opacity="0" />
					</linearGradient>
				</defs>
				<path [attr.d]="areaPath()" [attr.fill]="'url(#' + gradientId() + ')'" />
				<path
					[attr.d]="linePath()"
					fill="none"
					[attr.stroke]="strokeColor()"
					stroke-width="1.6"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
				@if (showLastPoint()) {
					<circle
						[attr.cx]="lastPoint().x"
						[attr.cy]="lastPoint().y"
						r="2.4"
						[attr.fill]="strokeColor()"
					/>
				}
			</svg>
		} @else {
			<span class="opacity-50 text-xs">—</span>
		}
	`,
	styles: [
		`
			:host {
				display: inline-flex;
				align-items: center;
			}
			.sparkline-svg {
				display: block;
			}
		`,
	],
})
export class Sparkline {
	readonly data = input<number[]>([]);
	readonly width = input<number>(120);
	readonly height = input<number>(36);
	readonly showLastPoint = input<boolean>(true);
	readonly idSuffix = input<string>(Math.random().toString(36).slice(2, 8));

	readonly gradientId = computed(() => `spark-grad-${this.idSuffix()}`);

	// Trace l'evolution cumulee (somme prefixe) plutot que les deltas bruts —
	// ca donne une courbe d'ELO plus parlante qu'un nuage de points.
	readonly cumulative = computed<number[]>(() => {
		const d = this.data() ?? [];
		const out: number[] = [];
		let acc = 0;
		for (const v of d) {
			acc += Number(v) || 0;
			out.push(acc);
		}
		return out;
	});

	readonly trend = computed<"up" | "down" | "flat">(() => {
		const c = this.cumulative();
		if (c.length === 0) return "flat";
		const last = c[c.length - 1];
		if (last > 0) return "up";
		if (last < 0) return "down";
		return "flat";
	});

	readonly strokeColor = computed(() => {
		const t = this.trend();
		if (t === "up") return "#34d399"; // emerald-400
		if (t === "down") return "#f87171"; // red-400
		return "#94a3b8"; // slate-400
	});

	private points = computed<{ x: number; y: number }[]>(() => {
		const c = this.cumulative();
		if (c.length < 2) return [];
		const w = this.width();
		const h = this.height();
		const pad = 2;
		const min = Math.min(...c);
		const max = Math.max(...c);
		const span = max - min || 1;
		return c.map((v, i) => ({
			x: pad + (i * (w - pad * 2)) / (c.length - 1),
			y: h - pad - ((v - min) * (h - pad * 2)) / span,
		}));
	});

	readonly linePath = computed(() => {
		const pts = this.points();
		if (pts.length < 2) return "";
		return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
	});

	readonly areaPath = computed(() => {
		const pts = this.points();
		if (pts.length < 2) return "";
		const h = this.height();
		const first = pts[0];
		const last = pts[pts.length - 1];
		const line = pts
			.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
			.join(" ");
		return `${line} L${last.x.toFixed(2)},${h} L${first.x.toFixed(2)},${h} Z`;
	});

	readonly lastPoint = computed(() => {
		const pts = this.points();
		return pts[pts.length - 1] ?? { x: 0, y: 0 };
	});
}
