import { getAllTeamMembers } from "./actions";
import { StaffClientPage } from "./StaffClientPage";

export const dynamic = "force-dynamic";

export default async function StaffAdminPage() {
	const { data: members } = await getAllTeamMembers();

	return (
		<div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
			<StaffClientPage initialMembers={members || []} />
		</div>
	);
}
