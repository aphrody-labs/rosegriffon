import { Component, effect, inject, OnInit, signal } from "@angular/core";
import { Step, StepList, StepPanel, StepPanels, Stepper } from "primeng/stepper";
import { Button } from "primeng/button";
import { UserService } from "../../shared/services/user-service";
import { AutoComplete } from "primeng/autocomplete";
import { IconField } from "primeng/iconfield";
import { InputIcon } from "primeng/inputicon";
import { Tag } from "primeng/tag";
import {
	AbstractControl,
	FormBuilder,
	FormControl,
	FormsModule,
	ReactiveFormsModule,
	ValidationErrors,
	ValidatorFn,
	Validators,
} from "@angular/forms";
import { Suggestion } from "../../core/models/Suggestion";
import { Panel } from "primeng/panel";
import { FloatLabel } from "primeng/floatlabel";
import { Message } from "primeng/message";
import { FileUpload, FileUploadEvent, RemoveUploadedFileEvent } from "primeng/fileupload";
import { MessageService } from "primeng/api";
import { Toast } from "primeng/toast";
import { InputText } from "primeng/inputtext";
import { Fieldset } from "primeng/fieldset";
import { InputGroup } from "primeng/inputgroup";
import { InputGroupAddon } from "primeng/inputgroupaddon";
import { Country } from "../../shared/services/language-service";
import { ClanService } from "../../shared/services/clan-service";
import { LanguageSelect } from "../../shared/components/language-select/language-select";
import { Textarea } from "primeng/textarea";
import { IftaLabel } from "primeng/iftalabel";
import { CountrySelect } from "../../shared/components/country-select/country-select";
import { AnimationOptions, LottieComponent } from "ngx-lottie";
import { AnimationItem } from "lottie-web";
import { Dialog } from "primeng/dialog";
import { Router } from "@angular/router";
import { getEloImagePath, normalizeNames } from "../../core/helpers/misc";
import { SocialMedia } from "../../core/models/SocialMedia";
import { apiUrl } from "../../core/http/api-url";

@Component({
	selector: "app-clan-creation",
	imports: [
		Stepper,
		StepList,
		Step,
		StepPanels,
		StepPanel,
		Button,
		AutoComplete,
		IconField,
		InputIcon,
		Tag,
		FormsModule,
		ReactiveFormsModule,
		Panel,
		FloatLabel,
		Message,
		FileUpload,
		Toast,
		InputText,
		Fieldset,
		InputGroup,
		InputGroupAddon,
		LanguageSelect,
		Textarea,
		IftaLabel,
		CountrySelect,
		LottieComponent,
		Dialog,
	],
	templateUrl: "./clan-creation.html",
	styleUrl: "./clan-creation.css",
})
export class ClanCreation implements OnInit {
	protected svc = inject(UserService);
	private msg = inject(MessageService);
	protected clanSvc = inject(ClanService);
	private router = inject(Router);

	protected readonly uploadUrl = apiUrl("/api/proxy/upload");

	fileId: string | null = null;
	showCongrats = signal<boolean>(false);
	currentStep = signal(1);

	completedOptions: AnimationOptions = {
		path: "animations/completed.json",
		autoplay: true,
		loop: false,
	};

	newClanError = signal<string | undefined>(undefined);

	constructor() {
		effect(() => {
			const response = this.clanSvc.newClanResponse();
			if (!response) return;

			// Success case
			if (!("error" in response)) {
				this.showCongrats.set(true);
				return;
			}

			// Error case
			this.showCongrats.set(false);

			switch (response.code) {
				case "FOUNDERS":
				case "DISCORD_USER_FETCH_ERROR":
					this.foundersControl.reset();
					this.currentStep.set(1);
					break;
				case "NAME":
					this.nameControl.reset();
					this.normalizedNameControl.reset();
					break;
				case "SHORT_NAME":
					this.shortNameControl.reset();
					this.normalizedShortNameControl.reset();
					break;
				case "SOCIALS":
					this.twitterControl.reset();
					this.instagramControl.reset();
					this.tiktokControl.reset();
					break;
			}

			this.newClanError.set(response.error);
		});
	}

	async ngOnInit() {
		await this.svc.loadUserIfNeeded();
		this.foundersControl.addValidators(this.validateFounders(this.svc));
	}

	onAnimationCreated(animationItem: AnimationItem) {
		animationItem.addEventListener("complete", () => {
			this.showCongrats.set(false);
			const response = this.clanSvc.newClanResponse();
			if (response && "success" in response) {
				const clanId = response.clanId;
				this.svc.patchUser({ clanId });
			}
			this.form.reset();
			this.clanSvc.resetNewClan();
			if (this.svc.user()?.clanId) return this.router.navigate(["/clans", this.svc.user()?.clanId]);
			return this.router.navigateByUrl("/");
		});
	}

	onErrorModalClose() {
		this.newClanError.set(undefined);
	}

	private formBuilder = inject(FormBuilder);

	foundersControl = new FormControl<Suggestion[]>([], [Validators.required]);
	logoControl = new FormControl<string | null>(null, [Validators.required]);
	nameControl = new FormControl<string>("", [
		Validators.required,
		Validators.minLength(3),
		Validators.maxLength(30),
		this.normalizerValidator("name"),
	]);
	normalizedNameControl = new FormControl<string>("", [
		Validators.required,
		Validators.minLength(3),
		Validators.maxLength(30),
	]);
	shortNameControl = new FormControl<string>("", [
		Validators.required,
		Validators.minLength(2),
		Validators.maxLength(6),
		Validators.pattern("^[^\\s]+$"),
		this.normalizerValidator("shortName"),
	]);
	normalizedShortNameControl = new FormControl<string>("", [
		Validators.required,
		Validators.minLength(2),
		Validators.maxLength(3),
		Validators.pattern("^[^\\s]+$"),
	]);
	descriptionControl = new FormControl<string>("", [
		Validators.required,
		Validators.maxLength(1500),
		Validators.minLength(15),
	]);
	twitterControl = new FormControl<string>("", [this.validateSocial(SocialMedia.X)]);
	instagramControl = new FormControl<string>("", [this.validateSocial(SocialMedia.Instagram)]);
	tiktokControl = new FormControl<string>("", [this.validateSocial(SocialMedia.TikTok)]);
	originControl = new FormControl<Country | null>(null, [Validators.required]);
	languagesControl = new FormControl<Country[]>([], [Validators.required, Validators.minLength(1)]);

	form = this.formBuilder.group(
		{
			founders: this.foundersControl,
			description: this.descriptionControl,
			logo: this.logoControl,
			name: this.nameControl,
			normalizedName: this.normalizedNameControl,
			shortName: this.shortNameControl,
			normalizedShortName: this.normalizedShortNameControl,
			twitter: this.twitterControl,
			instagram: this.instagramControl,
			tiktok: this.tiktokControl,
			origin: this.originControl,
			languages: this.languagesControl,
		},
		{
			validators: this.atLeastOneFieldValidator(["twitter", "instagram", "tiktok"]),
		}
	);

	nameErrors(name: "short" | "normalizedShort" | "name" | "normalizedName" | "description") {
		let errors: ValidationErrors | null = null;
		if (name === "short") errors = this.shortNameControl.errors;
		if (name === "normalizedShort") errors = this.normalizedShortNameControl.errors;
		if (name === "name") errors = this.nameControl.errors;
		if (name === "normalizedName") errors = this.normalizedNameControl.errors;
		if (name === "description") errors = this.descriptionControl.errors;
		if (!errors) return [];
		return Object.keys(errors);
	}

	namesErrors = this.buildErrorMessages(3, 30);
	shortNamesErrors = this.buildErrorMessages(2, 6);
	normalizedShortNamesErrors = this.buildErrorMessages(2, 3);
	descriptionsErrors = this.buildErrorMessages(15, 1500);

	buildErrorMessages(min: number, max: number): Record<string, string> {
		return {
			required: "Ce champ est requis",
			minlength: `Ce champ doit comporter au moins ${min} caractères`,
			maxlength: `Ce champ doit comporter au plus ${max} caractères`,
			pattern: "Les espaces ne sont pas autorisés pour ce champ",
			normalizedError: "La normalisation a échoué, un caractère invalide a été saisi",
		};
	}

	validateFounders(svc: UserService): ValidatorFn {
		return (control: AbstractControl<Suggestion[]>): { [key: string]: any } | null => {
			const codes = (control.value ?? []).map((x) => x.id);
			const uniqueCodes = new Set(codes);
			const currentUser = svc.user?.();

			const errors: Record<string, boolean> = {};

			if (currentUser && uniqueCodes.has(currentUser.id)) errors["includingSelf"] = true;
			if (codes.length !== 4) errors["needs4"] = true;
			if (uniqueCodes.size !== codes.length) errors["notUnique"] = true;

			return Object.keys(errors).length > 0 ? errors : null;
		};
	}

	get founderErrors() {
		const errors = this.foundersControl.errors;
		if (!errors) return [];
		return Object.keys(errors);
	}

	foundersErrors: Record<string, string> = {
		includingSelf:
			"Vous ne pouvez pas vous ajouter vous-même, vous faites déjà partie des fondateurs !",
		notUnique: "La sélection contient au moins un utilisateur dupliqué",
		needs4: "La sélection doit comprendre 4 utilisateurs",
	};

	normalizerValidator(name: "name" | "shortName"): ValidatorFn {
		return (control: AbstractControl<string>): { [key: string]: any } | null => {
			if (!control.value) return null;
			if (
				name === "shortName" &&
				this.shortNameControl.valid &&
				this.normalizedShortNameControl.invalid &&
				!this.normalizedShortNameControl.pristine
			)
				return { normalizedError: true };
			if (
				name === "name" &&
				this.nameControl.valid &&
				this.normalizedNameControl.invalid &&
				!this.normalizedNameControl.pristine
			)
				return { normalizedError: true };
			return null;
		};
	}

	validateSocial(socialMedia: SocialMedia): ValidatorFn {
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
			return { invalidPlatform: true };
		};
	}

	socialsErrors: Record<string, string> = {
		invalidSocialUrl: "Le lien saisi n'est pas un lien valide",
		invalidPlatform: "Le lien saisi ne correspond pas à la plateforme choisie",
	};

	socialErrors(socialMedia: SocialMedia) {
		let errors: ValidationErrors | null = null;
		if (socialMedia === SocialMedia.Instagram) errors = this.instagramControl.errors;
		if (socialMedia === SocialMedia.TikTok) errors = this.tiktokControl.errors;
		if (socialMedia === SocialMedia.X) errors = this.twitterControl.errors;
		if (!errors) return [];
		return Object.keys(errors);
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

	syncShortNames() {
		this.normalizedShortNameControl.patchValue(
			normalizeNames(this.shortNameControl.value as string)
		);
		this.normalizedShortNameControl.markAsTouched();
		this.normalizedShortNameControl.markAsDirty();
		this.normalizedShortNameControl.updateValueAndValidity();
	}

	syncClanNames() {
		this.normalizedNameControl.patchValue(normalizeNames(this.nameControl.value as string));
		this.normalizedNameControl.markAsTouched();
		this.normalizedNameControl.markAsDirty();
		this.normalizedNameControl.updateValueAndValidity();
	}

	onOriginSelect(origin: Country) {
		this.originControl.setValue(origin);
		this.originControl.updateValueAndValidity();
		if (this.originControl.valid) {
			this.languagesControl.updateValueAndValidity();
		}
	}

	onSubmit() {
		if (this.form.invalid) return;
		this.clanSvc.submitNewClan(this.form.getRawValue());
	}

	atLeastOneFieldValidator(keys: string[]) {
		return (control: AbstractControl): ValidationErrors | null => {
			const hasAtLeastOne = keys.some((key) => {
				const field = control.get(key);
				return field && field.value?.trim?.() !== "";
			});

			return hasAtLeastOne ? null : { atLeastOneRequired: true };
		};
	}

	protected readonly SocialMedia = SocialMedia;
	protected readonly getEloImagePath = getEloImagePath;
}
