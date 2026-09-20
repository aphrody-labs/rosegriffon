import { Component, computed, effect, input, OnInit, signal, inject } from "@angular/core";
import { Button, ButtonDirective } from "primeng/button";
import {
	AbstractControl,
	FormControl,
	FormGroup,
	ReactiveFormsModule,
	ValidationErrors,
	ValidatorFn,
	Validators,
} from "@angular/forms";
import { UserDTO, UserService } from "../../services/user-service";
import { Suggestion } from "../../../core/models/Suggestion";
import { SocialMedia, SocialMediaDTO } from "../../../core/models/SocialMedia";
import { FloatLabel } from "primeng/floatlabel";
import { InputText } from "primeng/inputtext";
import { Message } from "primeng/message";
import { normalizeNames } from "../../../core/helpers/misc";
import { IftaLabel } from "primeng/iftalabel";
import { Textarea } from "primeng/textarea";
import { Searchbar } from "../searchbar/searchbar";
import { CountrySelect } from "../country-select/country-select";
import { Country, LanguageService } from "../../services/language-service";
import { Fieldset } from "primeng/fieldset";
import { InputGroup } from "primeng/inputgroup";
import { InputGroupAddon } from "primeng/inputgroupaddon";
import { merge } from "rxjs";
import { toSignal } from "@angular/core/rxjs-interop";
import { Dialog } from "primeng/dialog";
import { FileUpload, FileUploadEvent, RemoveUploadedFileEvent } from "primeng/fileupload";
import { MessageService } from "primeng/api";
import {
	OrganizationDTO,
	OrganizationFormMode,
	OrganizationValidationDTO,
} from "../../../core/models/Organization";
import { suggestionToUserDTO } from "../../../core/models/User";
import { OrganizationService } from "../../services/organization-service";
import { Avatar } from "primeng/avatar";
import { apiUrl } from "../../../core/http/api-url";

@Component({
	selector: "app-organizer-form",
	imports: [
		FloatLabel,
		InputText,
		Message,
		ReactiveFormsModule,
		IftaLabel,
		Textarea,
		ButtonDirective,
		Searchbar,
		CountrySelect,
		Fieldset,
		InputGroup,
		InputGroupAddon,
		Button,
		Dialog,
		FileUpload,
		Avatar,
	],
	templateUrl: "./organizer-form.html",
	styleUrl: "./organizer-form.css",
})
export class OrganizerForm implements OnInit {
	private userService = inject(UserService);
	private msg = inject(MessageService);
	private orgService = inject(OrganizationService);
	private lg = inject(LanguageService);

	protected readonly uploadUrl = apiUrl("/api/proxy/upload");

	mode = input<OrganizationFormMode>(OrganizationFormMode.Create);

	// Les données de l'organisation (Requis pour Edit/Validate)
	initialData = input<OrganizationDTO | null>(null);

	// Les erreurs de validation précédentes (Requis pour Edit)
	previousFeedback = input<OrganizationValidationDTO | null>(null);

	constructor() {
		// React to changes in inputs (Data loading)
		effect(() => {
			const data = this.initialData();
			const feedback = this.previousFeedback();
			const mode = this.mode();

			if (data) {
				this.patchOrgFormWithOrgData(data);
			}

			this.configureFormState(mode, feedback);
		});
	}

	protected nameControl = new FormControl<string>("", [
		Validators.required,
		Validators.minLength(3),
		Validators.maxLength(30),
		this.normalizerValidator,
	]);
	protected normalizedNameControl = new FormControl<string>("", [
		Validators.required,
		Validators.minLength(3),
		Validators.maxLength(30),
	]);
	protected logoControl = new FormControl<string | null>(null, [
		Validators.required,
		Validators.minLength(1),
	]);
	protected descriptionControl = new FormControl<string>("", [
		Validators.required,
		Validators.maxLength(1500),
		Validators.minLength(15),
	]);
	protected ownerControl = new FormControl<UserDTO | undefined>(undefined, [Validators.required]);
	protected orgManagersControl = new FormControl<Suggestion[]>([]);
	protected socialMediasControl = new FormControl<SocialMediaDTO[]>([], {
		nonNullable: true,
	}); // Add socials validator
	protected broadcastMediasControl = new FormControl<SocialMediaDTO[]>([], {
		nonNullable: true,
	});
	protected originControl = new FormControl<Country | undefined>(undefined, [Validators.required]); // See validation

	protected twitterControl = new FormControl<string>("", [this.validateSocial(SocialMedia.X)]);
	protected instagramControl = new FormControl<string>("", [
		this.validateSocial(SocialMedia.Instagram),
	]);
	protected tiktokControl = new FormControl<string>("", [this.validateSocial(SocialMedia.TikTok)]);

	protected twitchControl = new FormControl<string>("", [this.validateSocial(SocialMedia.Twitch)]);
	protected youtubeControl = new FormControl<string>("", [
		this.validateSocial(SocialMedia.Youtube),
	]);

	protected newOrganizerForm = new FormGroup({
		name: this.nameControl,
		normalizedName: this.normalizedNameControl,
		logo: this.logoControl,
		description: this.descriptionControl,
		owner: this.ownerControl,
		orgManagers: this.orgManagersControl,
		socialMedias: this.socialMediasControl,
		broadcastMedias: this.broadcastMediasControl,
		origin: this.originControl,
	});

	protected validationForm = new FormGroup({
		name: new FormControl<string | null>(null),
		description: new FormControl<string | null>(null),
		logo: new FormControl<string | null>(null),
		twitterUrl: new FormControl<string | null>(null),
		instagramUrl: new FormControl<string | null>(null),
		tiktokUrl: new FormControl<string | null>(null),
		twitchUrl: new FormControl<string | null>(null),
		youtubeUrl: new FormControl<string | null>(null),
	});

	protected toggleRejection(fieldName: string) {
		const control = this.validationForm.get(fieldName);
		if (!control) return;

		if (control.value !== null) {
			control.setValue(null); // Approve
		} else {
			control.setValue("Information incorrecte ou inappropriée"); // Reject (default text)
		}
	}

	get formName(): string {
		switch (this.mode()) {
			case OrganizationFormMode.Validate:
				return "Formulaire de validation d'une Organisation";
			case OrganizationFormMode.Edit:
				return `Formulaire d'édition d'une Organisation`;
			case OrganizationFormMode.Create:
				return "Formulaire de création d'une Organisation";
			default:
				return "Formulaire de création d'une Organisation";
		}
	}

	private patchOrgFormWithOrgData(data: OrganizationDTO) {
		this.newOrganizerForm.patchValue({
			name: data.name,
			normalizedName: data.normalizedName,
			description: data.description,
			logo: data.logo,
			origin: this.lg.getLanguageFromCode(data.origin as unknown as string),
			owner: typeof data.owner === "object" ? data.owner : undefined,
		});

		const getUrl = (list: SocialMediaDTO[], platform: SocialMedia): string => {
			const media = list.find((sm) => sm.platform === platform);
			return media ? media.canonicalUrl : "";
		};

		// 3. Mapping des "Réseaux sociaux" (SocialMedias)
		// On utilise setValue directement sur les contrôles individuels
		this.twitterControl.setValue(getUrl(data.socialMedias ?? [], SocialMedia.X));
		this.instagramControl.setValue(getUrl(data.socialMedias ?? [], SocialMedia.Instagram));
		this.tiktokControl.setValue(getUrl(data.socialMedias ?? [], SocialMedia.TikTok));

		// 4. Mapping des "Réseaux de diffusion" (BroadcastMedias)
		// Attention à la typo 'broadcastMedials' présente dans ton DTO
		this.twitchControl.setValue(getUrl(data.broadcastMedias ?? [], SocialMedia.Twitch));
		this.youtubeControl.setValue(getUrl(data.broadcastMedias ?? [], SocialMedia.Youtube));

		// 5. Forcer la mise à jour des validateurs de groupe (optionnel mais recommandé)
		this.updateSocialMedias();
		this.updateBroadcastMedias();
	}

	private configureFormState(
		mode: OrganizationFormMode,
		feedback: OrganizationValidationDTO | null
	) {
		// Liste des contrôles indépendants (qui ne sont pas dans le FormGroup principal)
		const socialControls = [
			this.twitterControl,
			this.instagramControl,
			this.tiktokControl,
			this.twitchControl,
			this.youtubeControl,
		];

		// 1. Reset propre
		this.newOrganizerForm.markAsUntouched();
		this.newOrganizerForm.markAsPristine();

		if (mode === OrganizationFormMode.Validate) {
			// Désactiver le groupe principal
			this.newOrganizerForm.disable({ emitEvent: false });
			// Désactiver manuellement les contrôles sociaux
			socialControls.forEach((c) => c.disable({ emitEvent: false }));
		} else if (mode === OrganizationFormMode.Edit) {
			// Lock principal
			this.newOrganizerForm.disable({ emitEvent: false });
			// Lock sociaux
			socialControls.forEach((c) => c.disable({ emitEvent: false }));

			if (feedback) {
				// Déblocage sélectif du groupe principal
				if (feedback.name) this.nameControl.enable({ emitEvent: false });
				if (feedback.description) this.descriptionControl.enable({ emitEvent: false });
				if (feedback.logo) this.logoControl.enable({ emitEvent: false });

				// Déblocage sélectif des sociaux
				if (feedback.twitterUrl) this.twitterControl.enable({ emitEvent: false });
				if (feedback.instagramUrl) this.instagramControl.enable({ emitEvent: false });
				if (feedback.tiktokUrl) this.tiktokControl.enable({ emitEvent: false });
				if (feedback.twitchUrl) this.twitchControl.enable({ emitEvent: false });
				if (feedback.youtubeUrl) this.youtubeControl.enable({ emitEvent: false });
			}
		} else {
			// Mode Create : Tout activer
			this.newOrganizerForm.enable({ emitEvent: false });
			socialControls.forEach((c) => c.enable({ emitEvent: false }));
		}
	}

	protected async onSubmit() {
		if (this.mode() === OrganizationFormMode.Validate) {
			// On appelle l'endpoint de validation (le contenu de validationForm)
			// this.submitValidation.emit(this.validationForm.value as OrganizationValidationDTO);
		} else {
			// Create ou Edit
			if (this.newOrganizerForm.valid) {
				// IMPORTANT : getRawValue() récupère même les champs disabled (readonly en mode Edit)
				const rawValue = this.newOrganizerForm.getRawValue();

				// Reconstruction du DTO
				const dto: OrganizationDTO = {
					// On préserve l'ID et le state existants si on est en édition
					id: this.initialData()?.id,

					// Champs textes simples (Le validateur garantit qu'ils ne sont pas null, on peut caster)
					name: rawValue.name!,
					normalizedName: rawValue.normalizedName!,
					description: rawValue.description!,
					logo: rawValue.logo!,

					// Objets complexes
					origin: rawValue.origin!, // Country
					owner: rawValue.owner!, // UserDTO

					// Mapping spécial : Suggestion[] -> UserDTO[]
					orgManagers: (rawValue.orgManagers ?? []).map((suggestion: Suggestion) =>
						suggestionToUserDTO(suggestion)
					),

					// Réseaux sociaux (déjà formatés par updateSocialMedias)
					socialMedias: rawValue.socialMedias ?? [],

					// Réseaux de diffusion (déjà formatés par updateBroadcastMedias)
					// Note : On map la clé du formulaire 'broadcastMedias' vers la clé du DTO 'broadcastMedials' (typo)
					broadcastMedias: rawValue.broadcastMedias ?? [],
				};

				// Endpoint de soumission
				if (this.mode() === OrganizationFormMode.Create) {
					await this.orgService.createOrganization(dto);
				}
				// else edit endpoint
			} else {
				// Optionnel : Marquer tous les champs comme "touched" pour afficher les erreurs si l'utilisateur force le clic
				this.newOrganizerForm.markAllAsTouched();
			}
		}
	}

	private status = toSignal(this.newOrganizerForm.statusChanges, {
		initialValue: this.newOrganizerForm.status,
	});
	formValid = computed(() => this.status() === "VALID");

	protected fileId: string | null = null;
	showUploadDialog = signal<boolean>(false);

	async ngOnInit() {
		await this.userService.loadUserIfNeeded();
		this.ownerControl.setValue(this.userService.user());
		// init organizations
		merge(
			this.twitterControl.valueChanges,
			this.instagramControl.valueChanges,
			this.tiktokControl.valueChanges
		).subscribe(() => this.updateSocialMedias());

		merge(this.twitchControl.valueChanges, this.youtubeControl.valueChanges).subscribe(() =>
			this.updateBroadcastMedias()
		);

		this.socialMediasControl.setValidators([this.socialMediasValidator(), Validators.minLength(1)]);
		this.broadcastMediasControl.setValidators([
			this.broadcastMediasValidator(),
			Validators.minLength(1),
		]);
		this.orgManagersControl.addValidators(this.validateOrgManagers(this.userService));
	}

	validateOrgManagers(svc: UserService): ValidatorFn {
		return (control: AbstractControl<Suggestion[]>): { [key: string]: any } | null => {
			const codes = (control.value ?? []).map((x) => x.id);
			const uniqueCodes = new Set(codes);
			const currentUser = svc.user?.();

			const errors: Record<string, boolean> = {};

			if (currentUser && uniqueCodes.has(currentUser.id)) errors["includingSelf"] = true;
			if (uniqueCodes.size !== codes.length) errors["notUnique"] = true;

			return Object.keys(errors).length > 0 ? errors : null;
		};
	}

	get orgManagerErrors() {
		const errors = this.orgManagersControl.errors;
		if (!errors) return [];
		return Object.keys(errors);
	}

	orgManagersErrors: Record<string, string> = {
		includingSelf:
			"Vous ne pouvez pas vous ajouter vous-même, vous faites déjà partie des gérants de l'Organisation !",
		notUnique: "La sélection contient au moins un utilisateur dupliqué",
	};

	private normalizerValidator(): ValidatorFn {
		return (control: AbstractControl<string>): { [key: string]: any } | null => {
			if (!control.value) return null;
			if (
				this.nameControl.valid &&
				this.normalizedNameControl.invalid &&
				!this.normalizedNameControl.pristine
			)
				return { normalizedError: true };
			return null;
		};
	}

	protected syncClanNames() {
		this.normalizedNameControl.patchValue(normalizeNames(this.nameControl.value as string));
		this.normalizedNameControl.markAsTouched();
		this.normalizedNameControl.markAsDirty();
		this.normalizedNameControl.updateValueAndValidity();
	}

	protected nameErrors(name: "name" | "normalizedName" | "description") {
		let errors: ValidationErrors | null = null;
		if (name === "name") errors = this.nameControl.errors;
		if (name === "normalizedName") errors = this.normalizedNameControl.errors;
		if (name === "description") errors = this.descriptionControl.errors;
		if (!errors) return [];
		return Object.keys(errors);
	}

	protected namesErrors = this.buildErrorMessages(3, 30);
	protected descriptionsErrors = this.buildErrorMessages(15, 1500);

	private buildErrorMessages(min: number, max: number): Record<string, string> {
		return {
			required: "Ce champ est requis",
			minlength: `Ce champ doit comporter au moins ${min} caractères`,
			maxlength: `Ce champ doit comporter au plus ${max} caractères`,
			pattern: "Les espaces ne sont pas autorisés pour ce champ",
			normalizedError: "La normalisation a échoué, un caractère invalide a été saisi",
		};
	}

	protected socialsErrors: Record<string, string> = {
		invalidSocialUrl: "Le lien saisi n'est pas un lien valide",
		invalidPlatform: "Le lien saisi ne correspond pas à la plateforme choisie",
	};

	protected socialErrors(socialMedia: SocialMedia) {
		let errors: ValidationErrors | null = null;
		if (socialMedia === SocialMedia.Instagram) errors = this.instagramControl.errors;
		if (socialMedia === SocialMedia.TikTok) errors = this.tiktokControl.errors;
		if (socialMedia === SocialMedia.X) errors = this.twitterControl.errors;
		if (socialMedia === SocialMedia.Twitch) errors = this.twitchControl.errors;
		if (socialMedia === SocialMedia.Youtube) errors = this.youtubeControl.errors;
		if (!errors) return [];
		return Object.keys(errors);
	}

	private validateSocial(socialMedia: SocialMedia): ValidatorFn {
		return (control: AbstractControl<string>): { [key: string]: any } | null => {
			if (!control.value) return null;
			let parsed: URL;
			try {
				if (!control.value.startsWith("https")) {
					control.setValue(`https://${control.value}`);
				}
				parsed = new URL(control.value);
			} catch (e) {
				return { invalidSocialUrl: true };
			}
			const host = parsed.hostname.replace("www.", "");
			const pathParts = parsed.pathname.split("/").filter(Boolean);
			if (pathParts.length < 1) return { invalidSocialUrl: true };

			const username = pathParts[0];
			const toTestUsername = username.replace(/^@/, "");
			if (!/^[\w.-]{1,30}$/.test(toTestUsername)) return { invalidSocialUrl: true };
			if (host === "instagram.com" && socialMedia === SocialMedia.Instagram) return null;
			if (host === "tiktok.com" && socialMedia === SocialMedia.TikTok) return null;
			if ((host === "twitter.com" || host === "x.com") && socialMedia === SocialMedia.X)
				return null;
			if (host === "twitch.com" && socialMedia === SocialMedia.Twitch) return null;
			if (host === "youtube.com" && socialMedia === SocialMedia.Youtube) return null;
			return { invalidPlatform: true };
		};
	}

	private updateSocialMedias() {
		const entries: SocialMediaDTO[] = [];

		const mapSocial = (value: string | null, platform: SocialMedia) => {
			if (!value) return;

			const username = this.extractUsername(value);
			const canonicalUrl = this.makeCanonicalUrl(username, platform);

			entries.push({ platform, username, canonicalUrl });
		};

		mapSocial(this.twitterControl.value, SocialMedia.X);
		mapSocial(this.instagramControl.value, SocialMedia.Instagram);
		mapSocial(this.tiktokControl.value, SocialMedia.TikTok);

		this.socialMediasControl.setValue(entries, { emitEvent: false });
		this.socialMediasControl.updateValueAndValidity();
	}

	private updateBroadcastMedias() {
		const entries: SocialMediaDTO[] = [];

		const mapSocial = (value: string | null, platform: SocialMedia) => {
			if (!value) return;

			const username = this.extractUsername(value);
			const canonicalUrl = this.makeCanonicalUrl(username, platform);

			entries.push({ platform, username, canonicalUrl });
		};

		mapSocial(this.twitchControl.value, SocialMedia.Twitch);
		mapSocial(this.youtubeControl.value, SocialMedia.Youtube);

		this.broadcastMediasControl.setValue(entries, { emitEvent: false });
		this.broadcastMediasControl.updateValueAndValidity();
	}

	private extractUsername(url: string): string {
		try {
			const parsed = new URL(url);
			return parsed.pathname.split("/").filter(Boolean)[0] ?? "";
		} catch {
			return url.replace(/^@/, "");
		}
	}

	private makeCanonicalUrl(username: string, platform: SocialMedia): string {
		switch (platform) {
			case SocialMedia.X:
				return `https://twitter.com/${username}`;
			case SocialMedia.Instagram:
				return `https://instagram.com/${username}`;
			case SocialMedia.TikTok:
				return `https://tiktok.com/@${username}`;
			case SocialMedia.Twitch:
				return `https://twitch.com/${username}`;
			case SocialMedia.Youtube:
				return `https://youtube.com/${username}`;
			default:
				return "";
		}
	}

	private socialMediasValidator(): ValidatorFn {
		return () => {
			const invalid =
				this.twitterControl.invalid || this.instagramControl.invalid || this.tiktokControl.invalid;

			return invalid ? { invalidSocialMedias: true } : null;
		};
	}

	private broadcastMediasValidator(): ValidatorFn {
		return () => {
			const invalid = this.twitchControl.invalid || this.youtubeControl.invalid;

			return invalid ? { invalidSocialMedias: true } : null;
		};
	}

	onUpload(event: FileUploadEvent) {
		const original = event.originalEvent as any;
		if (original.ok) {
			this.msg.add({
				summary: "Succès",
				detail: "Image téléversée avec succès.",
				severity: "success",
			});
			this.logoControl.setValue(original.body.url);
			this.fileId = original.body.id;
			this.logoControl.updateValueAndValidity();
		} else {
			this.msg.add({
				summary: "Échec",
				detail: "Échec du téléversement de l'image.",
				severity: "error",
			});
		}
	}

	onUploadError(event: { error?: { status?: number; message?: string } }) {
		const status = event?.error?.status;
		const detail =
			status === 401
				? "Session expirée : reconnecte-toi puis réessaie d'envoyer le logo."
				: status === 413
					? "Image trop lourde (max 6 Mo)."
					: status === 400
						? "Fichier refusé (type non supporté ou formulaire invalide)."
						: "Échec du téléversement du logo. Réessaie ou choisis une autre image.";
		this.msg.add({
			summary: "Échec de l'upload",
			detail,
			severity: "error",
			life: 8000,
		});
	}

	async onRemove(_event: RemoveUploadedFileEvent) {
		if (this.logoControl.valid) {
			const res = await fetch(apiUrl(`/api/proxy/delete/${encodeURIComponent(this.fileId!)}`), {
				credentials: "include",
			});
			if (res.ok) {
				this.msg.add({
					summary: "Succès",
					detail: "Image supprimée du serveur distant.",
					severity: "success",
				});
			} else {
				this.msg.add({
					summary: "Échec",
					detail: "Échec de la suppression de l'image sur le serveur distant.",
					severity: "warn",
				});
			}
			this.logoControl.setValue(null);
			this.logoControl.updateValueAndValidity();
		}
	}

	protected readonly SocialMedia = SocialMedia;
	protected readonly OrganizationFormMode = OrganizationFormMode;
}
