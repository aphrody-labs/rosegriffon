"use client";

import Image from "next/image";
import type React from "react";
import { useEffect, useState } from "react";

import DiscordIcon from "@/shared/icons/discord";

const DISCORD_GUILD_ID = "1072991720268111892";

type DiscordMember = {
  id: string;
  username: string;
  avatar?: string;
  avatar_url?: string;
  status: "online" | "idle" | "dnd" | "offline";
  game?: { name: string };
};

type DiscordData = {
  name: string;
  icon: string | null;
  banner: string | null;
  presence_count: number;
  member_count: number;
  instant_invite: string;
  members: DiscordMember[];
};

type DiscordBlockProps = {
  children: React.ReactNode;
  isWidgetLeft?: boolean;
};

export default function DiscordBlock({ children, isWidgetLeft = false }: DiscordBlockProps) {
  const [discordData, setDiscordData] = useState<DiscordData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  // Récupération des données Discord depuis l'API
  useEffect(() => {
    const fetchDiscordData = async () => {
      setLoading(true);
      setError(false);

      try {
        const response = await fetch(
          `https://discord.com/api/guilds/${DISCORD_GUILD_ID}/widget.json`
        );

        if (response.ok) {
          const data = await response.json();
          setDiscordData({
            name: data.name,
            icon: null,
            banner: null,
            presence_count: data.presence_count,
            member_count: data.members?.length ?? 0,
            instant_invite: data.instant_invite,
            members: (data.members ?? []).map((m: DiscordMember) => ({
              id: m.id,
              username: m.username,
              avatar: m.avatar_url,
              avatar_url: m.avatar_url,
              status: m.status || "offline",
              game: m.game,
            })),
          });
        } else {
          throw new Error("Impossible de récupérer les données Discord");
        }
      } catch (error) {
        console.error("Erreur lors de la récupération des données Discord:", error);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchDiscordData();
  }, []);

  // Composant pour afficher le statut
  const StatusIndicator = ({ status }: { status: string }) => {
    const statusColors = {
      online: "bg-green-500",
      idle: "bg-yellow-500",
      dnd: "bg-red-500",
      offline: "bg-gray-500",
    };

    return (
      <div
        className={`w-3 h-3 rounded-full ${
          statusColors[status as keyof typeof statusColors]
        } absolute -bottom-0.5 -right-0.5 border-2 border-[#36393f]`}
       />
    );
  };

  const CustomDiscordWidget = ({
    discordData,
    loading,
    error,
  }: {
    discordData: DiscordData | null;
    loading: boolean;
    error: boolean;
  }) => {
    if (loading) {
      return (
        <div className="w-full h-full bg-[#36393f] text-white flex flex-col items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
          <p className="text-sm">Chargement du widget Discord...</p>
        </div>
      );
    }

    if (error || !discordData) {
      return (
        <div className="w-full h-full bg-[#36393f] text-white flex flex-col items-center justify-center gap-4 p-6">
          <div className="text-center space-y-2">
            <p className="text-lg font-semibold">Widget Discord indisponible</p>
            <p className="text-sm text-gray-400">
              Le widget ne peut pas être chargé pour le moment
            </p>
          </div>
          <a
            href="https://discord.gg/8X8eQfBMkt"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center gap-2"
          >
            <DiscordIcon className="w-5 h-5" />
            Rejoindre le Discord
          </a>
        </div>
      );
    }

    return (
      <div className="w-full h-full bg-[#36393f] text-white p-4 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">{discordData.name}</h3>
          <a
            href={discordData.instant_invite}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold py-2 px-4 rounded transition-colors duration-200"
          >
            Rejoindre
          </a>
        </div>
        <div className="grow overflow-y-auto">
          <p className="text-sm text-gray-400 mb-2">
            {discordData.presence_count} membres en ligne • {discordData.member_count} membres
          </p>
          <ul>
            {discordData.members.map((member) => (
              <li key={member.id} className="flex items-center mb-2">
                <div className="relative">
                  <Image
                    src={member.avatar_url || member.avatar || "/default-avatar.webp"}
                    alt={member.username}
                    width={32}
                    height={32}
                    className="rounded-full mr-2"
                    unoptimized
                  />
                  <StatusIndicator status={member.status} />
                </div>
                <span className="ml-3">{member.username}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row w-full gap-4 lg:gap-0 lg:h-[500px] hover:shadow-2xl transition-shadow duration-300 rounded-3xl overflow-hidden bg-white dark:bg-gray-800 shadow-lg">
      {/* Widget Container */}
      <div
        className={`w-full lg:w-1/2 h-[400px] sm:h-[450px] lg:h-full ${
          isWidgetLeft ? "order-1" : "order-1 lg:order-2"
        } bg-[#36393f]`}
      >
        <CustomDiscordWidget discordData={discordData} loading={loading} error={error} />
      </div>

      {/* Content Container */}
      <div
        className={`w-full lg:w-1/2 p-6 sm:p-8 lg:p-10 flex flex-col justify-center ${
          isWidgetLeft ? "order-2" : "order-2 lg:order-1"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
