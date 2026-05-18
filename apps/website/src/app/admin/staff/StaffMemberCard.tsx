"use client";

import { Button, Card, CardContent, CardFooter, CardHeader, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@rg/ui";
import {
	Check,
	Edit,
	EyeOff,
	MoreHorizontal,
	Trash2,
	Users as UsersIcon,
} from "lucide-react";
import Image from "next/image";

import type { TeamMember } from "./actions";

interface StaffMemberCardProps {
	member: TeamMember;
	teamLabel: string;
	onEdit: (member: TeamMember) => void;
	onDelete: (member: TeamMember) => void;
	onApprove?: (member: TeamMember) => void;
	onDeactivate?: (member: TeamMember) => void;
}

export function StaffMemberCard({
	member,
	teamLabel,
	onEdit,
	onDelete,
	onApprove,
	onDeactivate,
}: StaffMemberCardProps) {
	const isPending = member.is_active === false;
	const isDiscordImport = member.source === "discord-sync";
	const isPlaceholderRole = member.role === "Staff";

	return (
		<Card
			className={`overflow-hidden transition-all hover:shadow-md ${isPending ? "border-orange-200 bg-orange-50/30" : ""}`}
		>
			<CardHeader className="p-0">
				<div className="relative h-24 bg-linear-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
					<div className="absolute -bottom-10 left-1/2 -translate-x-1/2">
						<div
							className={`relative size-20 overflow-hidden rounded-full border-4 shadow-sm ${isPending ? "border-orange-100" : "border-background"}`}
						>
							{member.image_url ? (
								<Image
									src={member.image_url}
									alt={member.name}
									fill
									sizes="80px"
									className="object-cover"
								/>
							) : (
								<div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
									<UsersIcon className="size-8" />
								</div>
							)}
						</div>
					</div>
					<div className="absolute right-2 top-2">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="size-8 text-muted-foreground hover:text-foreground hover:bg-muted/400"
								>
									<MoreHorizontal className="size-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuLabel>Actions</DropdownMenuLabel>
								{onApprove && (
									<DropdownMenuItem
										onClick={() => onApprove(member)}
										className="text-green-600"
									>
										<Check className="mr-2 size-4" />
										Valider
									</DropdownMenuItem>
								)}
								<DropdownMenuItem onClick={() => onEdit(member)}>
									<Edit className="mr-2 size-4" />
									Modifier
								</DropdownMenuItem>
								{onDeactivate && !isPending && (
									<DropdownMenuItem onClick={() => onDeactivate(member)}>
										<EyeOff className="mr-2 size-4" />
										Désactiver
									</DropdownMenuItem>
								)}
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={() => onDelete(member)}
									className="text-destructive focus:text-destructive"
								>
									<Trash2 className="mr-2 size-4" />
									Supprimer
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			</CardHeader>
			<CardContent className="mt-12 text-center p-4 pt-10 pb-2">
				<h3 className="font-semibold text-lg leading-tight">{member.name}</h3>
				<p
					className={`text-sm font-medium ${isPlaceholderRole ? "text-orange-500 italic" : "text-muted-foreground"}`}
					title={isPlaceholderRole ? "Rôle à préciser" : undefined}
				>
					{member.role}
				</p>
				<p className="text-xs text-muted-foreground/70 mt-1">{teamLabel}</p>

				<div className="mt-3 flex flex-wrap justify-center gap-1">
					{member.discord_user_id && (
						<a
							href={`https://discord.com/users/${member.discord_user_id}`}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
							title={`Ouvrir le profil Discord ${member.discord_user_id}`}
						>
							Lié à Discord
						</a>
					)}
					{isDiscordImport && (
						<span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
							Import Discord
						</span>
					)}
				</div>
			</CardContent>
			<CardFooter className="p-4 pt-2 flex justify-center pb-6">
				{onApprove ? (
					<Button
						size="sm"
						onClick={() => onApprove(member)}
						className="w-full bg-green-600 hover:bg-green-700"
					>
						<Check className="mr-2 size-4" />
						Valider
					</Button>
				) : (
					<div className="text-xs text-muted-foreground">
						Ordre&nbsp;: {member.display_index ?? "—"}
					</div>
				)}
			</CardFooter>
		</Card>
	);
}