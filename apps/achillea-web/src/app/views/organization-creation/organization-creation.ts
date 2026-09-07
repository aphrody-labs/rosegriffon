import { Component } from "@angular/core";
import { OrganizerForm } from "../../shared/components/organizer-form/organizer-form";

@Component({
	selector: "app-organization-creation",
	imports: [OrganizerForm],
	templateUrl: "./organization-creation.html",
	styleUrl: "./organization-creation.css",
})
export class OrganizationCreation {}
