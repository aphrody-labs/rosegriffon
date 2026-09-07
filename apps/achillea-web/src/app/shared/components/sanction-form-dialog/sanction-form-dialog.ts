import { Component, EventEmitter, Input, OnInit, Output, inject } from "@angular/core";
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { Dialog } from "primeng/dialog";
import { Button } from "primeng/button";
import { Select } from "primeng/select";
import { InputText } from "primeng/inputtext";
import { InputNumber } from "primeng/inputnumber";
import { Textarea } from "primeng/textarea";

import {
	CreateSanctionPayload,
	SanctionType,
	sanctionTypeLabel,
} from "../../../core/models/Sanction";

interface SelectOption {
	label: string;
	value: string;
}

@Component({
	selector: "app-sanction-form-dialog",
	standalone: true,
	imports: [Dialog, Button, Select, InputText, InputNumber, Textarea, ReactiveFormsModule],
	templateUrl: "./sanction-form-dialog.html",
	styleUrl: "./sanction-form-dialog.css",
})
export class SanctionFormDialog implements OnInit {
	private fb = inject(FormBuilder);

	@Input() visible = false;
	@Input() guildId = "";
	@Output() visibleChange = new EventEmitter<boolean>();
	@Output() submitted = new EventEmitter<CreateSanctionPayload>();

	form!: FormGroup;

	typeOptions: SelectOption[] = Object.values(SanctionType).map((t) => ({
		label: sanctionTypeLabel(t),
		value: t,
	}));

	get hasDuration(): boolean {
		const t = this.form?.get("type")?.value as SanctionType | null;
		return t === SanctionType.Mute || t === SanctionType.Ban;
	}

	ngOnInit(): void {
		this.form = this.fb.group({
			userId: ["", [Validators.required, Validators.minLength(17)]],
			type: [SanctionType.Warn, Validators.required],
			reason: ["", [Validators.required, Validators.minLength(3)]],
			durationSec: [null],
		});
	}

	onClose(): void {
		this.form.reset({ type: SanctionType.Warn });
		this.visibleChange.emit(false);
	}

	onSubmit(): void {
		if (this.form.invalid) return;

		const payload: CreateSanctionPayload = {
			userId: this.form.value.userId,
			guildId: this.guildId,
			type: this.form.value.type,
			reason: this.form.value.reason || null,
			durationSec: this.hasDuration ? (this.form.value.durationSec ?? null) : null,
		};

		this.submitted.emit(payload);
		this.onClose();
	}

	protected readonly sanctionTypeLabel = sanctionTypeLabel;
}
