import { OrganizationDTO } from "./Organization";
import { Tournament } from "./Tournament";

export interface TournamentSeries {
	id: number;
	name: string;
	description: string;
	logo: string;
	organization: OrganizationDTO;
	tournaments: Tournament[];
}
