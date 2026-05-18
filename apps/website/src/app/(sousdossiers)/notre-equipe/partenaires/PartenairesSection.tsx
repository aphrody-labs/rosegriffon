"use client";

import { Button } from "@rosegriffon/ui";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo } from "react";

import ImageWithSkeleton from "@/components/shared/ImageWithSkeleton";

import { Skeleton } from "@rosegriffon/ui";
import getTeamMembers from "@/lib/get-team-members";
import { ArrowUpRight } from "@/lib/icons-config";
import { createLogger } from "@/lib/logger";

const logger = createLogger("PartenairesSection");

type TeamMember = {
  name: string;
  role: string;
  image?: string;
  index: number;
  link?: string;
};

export default function PartenairesSection() {
  const { data: collaborateurs, isLoading } = useQuery<TeamMember[]>({
    queryKey: ["collaborateurs"],
    queryFn: async () => {
      const response = await getTeamMembers("collabteam");
      logger.debug("Données des partenaires:", response);
      return response.map((member) => ({
        name: member.metadata.memberName,
        role: member.metadata.memberRole,
        index: member.metadata.memberIndex,
        link: member.metadata.memberLink || "",
        image: member.url,
      }));
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const loadingSkeletons = useMemo(
    () =>
      [...Array(8)].map((_, index) => (
        <div key={index} className="flex flex-col items-center text-center gap-4 p-4 sm:p-6">
          <Skeleton className="size-28 sm:w-36 sm:h-36 lg:w-40 lg:h-40 rounded-full bg-linear-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 animate-pulse" />
          <div className="space-y-2 w-full">
            <Skeleton className="h-5 sm:h-6 w-3/4 mx-auto bg-gray-200 dark:bg-gray-700" />
            <Skeleton className="h-4 w-1/2 mx-auto bg-gray-200 dark:bg-gray-700" />
          </div>
        </div>
      )),
    []
  );

  const partnersContent = useMemo(() => {
    if (!collaborateurs || collaborateurs.length === 0) {
      return (
        <div className="col-span-full text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">
            Aucun partenaire à afficher pour le moment.
          </p>
        </div>
      );
    }

    return collaborateurs
      .sort((a, b) => a.index - b.index)
      .map((member: TeamMember, idx: number) => (
        <div
          key={member.index}
          className="group flex flex-col items-center text-center gap-3 sm:gap-4 p-4 sm:p-6 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-300 animate-fade-in"
          style={{ animationDelay: `${idx * 100}ms` }}
        >
          <div className="relative">
            <div className="relative size-28 sm:w-36 sm:h-36 lg:w-40 lg:h-40 rounded-full overflow-hidden border-3 sm:border-4 border-[#2f6e9c]/30 group-hover:border-[#2f6e9c] transition-all duration-300 group-hover:scale-105 group-hover:shadow-2xl group-hover:shadow-[#2f6e9c]/20">
              <ImageWithSkeleton
                src={member.image || "https://placehold.co/200x200"}
                alt={`${member.name} Rose Griffon`}
                priority={member.index < 3}
              />
            </div>
            <div className="absolute inset-0 rounded-full bg-[#2f6e9c]/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />
          </div>
          <div className="space-y-1 sm:space-y-2 w-full">
            <h3 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 dark:text-white group-hover:text-[#2f6e9c] dark:group-hover:text-[#4088b8] transition-colors duration-200 break-words">
              {member.name}
            </h3>
            <p className="text-xs sm:text-sm lg:text-base font-medium text-[#2f6e9c] dark:text-[#4088b8] bg-[#2f6e9c]/10 dark:bg-[#2f6e9c]/20 px-2 sm:px-3 py-1 rounded-full inline-block">
              {member.role}
            </p>
            {member.link && member.link.trim() !== "" && (
              <Link href={member.link} target="_blank" rel="noopener noreferrer">
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 text-xs sm:text-sm border-[#2f6e9c]/50 text-[#2f6e9c] hover:bg-[#2f6e9c] hover:text-white dark:border-[#4088b8]/50 dark:text-[#4088b8] dark:hover:bg-[#4088b8] dark:hover:text-white transition-all duration-300 group-hover:shadow-lg"
                >
                  Visiter
                  <ArrowUpRight className="size-3 sm:w-4 sm:h-4 ml-1" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      ));
  }, [collaborateurs]);

  return (
    <section className="flex flex-col gap-10 lg:gap-12">
      <div className="text-center space-y-4 max-w-4xl mx-auto animate-fade-in">
        <h1 className="text-4xl lg:text-6xl font-black bg-linear-to-r from-[#2f6e9c] to-[#4088b8] dark:from-[#4088b8] dark:to-[#2f6e9c] bg-clip-text text-transparent">
          Nos Partenaires
        </h1>
        <p className="text-lg lg:text-xl text-gray-700 dark:text-gray-300 leading-relaxed">
          Découvrez les partenaires qui contribuent à enrichir l&apos;univers de Rose Griffon par
          leur expertise et leur créativité.
        </p>
        <div className="w-24 h-1 bg-linear-to-r from-[#2f6e9c] to-[#4088b8] mx-auto rounded-full" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6 lg:gap-8 mt-6">
        {isLoading ? loadingSkeletons : partnersContent}
      </div>
    </section>
  );
}