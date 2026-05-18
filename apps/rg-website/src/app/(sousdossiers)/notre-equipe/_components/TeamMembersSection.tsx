"use client";

import { useQuery } from "@tanstack/react-query";
import React, { useMemo } from "react";

import ImageWithSkeleton from "@/components/shared/ImageWithSkeleton";
import { Skeleton } from "@rosegriffon/ui";
import getTeamMembers from "@/lib/get-team-members";

type TeamMember = {
  name: string;
  role: string;
  image?: string;
  index: number;
};

type TeamMembersSectionProps = {
  queryKey: string;
  teamName: string;
  title: string;
  description: string;
  showRole?: boolean;
};

function TeamMembersSection({
  queryKey,
  teamName,
  title,
  description,
  showRole = false,
}: TeamMembersSectionProps) {
  const { data: members, isLoading } = useQuery<TeamMember[]>({
    queryKey: [queryKey],
    queryFn: async () => {
      const response = await getTeamMembers(teamName);
      return response.map((member) => ({
        name: member.metadata.memberName,
        role: member.metadata.memberRole,
        index: member.metadata.memberIndex,
        image: member.url,
      }));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  const loadingSkeletons = useMemo(
    () =>
      [...Array(8)].map((_, index) => (
        <div key={index} className="flex flex-col items-center text-center gap-4 w-full p-4 sm:p-6">
          <Skeleton className="size-28 sm:w-36 sm:h-36 lg:w-40 lg:h-40 rounded-full bg-linear-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 animate-pulse" />
          <div className="space-y-2 w-full">
            <Skeleton className="h-5 sm:h-6 w-3/4 mx-auto bg-gray-200 dark:bg-gray-700" />
            <Skeleton className="h-4 w-1/2 mx-auto bg-gray-200 dark:bg-gray-700" />
          </div>
        </div>
      )),
    []
  );

  const membersContent = useMemo(() => {
    if (!members) return null;

    return members
      .sort((a, b) => a.index - b.index)
      .map((member: TeamMember, idx: number) => (
        <div
          key={`${member.name}-${idx}`}
          className="group flex flex-col items-center text-center gap-3 sm:gap-4 w-full p-4 sm:p-6 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-300 animate-fade-in"
          style={{ animationDelay: `${idx * 50}ms` }}
        >
          <div className="relative">
            <div className="relative size-28 sm:w-36 sm:h-36 lg:w-40 lg:h-40 rounded-full overflow-hidden border-3 sm:border-4 border-gaelle-blue group-hover:border-gaelle-blue-light transition-all duration-300 group-hover:scale-105 group-hover:shadow-2xl group-hover:shadow-gaelle-blue/20">
              <ImageWithSkeleton
                src={member.image || "https://placehold.co/200x200"}
                alt={`${member.name} Rose Griffon`}
                priority={member.index < 3}
              />
            </div>
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-full bg-gaelle-blue/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />
          </div>
          <div className="space-y-1 w-full">
            <h3 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 dark:text-white group-hover:text-gaelle-blue dark:group-hover:text-gaelle-blue-light transition-colors duration-200 wrap-break-word">
              {member.name}
            </h3>
            {showRole && (
              <p className="text-xs sm:text-sm lg:text-base font-medium text-gaelle-blue dark:text-gaelle-blue-light bg-gaelle-blue/10 dark:bg-gaelle-blue/20 px-2 sm:px-3 py-1 rounded-full inline-block">
                {member.role}
              </p>
            )}
          </div>
        </div>
      ));
  }, [members, showRole]);

  return (
    <section className="flex flex-col gap-10 lg:gap-12">
      <div className="text-center space-y-4 max-w-4xl mx-auto animate-fade-in">
        <h2 className="text-4xl lg:text-6xl font-black bg-linear-to-r from-gaelle-blue to-gaelle-blue-light dark:from-gaelle-blue-light dark:to-gaelle-blue bg-clip-text text-transparent">
          {title}
        </h2>
        <p className="text-lg lg:text-xl text-gray-700 dark:text-gray-300 leading-relaxed">
          {description}
        </p>
        <div className="w-24 h-1 bg-linear-to-r from-gaelle-blue to-gaelle-blue-light mx-auto rounded-full" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6 lg:gap-8 mt-6">
        {isLoading ? loadingSkeletons : membersContent}
      </div>
    </section>
  );
}

export default React.memo(TeamMembersSection);
