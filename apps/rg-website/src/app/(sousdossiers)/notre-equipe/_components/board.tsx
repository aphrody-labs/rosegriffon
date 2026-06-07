import TeamMembersSection from "./TeamMembersSection";

export default function BoardMembersSection() {
	return (
		<TeamMembersSection
			teamName="bureauteam"
			title="Bureau de l'Association"
			description="Les membres du bureau de l'association Rose Griffon sont responsables de la gestion administrative, légale et financière du projet. Ils assurent le bon fonctionnement de l'association et coordonnent les différentes équipes."
			showRole
			canonicalUrl="https://rosegriffon.fr/notre-equipe/association"
			isH1
		/>
	);
}
