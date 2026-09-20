import { Component, OnInit, effect, input, output, signal, ViewChild, inject } from "@angular/core";
import { Panel } from "primeng/panel";
import { InputText } from "primeng/inputtext";
import { FloatLabel } from "primeng/floatlabel";
import {
	AbstractControl,
	FormControl,
	FormGroup,
	FormsModule,
	ReactiveFormsModule,
	ValidationErrors,
	ValidatorFn,
	Validators,
} from "@angular/forms";
import { Textarea } from "primeng/textarea";
import { DatePicker } from "primeng/datepicker";
import {
	MatchFormat,
	NewTournamentDTO,
	SCORE_REPORT_POLICY_OPTIONS,
	ScoreReportPolicy,
	Tournament,
	TournamentState,
	tournamentTypeOptions,
} from "../../../core/models/Tournament";
import { Select } from "primeng/select";
import { Button } from "primeng/button";
import { TournamentsService } from "../../services/tournaments-service";
import { FileUpload, FileUploadEvent, RemoveUploadedFileEvent } from "primeng/fileupload";
import { MessageService } from "primeng/api";
import { Step, StepList, StepPanel, StepPanels, Stepper } from "primeng/stepper";
import { RadioButton } from "primeng/radiobutton";
import { SeedOrdering } from "brackets-model";
import type { StageType } from "../../../core/models/Tournament";
import { TournamentSeries } from "../../../core/models/TournamentSeries";
import { OrganizationDTO } from "../../../core/models/Organization";
import { UserDTO } from "../../services/user-service";
import { apiUrl } from "../../../core/http/api-url";
import {
	formatPrizeSummary,
	isPlacementPrizeEligible,
} from "../../../core/helpers/tournament-placement-prizes";

const MATCH_FORMAT_OPTIONS = [
	{ label: "Aller-retour (double leg)", value: MatchFormat.DOUBLE_LEG },
	{ label: "BO1", value: MatchFormat.BO1 },
	{ label: "BO3", value: MatchFormat.BO3 },
	{ label: "BO5", value: MatchFormat.BO5 },
	{ label: "Personnalisé", value: MatchFormat.CUSTOM },
];

@Component({
	selector: "app-tournament-creation-form",
	imports: [
		Panel,
		InputText,
		FloatLabel,
		FormsModule,
		Textarea,
		DatePicker,
		Select,
		ReactiveFormsModule,
		Button,
		FileUpload,
		Step,
		StepList,
		StepPanel,
		StepPanels,
		Stepper,
		RadioButton,
	],
	templateUrl: "./tournament-creation-form.component.html",
	styleUrl: "./tournament-creation-form.component.css",
})
export class TournamentCreationForm implements OnInit {
	private tournamentsService = inject(TournamentsService);
	private msg = inject(MessageService);

	@ViewChild("fileUploadLogo") fileUploadLogoComponent!: FileUpload;
	@ViewChild("fileUploadAffiche") fileUploadAfficheComponent!: FileUpload;

	/** Si fourni, le formulaire passe en mode édition de ce tournoi. */
	tournamentToEdit = input<Tournament | null>(null);

	protected readonly uploadUrl = apiUrl("/api/proxy/upload");
	protected readonly isEditMode = signal(false);

	protected currentStep = signal(1);
	protected nextStep() {
		this.currentStep.update((val) => (val += 1));
	}
	protected prevStep() {
		this.currentStep.update((val) => (val -= 1));
	}

	protected series = signal<string | null>(null);

	closeDialog = output<boolean>();
	/** Émis après update réussi avec le tournoi mis à jour (ou null en création). */
	saved = output<Tournament | null>();
	isSubmitting = signal(false);
	protected logoFileId: string | null = null;
	protected afficheFileId: string | null = null;

	constructor() {
		effect(() => {
			const t = this.tournamentToEdit();
			if (t) {
				this.isEditMode.set(true);
				this.patchFromTournament(t);
				this.currentStep.set(2);
			} else {
				this.isEditMode.set(false);
			}
		});
	}

	async onSubmit() {
		// 1. Validation du formulaire
		if (this.newTournamentForm.invalid) {
			this.newTournamentForm.markAllAsTouched();
			return;
		}

		this.isSubmitting.set(true);

		const dto = this.toDTO();
		const edit = this.tournamentToEdit();

		let success = false;
		let updated: Tournament | null = null;
		if (edit?.id) {
			updated = await this.tournamentsService.updateAchilleaTournament(edit.id, dto);
			success = !!updated;
		} else {
			success = await this.tournamentsService.createAchilleaTournament(dto);
		}

		this.isSubmitting.set(false);

		if (success) {
			this.closeDialog.emit(true);
			this.saved.emit(updated);
			if (!edit) {
				this.newTournamentForm.reset();
				this.fileUploadAfficheComponent?.clear();
				this.fileUploadLogoComponent?.clear();
				await this.tournamentsService.getAndSetDashboardTournaments();
			}
		}
	}

	onCancel() {
		this.closeDialog.emit(true);
	}

	async ngOnInit() {
		this.startsAtControl.valueChanges.subscribe(() => {
			this.grandFinalAtControl.updateValueAndValidity();
		});
	}

	private patchFromTournament(t: Tournament) {
		this.nameControl.setValue(t.name);
		this.descriptionControl.setValue(t.description);
		this.organizationControl.setValue(Number(t.organization?.id ?? 1));
		this.tournamentTypeControl.setValue(t.tournamentType as StageType);
		this.participantsNumberControl.setValue(t.participantsNumber);
		this.matchFormatControl.setValue(t.matchFormat);
		this.seedOrderingControl.setValue((t.seedOrdering as SeedOrdering) ?? "inner_outer");
		this.startsAtControl.setValue(t.startsAt ? new Date(t.startsAt) : undefined);
		this.grandFinalAtControl.setValue(t.grandFinalAt ? new Date(t.grandFinalAt) : undefined);
		this.logoControl.setValue(t.logo);
		this.afficheControl.setValue(t.affiche);
		this.planningControl.setValue(t.planning);
		this.rulesetControl.setValue(t.ruleset);
		this.groupStageEnabledControl.setValue(!!t.groupStageEnabled);
		this.groupStageTypeControl.setValue((t.groupStageType as StageType) ?? null);
		this.customFormatChildCountControl.setValue(t.customFormatChildCount ?? null);
		this.registrationOpensAtControl.setValue(
			t.registrationOpensAt ? new Date(t.registrationOpensAt) : null
		);
		this.registrationClosesAtControl.setValue(
			t.registrationClosesAt ? new Date(t.registrationClosesAt) : null
		);
		this.autoStartControl.setValue(!!t.autoStart);
		this.discordRoleEnabledControl.setValue(!!t.discordRoleEnabled);
		this.scoreReportPolicyControl.setValue(t.scoreReportPolicy ?? ScoreReportPolicy.PLAYERS);
		// La dérogation ne se réapplique pas en édition : elle a déjà été tranchée à la
		// création, et l'API ne rejoue pas les règles de publication sur une mise à jour.
		this.bypassRulesControl.setValue(false);
		// En édition : dates passées OK si le tournoi n'est plus en pure planification future
		if (t.internalState !== TournamentState.PENDING) {
			this.startsAtControl.clearValidators();
			this.startsAtControl.addValidators([Validators.required]);
			this.grandFinalAtControl.clearValidators();
			this.grandFinalAtControl.addValidators([
				Validators.required,
				this.dateAfterControlValidator(this.startsAtControl),
			]);
			this.startsAtControl.updateValueAndValidity({ emitEvent: false });
			this.grandFinalAtControl.updateValueAndValidity({ emitEvent: false });
		}
		// Type figé hors planification pure ; capacité ↑ autorisée en inscriptions/préparation
		const isPending = t.internalState === TournamentState.PENDING;
		const canGrowCapacity =
			isPending ||
			t.internalState === TournamentState.PREREGISTERING ||
			t.internalState === TournamentState.PREPARING;

		if (isPending) {
			this.tournamentTypeControl.enable({ emitEvent: false });
		} else {
			this.tournamentTypeControl.disable({ emitEvent: false });
		}

		if (canGrowCapacity) {
			this.participantsNumberControl.enable({ emitEvent: false });
			// En édition post-création : n'afficher que les tailles ≥ taille actuelle
			if (!isPending) {
				const current = t.participantsNumber ?? 0;
				this.participantsSizeOptions = this.allParticipantsSizes.filter((n) => n >= current);
			} else {
				this.participantsSizeOptions = [...this.allParticipantsSizes];
			}
		} else {
			this.participantsNumberControl.disable({ emitEvent: false });
			this.participantsSizeOptions = [...this.allParticipantsSizes];
		}
	}

	protected readonly allParticipantsSizes = [4, 8, 16, 32, 64, 128, 256, 512, 1024] as const;
	/** Options du select capacité (filtrées en édition pour n'autoriser que ↑). */
	protected participantsSizeOptions: number[] = [...this.allParticipantsSizes];

	protected nameControl = new FormControl<string>("", [
		Validators.required,
		Validators.minLength(3),
		Validators.maxLength(30),
	]);
	protected descriptionControl = new FormControl<string>("", [
		Validators.required,
		Validators.maxLength(1500),
		Validators.minLength(15),
	]);
	protected seriesControl = new FormControl<TournamentSeries | null>(null, []);
	protected organizationControl = new FormControl<OrganizationDTO | number | undefined>(1, [
		Validators.required,
	]);
	protected managersControl = new FormControl<UserDTO[]>([], []);
	protected seedOrderingControl = new FormControl<SeedOrdering | undefined>("inner_outer", [
		Validators.required,
	]);
	protected matchFormatControl = new FormControl<MatchFormat | undefined>(MatchFormat.DOUBLE_LEG, [
		Validators.required,
	]);
	protected customFormatChildCountControl = new FormControl<number | null>(null, []);
	protected tournamentTypeControl = new FormControl<StageType | undefined>(undefined, [
		Validators.required,
	]);
	/** Aperçu barème podium AP (élimination only). */
	protected podiumPrizePreview(): string | null {
		const type = this.tournamentTypeControl.value;
		const size = this.participantsNumberControl.value;
		if (!type || !isPlacementPrizeEligible(type) || !size) return null;
		return formatPrizeSummary(size);
	}

	protected participantsNumberControl = new FormControl<number | undefined>(undefined, [
		Validators.required,
	]);
	protected startsAtControl = new FormControl<Date | undefined>(undefined, [
		Validators.required,
		this.dateWithinRangeValidator(6),
	]);
	protected grandFinalAtControl = new FormControl<Date | undefined>(undefined, [
		Validators.required,
		this.dateWithinRangeValidator(6),
		this.dateAfterControlValidator(this.startsAtControl),
	]);
	protected logoControl = new FormControl<string | null>(null, [
		Validators.required,
		Validators.minLength(1),
	]);
	protected afficheControl = new FormControl<string | null>(null, [
		Validators.required,
		Validators.minLength(1),
	]);
	protected rulesetControl = new FormControl<string | null>(null, [
		Validators.required,
		Validators.minLength(1),
	]);
	protected planningControl = new FormControl<string | null>(null, [
		Validators.required,
		Validators.minLength(1),
	]);
	protected groupStageEnabledControl = new FormControl<boolean>(false, [Validators.nullValidator]);
	protected groupStageTypeControl = new FormControl<StageType | null>(null);

	// ── Planning automatisé (facultatif) ──────────────────────────────────────
	// Laissés vides, le tournoi se conduit à la main comme avant. Renseignés, le cron
	// `phase-transitions` ouvre, ferme et démarre tout seul.
	protected registrationOpensAtControl = new FormControl<Date | null>(null);
	protected registrationClosesAtControl = new FormControl<Date | null>(null);
	protected autoStartControl = new FormControl<boolean>(false);

	/**
	 * Rôle Discord distribué aux inscrits — décoché par défaut : le rôle n'a de sens
	 * que pour les tournois organisés sur le serveur Achillea.
	 */
	protected discordRoleEnabledControl = new FormControl<boolean>(false);

	/**
	 * Dérogation aux règles de publication (délai minimum, plafond de tournois
	 * ouverts). Refusée côté API si l'appelant n'est pas SuperAdmin.
	 */
	protected bypassRulesControl = new FormControl<boolean>(false);

	/**
	 * Qui saisit les scores. Défaut aux joueurs : c'est le fonctionnement historique,
	 * et le seul qui n'impose pas au staff de suivre chaque match à la main.
	 */
	protected scoreReportPolicyControl = new FormControl<ScoreReportPolicy>(
		ScoreReportPolicy.PLAYERS
	);

	protected readonly scoreReportPolicyOptions = SCORE_REPORT_POLICY_OPTIONS;

	/** Explication de l'option retenue, sous les boutons radio. */
	protected scoreReportPolicyHint(): string {
		const current = this.scoreReportPolicyControl.value ?? ScoreReportPolicy.PLAYERS;

		return (
			SCORE_REPORT_POLICY_OPTIONS.find((option) => option.value === current)?.hint ??
			SCORE_REPORT_POLICY_OPTIONS[0].hint
		);
	}

	protected minDate = new Date();
	// L'API refuse au-delà de `TOURNAMENT_MAX_LEAD_DAYS` (180 j par défaut) : le
	// sélecteur s'aligne dessus plutôt que d'imposer une limite plus courte de son côté.
	protected maxDate = new Date(new Date().setMonth(new Date().getMonth() + 6));

	protected newTournamentForm = new FormGroup({
		name: this.nameControl,
		description: this.descriptionControl,
		series: this.seriesControl,
		organization: this.organizationControl,
		managers: this.managersControl,
		seedOrdering: this.seedOrderingControl,
		matchFormat: this.matchFormatControl,
		customFormatChildCountControl: this.customFormatChildCountControl,
		tournamentType: this.tournamentTypeControl,
		participantsNumber: this.participantsNumberControl,
		startsAt: this.startsAtControl,
		grandFinalAt: this.grandFinalAtControl,
		logo: this.logoControl,
		affiche: this.afficheControl,
		ruleset: this.rulesetControl,
		planning: this.planningControl,
		groupStageEnabled: this.groupStageEnabledControl,
		groupStageType: this.groupStageTypeControl,
		registrationOpensAt: this.registrationOpensAtControl,
		registrationClosesAt: this.registrationClosesAtControl,
		autoStart: this.autoStartControl,
		discordRoleEnabled: this.discordRoleEnabledControl,
		scoreReportPolicy: this.scoreReportPolicyControl,
		bypassRules: this.bypassRulesControl,
	});

	protected readonly tournamentTypeOptions = [...tournamentTypeOptions];
	protected readonly matchFormatOptions = [...MATCH_FORMAT_OPTIONS];
	protected readonly console = console;

	private dateWithinRangeValidator(months: number = 1): ValidatorFn {
		return (control: AbstractControl): ValidationErrors | null => {
			if (!control.value) return null;

			const inputDate = new Date(control.value);
			const now = new Date();
			const maxDate = new Date();
			maxDate.setMonth(now.getMonth() + months);

			if (inputDate < now) {
				return { pastDate: true }; // Erreur: La date est dans le passé
			}

			if (inputDate > maxDate) {
				return { tooFarInFuture: true }; // Erreur: La date est trop lointaine
			}

			return null;
		};
	}

	// Validateur : Date A doit être après Date B
	private dateAfterControlValidator(otherControl: AbstractControl): ValidatorFn {
		return (control: AbstractControl): ValidationErrors | null => {
			if (!control.value || !otherControl.value) return null;

			const thisDate = new Date(control.value);
			const otherDate = new Date(otherControl.value);

			if (thisDate <= otherDate) {
				return { dateOrderError: true }; // Erreur: La date de fin est avant ou égale au début
			}

			return null;
		};
	}

	private toDTO() {
		const rawValue = this.newTournamentForm.getRawValue();

		const dto: NewTournamentDTO = {
			name: rawValue.name!,
			description: rawValue.description!,
			series: rawValue.series,
			organization: rawValue.organization ?? 1,
			seedOrdering: rawValue.seedOrdering!,
			managers: rawValue.managers!,
			matchFormat: rawValue.matchFormat!,
			customFormatChildCount: rawValue.customFormatChildCountControl,
			tournamentType: rawValue.tournamentType!,
			participantsNumber: rawValue.participantsNumber!,
			startsAt: rawValue.startsAt!,
			grandFinalAt: rawValue.grandFinalAt!,
			logo: rawValue.logo!,
			affiche: rawValue.affiche!,
			planning: rawValue.planning!,
			ruleset: rawValue.ruleset!,
			groupStageEnabled: rawValue.groupStageEnabled!,
			groupStageType: rawValue.groupStageType,
			registrationOpensAt: rawValue.registrationOpensAt ?? null,
			registrationClosesAt: rawValue.registrationClosesAt ?? null,
			autoStart: rawValue.autoStart ?? false,
			discordRoleEnabled: rawValue.discordRoleEnabled ?? false,
			scoreReportPolicy: rawValue.scoreReportPolicy ?? ScoreReportPolicy.PLAYERS,
			bypassRules: rawValue.bypassRules ?? false,
		};

		return dto;
	}

	onUpload(event: FileUploadEvent, target: "logo" | "affiche") {
		const original = event.originalEvent as any;
		const targetControl = target === "logo" ? this.logoControl : this.afficheControl;
		if (original.ok) {
			this.msg.add({
				summary: "Succès",
				detail: "Image téléversée avec succès.",
				severity: "success",
			});
			targetControl.setValue(original.body.url);
			if (target === "logo") this.logoFileId = original.body.id;
			if (target === "affiche") this.afficheFileId = original.body.id;
			targetControl.updateValueAndValidity();
		} else {
			this.msg.add({
				summary: "Échec",
				detail: "Échec du téléversement de l'image.",
				severity: "error",
			});
		}
	}

	onUploadError(
		event: { error?: { status?: number; message?: string } },
		target: "logo" | "affiche"
	) {
		const label = target === "logo" ? "logo" : "affiche";
		const status = event?.error?.status;
		const detail =
			status === 401
				? `Session expirée : reconnecte-toi puis réessaie d'envoyer le ${label}.`
				: status === 413
					? `Image trop lourde pour le ${label} (max 6 Mo).`
					: status === 400
						? `Fichier refusé pour le ${label} (type non supporté ou formulaire invalide).`
						: `Échec du téléversement du ${label}. Réessaie ou choisis une autre image.`;
		this.msg.add({
			summary: "Échec de l'upload",
			detail,
			severity: "error",
			life: 8000,
		});
	}

	async onRemove(_event: RemoveUploadedFileEvent, target: "logo" | "affiche") {
		await this.clearImage(target);
	}

	/** Retire logo/affiche du formulaire (et du CDN si id local connu). */
	async clearImage(target: "logo" | "affiche") {
		const targetControl = target === "logo" ? this.logoControl : this.afficheControl;
		const targetFile = target === "logo" ? this.logoFileId : this.afficheFileId;
		if (targetFile) {
			const res = await fetch(apiUrl(`/api/proxy/delete/${encodeURIComponent(targetFile)}`), {
				credentials: "include",
			});
			if (res.ok) {
				this.msg.add({
					summary: "Succès",
					detail: "Image supprimée du serveur distant.",
					severity: "success",
				});
			}
		}
		if (target === "logo") this.logoFileId = null;
		else this.afficheFileId = null;
		targetControl.setValue(null);
		targetControl.updateValueAndValidity();
	}
}
