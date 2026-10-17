import { Component, signal } from "@angular/core";
import { TournamentCreationForm } from "../../shared/components/tournament-creation-form/tournament-creation-form.component";

@Component({
	selector: "app-tournament-creation",
	imports: [TournamentCreationForm],
	templateUrl: "./tournament-creation.html",
	styleUrl: "./tournament-creation.css",
})
export class TournamentCreation {}
