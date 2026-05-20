"use client";

import React from "react";

import TeamMembersSection from "./TeamMembersSection";

function BoardMembersSection() {
  return (
    <TeamMembersSection
      queryKey="board-members"
      teamName="bureauteam"
      title="Bureau de l'Association"
      description="Les membres du bureau de l'association Rose Griffon sont responsables de la gestion administrative, légale et financière du projet. Ils assurent le bon fonctionnement de l'association et coordonnent les différentes équipes."
      showRole
    />
  );
}

export default React.memo(BoardMembersSection);
