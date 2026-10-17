import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { CommonModule } from "@angular/common";

import { RankedTierInfo } from "../../../core/models/Ranked";

// Bar chart horizontal natif SVG affichant la distribution des joueurs par
// tier avec un highlight optionnel sur le tier du user courant.
@Component({
	selector: "app-tier-distribution",
	standalone: true,
	imports: [CommonModule],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (tiers().length > 0 && total() > 0) {
			<div class="td-wrapper flex flex-col gap-1.5">
				@for (t of tiers(); track t.key) {
					<div
						class="td-row flex items-center gap-2 group"
						[class.is-mine]="t.key === highlightKey()"
					>
						<div class="td-label w-24 md:w-28 text-xs md:text-sm text-right truncate">
							{{ t.key }}
						</div>
						<div
							class="td-bar-track flex-1 relative h-5 rounded-full overflow-hidden bg-surface-800"
						>
							<div
								class="td-bar absolute inset-y-0 left-0 rounded-full transition-all duration-500"
								[style.width.%]="percent(t.playerCount)"
								[style.background]="gradient(t.gradient)"
							></div>
						</div>
						<div class="td-count text-xs font-mono w-20 md:w-24 text-right tabular-nums opacity-80">
							{{ t.playerCount }}
							<span class="opacity-60">({{ percentLabel(t.playerCount) }}%)</span>
						</div>
					</div>
				}
			</div>
		}
	`,
	styles: [
		`
			:host {
				display: block;
			}
			.td-row.is-mine .td-label {
				font-weight: 700;
				color: var(--p-primary-color);
			}
			.td-row.is-mine .td-bar-track {
				outline: 2px solid var(--p-primary-color);
				outline-offset: 1px;
			}
			.td-row.is-mine .td-count {
				font-weight: 700;
				color: var(--p-primary-color);
				opacity: 1;
			}
		`,
	],
})
export class TierDistribution {
	readonly tiers = input<RankedTierInfo[]>([]);
	readonly highlightKey = input<string | null>(null);

	readonly total = computed(() => this.tiers().reduce((acc, t) => acc + (t.playerCount ?? 0), 0));

	readonly maxCount = computed(() => Math.max(1, ...this.tiers().map((t) => t.playerCount ?? 0)));

	percent(count: number): number {
		const max = this.maxCount();
		if (max === 0) return 0;
		return Math.max(2, Math.round((count / max) * 100));
	}

	percentLabel(count: number): string {
		const total = this.total();
		if (total === 0) return "0";
		const v = (count / total) * 100;
		if (v < 0.1 && count > 0) return "<0.1";
		return v.toFixed(1);
	}

	gradient(g: string[] | undefined | null): string {
		if (!g || g.length < 2) return "linear-gradient(90deg, #555, #777)";
		return `linear-gradient(90deg, ${g.join(", ")})`;
	}
}
