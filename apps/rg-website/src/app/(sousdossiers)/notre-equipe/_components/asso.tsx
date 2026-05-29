"use client";

import React from "react";

import TeamMembersSection from "./TeamMembersSection";

function AssoMembersSection() {
	return (
		<TeamMembersSection
			queryKey="asso-members"
			teamName="assoteam"
			title="Membres de l'Association"
			description="Les membres de l'association Rose Griffon contribuent au développement et à la réalisation du projet. Leur engagement et leur passion sont essentiels à notre succès collectif."
		/>
	);
}

export default React.memo(AssoMembersSection);
