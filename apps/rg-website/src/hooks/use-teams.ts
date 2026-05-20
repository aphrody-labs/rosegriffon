import { useQuery } from "@tanstack/react-query";

import getTeamMembers from "@/lib/get-team-members";

interface TeamMember {
  name: string;
  role: string;
  image?: string;
  link?: string;
}

interface Team {
  name: string;
  members: TeamMember[];
}

export function useTeams(teamConfig: Record<string, string>) {
  const { data: teams, isLoading } = useQuery<Team[]>({
    gcTime: 30 * 60 * 1000, // 30 minutes
    queryFn: async () => {
      const teamIds = Object.keys(teamConfig);

      const teamsData = await Promise.all(
        teamIds.map(async (teamId) => {
          try {
            const members = await getTeamMembers(teamId);

            return {
              name: teamConfig[teamId] ?? teamId,
              members: members.map((member) => ({
                name: member.metadata.memberName,
                role: member.metadata.memberRole,
                image: member.url,
                link: member.metadata.memberLink || undefined,
              })),
            };
          } catch (error) {
            console.error(`Error processing team ${teamId}:`, error);
            return {
              name: teamConfig[teamId] ?? teamId,
              members: [],
            };
          }
        })
      );

      return teamsData.filter((team) => team.members.length > 0);
    },
    queryKey: ["teams"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return { isLoading, teams };
}
