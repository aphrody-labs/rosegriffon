import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { DatePipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Tag } from "primeng/tag";
import { Button } from "primeng/button";
import { Select } from "primeng/select";
import { MultiSelect } from "primeng/multiselect";

import {
	CastAvailabilityStatus,
	CastSlotRole,
	castAvailabilityStatusLabel,
	castAvailabilityStatusSeverity,
	castSlotRoleLabel,
	type CastEvent,
} from "../../../core/models/Cast";

interface SelectOption<T> {
	label: string;
	value: T;
}

export interface AvailabilityFormValue {
	eventId: string;
	status: CastAvailabilityStatus;
	preferredRoles: CastSlotRole[];
}

@Component({
	selector: "app-cast-availability-form",
	standalone: true,
	imports: [DatePipe, FormsModule, Tag, Button, Select, MultiSelect],
	templateUrl: "./cast-availability-form.html",
	styleUrl: "./cast-availability-form.css",
})
export class CastAvailabilityForm implements OnInit {
	@Input() event!: CastEvent;
	@Input() initialStatus: CastAvailabilityStatus = CastAvailabilityStatus.Unavailable;
	@Input() initialPreferredRoles: CastSlotRole[] = [];
	@Input() loading = false;

	@Output() submitted = new EventEmitter<AvailabilityFormValue>();

	selectedStatus: CastAvailabilityStatus = CastAvailabilityStatus.Unavailable;
	selectedRoles: CastSlotRole[] = [];

	statusOptions: SelectOption<CastAvailabilityStatus>[] = Object.values(CastAvailabilityStatus).map(
		(s) => ({ label: castAvailabilityStatusLabel(s), value: s })
	);

	roleOptions: SelectOption<CastSlotRole>[] = Object.values(CastSlotRole).map((r) => ({
		label: castSlotRoleLabel(r),
		value: r,
	}));

	ngOnInit(): void {
		this.selectedStatus = this.initialStatus;
		this.selectedRoles = [...this.initialPreferredRoles];
	}

	onSubmit(): void {
		this.submitted.emit({
			eventId: this.event.id,
			status: this.selectedStatus,
			preferredRoles: this.selectedRoles,
		});
	}

	protected readonly castAvailabilityStatusSeverity = castAvailabilityStatusSeverity;
	protected readonly castAvailabilityStatusLabel = castAvailabilityStatusLabel;
}
