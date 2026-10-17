import {
	Component,
	EventEmitter,
	inject,
	Input,
	OnChanges,
	Output,
	SimpleChanges,
} from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { FloatLabel } from "primeng/floatlabel";
import { InputText } from "primeng/inputtext";
import { Textarea } from "primeng/textarea";
import { ToggleSwitch } from "primeng/toggleswitch";
import { FileUpload, FileUploadErrorEvent, FileUploadEvent } from "primeng/fileupload";
import { Message } from "primeng/message";
import { MessageService } from "primeng/api";
import { ButtonModule } from "primeng/button";

import { ClanDTO } from "../../../core/models/Clan";
import { ClanService } from "../../services/clan-service";
import { apiUrl } from "../../../core/http/api-url";

/**
 * Formulaire d'édition des infos d'un clan (logo, nom, tag, bio, réseaux,
 * recrutement) — partagé entre le dashboard du clan (président/staff, cf.
 * ClansController.updateClanInfo) et la page "Gestion des clans" du dashboard
 * admin (n'importe quel clan, admin uniquement → [showInactiveToggle]="true").
 */
@Component({
	selector: "app-clan-info-form",
	standalone: true,
	imports: [
		ReactiveFormsModule,
		FloatLabel,
		InputText,
		Textarea,
		ToggleSwitch,
		FileUpload,
		Message,
		ButtonModule,
	],
	templateUrl: "./clan-info-form.html",
})
export class ClanInfoForm implements OnChanges {
	private clanService = inject(ClanService);
	private msg = inject(MessageService);

	@Input() clan: ClanDTO | undefined;
	/** Autorise toujours l'édition (admin) — sinon désactivé si aucun droit côté parent. */
	@Input() canEdit = true;
	/** Contexte admin : ajoute le toggle "Clan inactif" (réservé admin, cf. ClansController). */
	@Input() showInactiveToggle = false;
	@Output() saved = new EventEmitter<ClanDTO>();

	protected readonly uploadUrl = apiUrl("/api/proxy/upload");
	saving = false;

	protected nameControl = new FormControl<string>("", [
		Validators.required,
		Validators.minLength(3),
		Validators.maxLength(30),
	]);
	protected shortenedNameControl = new FormControl<string>("", [
		Validators.required,
		Validators.minLength(2),
		Validators.maxLength(3),
	]);
	protected clanAvatarUrlControl = new FormControl<string>("", [Validators.required]);
	protected clanBiographyControl = new FormControl<string>("", [Validators.maxLength(1500)]);
	protected xUrlControl = new FormControl<string>("");
	protected instagramUrlControl = new FormControl<string>("");
	protected tiktokUrlControl = new FormControl<string>("");
	protected isRecruitingControl = new FormControl<boolean>(false, { nonNullable: true });
	protected autoAcceptMembersControl = new FormControl<boolean>(false, { nonNullable: true });
	protected isInactiveControl = new FormControl<boolean>(false, { nonNullable: true });

	protected infoForm = new FormGroup({
		name: this.nameControl,
		shortenedName: this.shortenedNameControl,
		clanAvatarUrl: this.clanAvatarUrlControl,
		clanBiography: this.clanBiographyControl,
		xUrl: this.xUrlControl,
		instagramUrl: this.instagramUrlControl,
		tiktokUrl: this.tiktokUrlControl,
		isRecruiting: this.isRecruitingControl,
		autoAcceptMembers: this.autoAcceptMembersControl,
	});

	ngOnChanges(changes: SimpleChanges) {
		if (changes["clan"]) this.resetForm();
		if (changes["canEdit"]) {
			if (this.canEdit) this.infoForm.enable({ emitEvent: false });
			else this.infoForm.disable({ emitEvent: false });
		}
	}

	private resetForm() {
		if (!this.clan) return;
		this.infoForm.patchValue({
			name: this.clan.name,
			shortenedName: this.clan.shortenedName,
			clanAvatarUrl: this.clan.clanAvatarUrl,
			clanBiography: this.clan.clanBiography,
			xUrl: this.clan.xUrl ?? "",
			instagramUrl: this.clan.instagramUrl ?? "",
			tiktokUrl: this.clan.tiktokUrl ?? "",
			isRecruiting: this.clan.isRecruiting,
			autoAcceptMembers: this.clan.autoAcceptMembers,
		});
		this.isInactiveControl.setValue(!!this.clan.isInactive);
		this.infoForm.markAsPristine();
		this.isInactiveControl.markAsPristine();
		if (!this.canEdit) this.infoForm.disable({ emitEvent: false });
	}

	onLogoUpload(event: FileUploadEvent) {
		const original = event.originalEvent as any;
		if (original.ok) {
			this.msg.add({
				summary: "Succès",
				detail: "Logo téléversé avec succès.",
				severity: "success",
			});
			this.clanAvatarUrlControl.setValue(original.body.url);
			this.clanAvatarUrlControl.markAsDirty();
		} else {
			this.msg.add({
				summary: "Échec",
				detail: "Échec du téléversement du logo.",
				severity: "error",
			});
		}
	}

	onLogoUploadError(event: FileUploadErrorEvent) {
		// Le typage PrimeNG déclare `error` comme un `ErrorEvent` DOM générique, mais l'implémentation
		// XHR renvoie en pratique l'objet de réponse (avec `.status`) — cast nécessaire ici.
		const status = (event?.error as unknown as { status?: number } | undefined)?.status;
		const detail =
			status === 401
				? "Session expirée : reconnecte-toi puis réessaie d'envoyer le logo."
				: status === 413
					? "Image trop lourde (max 6 Mo)."
					: status === 400
						? "Fichier refusé (type non supporté)."
						: "Échec du téléversement du logo. Réessaie ou choisis une autre image.";
		this.msg.add({ summary: "Échec de l'upload", detail, severity: "error", life: 8000 });
	}

	get formDirty(): boolean {
		return this.infoForm.dirty || (this.showInactiveToggle && this.isInactiveControl.dirty);
	}

	async save() {
		if (!this.clan || !this.canEdit || this.infoForm.invalid) {
			this.infoForm.markAllAsTouched();
			return;
		}

		this.saving = true;
		const raw = this.infoForm.getRawValue();
		const patch: Parameters<ClanService["updateClanInfo"]>[1] = {
			name: raw.name!,
			shortenedName: raw.shortenedName!,
			clanAvatarUrl: raw.clanAvatarUrl!,
			clanBiography: raw.clanBiography ?? "",
			xUrl: raw.xUrl || null,
			instagramUrl: raw.instagramUrl || null,
			tiktokUrl: raw.tiktokUrl || null,
			isRecruiting: raw.isRecruiting,
			autoAcceptMembers: raw.autoAcceptMembers,
		};
		if (this.showInactiveToggle && this.isInactiveControl.dirty) {
			patch.isInactive = this.isInactiveControl.value;
		}

		const res = await this.clanService.updateClanInfo(this.clan.id, patch);
		this.saving = false;

		if (res.success && res.clan) {
			this.clan = res.clan;
			this.resetForm();
			this.saved.emit(res.clan);
		}
	}
}
