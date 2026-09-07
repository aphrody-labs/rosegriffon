import {
	AfterViewInit,
	Component,
	computed,
	ElementRef,
	OnInit,
	signal,
	ViewChild,
	inject,
} from "@angular/core";
import { ClanDTO } from "../../core/models/Clan";
import { ClanCard } from "../../shared/components/clan-card/clan-card";
import { InputText } from "primeng/inputtext";
import { FormsModule } from "@angular/forms";
import { FloatLabel } from "primeng/floatlabel";
import { Checkbox } from "primeng/checkbox";
import { Tooltip } from "primeng/tooltip";
import { InputNumber } from "primeng/inputnumber";
import { RadioButton } from "primeng/radiobutton";
import { LanguageSelect } from "../../shared/components/language-select/language-select";
import { Country } from "../../shared/services/language-service";
import { Fieldset } from "primeng/fieldset";
import { Divider } from "primeng/divider";
import { ClanService } from "../../shared/services/clan-service";
import { Router } from "@angular/router";
import { asyncScheduler, filter, fromEvent, map, throttleTime } from "rxjs";

@Component({
	selector: "app-clans-list",
	imports: [
		ClanCard,
		InputText,
		FormsModule,
		FloatLabel,
		Checkbox,
		Tooltip,
		InputNumber,
		RadioButton,
		LanguageSelect,
		Fieldset,
		Divider,
	],
	templateUrl: "./clans-list.html",
	styleUrl: "./clans-list.css",
})
export class ClansList implements OnInit, AfterViewInit {
	protected clanService = inject(ClanService);
	private router = inject(Router);

	@ViewChild("scrollContainer", { static: true }) scrollContainer!: ElementRef<HTMLElement>;

	_fetchedClans = signal<ClanDTO[]>([]);

	clansDisplay = computed<ClanDTO[]>(() =>
		this.clanService
			.clans()
			.filter((clan) => {
				const includeString = clan.shortenedName
					.concat(clan.name, clan.normalizedShortName)
					.toLowerCase()
					.includes(this.inputFilter().toLowerCase());
				const levelOK =
					this.levelFilterChoice() === "min"
						? clan.experience.currentLevel >= this.levelFilter()
						: clan.experience.currentLevel <= this.levelFilter();
				const recruiting = this.isRecruiting() ? clan.isRecruiting : true;
				const autoRecruit = this.autoRecruit() ? clan.autoAcceptMembers : true;
				const language = this.languageFilter()
					? clan.languages.includes(this.languageFilter()!.code)
					: true;
				// const pro = this.proFilter() ? clan.isPro : true
				return includeString && levelOK && recruiting && autoRecruit && language;
			})
			.sort((a, b) => {
				let res: number = 0;
				if (this.sortValue() === "level") {
					res =
						this.sortOption() === "asc"
							? a.experience.totalXp - b.experience.totalXp
							: b.experience.totalXp - a.experience.totalXp;
				} else if (this.sortValue() === "fame") {
					res = this.sortOption() === "asc" ? a.fame - b.fame : b.fame - a.fame;
				} else if (this.sortValue() === "foundation") {
					res =
						this.sortOption() === "asc"
							? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
							: new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
				}
				return res;
			})
	);

	inputFilter = signal<string>("");

	isRecruiting = signal<boolean>(false);
	autoRecruit = signal<boolean>(false);
	matchClanCriteria = signal<boolean>(false);
	proFilter = signal<boolean>(false);

	levelFilter = signal<number>(1);
	levelFilterChoice = signal<string>("min");

	languageFilter = signal<Country | null>(null);

	sortValue = signal<string>("level");
	sortOption = signal<string>("desc");

	ngOnInit() {
		this.clanService.page.set(1);
	}

	ngAfterViewInit() {
		fromEvent(this.scrollContainer.nativeElement, "scroll")
			.pipe(
				throttleTime(200),
				map(() => {
					const el = this.scrollContainer.nativeElement;
					return (el.scrollTop + el.clientHeight) / el.scrollHeight;
				}),
				filter((p) => p >= 0.9 && !this.clanService.loading())
			)
			.subscribe(() => {
				this.clanService.loadNext();
			});
	}

	protected disableAutoRecruitFilter() {
		if (!this.isRecruiting()) {
			this.autoRecruit.set(false);
		}
	}

	protected navigateToClanProfil(id: number) {
		this.router.navigate([`/clans/${id}`]);
	}
}
