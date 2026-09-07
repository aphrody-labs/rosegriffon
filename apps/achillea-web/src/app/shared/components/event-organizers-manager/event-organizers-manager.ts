import { Component, computed, input, output, signal, inject } from "@angular/core";
import { Button } from "primeng/button";
import { Searchbar } from "../searchbar/searchbar";
import { TournamentsService } from "../../services/tournaments-service";
import { Tab, TabList, TabPanel, TabPanels, Tabs } from "primeng/tabs";
import { Tournament } from "../../../core/models/Tournament";
import { FormControl, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { Suggestion } from "../../../core/models/Suggestion";
import { Avatar } from "primeng/avatar";
import { suggestionToUserDTO } from "../../../core/models/User";
import { UserDTO } from "../../services/user-service";
import { RouterLink } from "@angular/router";

@Component({
	selector: "app-event-organizers-manager",
	imports: [
		Button,
		Searchbar,
		Tabs,
		Tab,
		TabList,
		TabPanel,
		TabPanels,
		Avatar,
		ReactiveFormsModule,
		FormsModule,
		RouterLink,
	],
	templateUrl: "./event-organizers-manager.html",
	styleUrl: "./event-organizers-manager.css",
})
export class EventOrganizersManager {
	private tService = inject(TournamentsService);

	refreshEvent = output<boolean>();
	closeDialog = output<boolean>();
	event = input.required<Tournament>();

	protected newTOsControl = new FormControl<Suggestion[]>([]);
	protected activeTab = signal<string | number>(0);
	protected adding = signal(false);
	protected removingId = signal<string | null>(null);

	/** Liste réactive des managers du tournoi (input signal). */
	protected managers = computed(() => this.event()?.managers ?? []);

	protected onTabChange(value: string | number | undefined) {
		if (value !== undefined && value !== null) this.activeTab.set(value);
	}

	async addTOs() {
		const selected = this.newTOsControl.getRawValue() ?? [];
		if (!selected.length) return;

		this.adding.set(true);
		try {
			const res = await this.tService.addTOs(
				this.event().id,
				selected.map((suggestion: Suggestion) => suggestionToUserDTO(suggestion))
			);
			if (res) {
				this.refreshEvent.emit(true);
				this.newTOsControl.reset([]);
				this.activeTab.set(0);
			}
		} finally {
			this.adding.set(false);
		}
	}

	async removeTO(to: UserDTO) {
		this.removingId.set(to.id);
		try {
			const res = await this.tService.removeTO(this.event().id, to);
			if (res) this.refreshEvent.emit(true);
		} finally {
			this.removingId.set(null);
		}
	}

	cancel() {
		this.newTOsControl.reset([]);
		this.closeDialog.emit(true);
	}
}
