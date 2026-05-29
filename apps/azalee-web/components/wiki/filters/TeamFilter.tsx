"use client";

import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import {
	Button,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@rose-griffon/ui";
import { cn } from "@/lib/utils";

export interface TeamOption {
	id: string;
	name: string;
}

interface TeamFilterProps {
	teams: TeamOption[];
}

export function TeamFilter({ teams }: TeamFilterProps) {
	const [open, setOpen] = React.useState(false);
	const router = useRouter();
	const searchParams = useSearchParams();
	const currentTeamId = searchParams.get("team");

	const handleSelect = (teamId: string) => {
		const params = new URLSearchParams(searchParams.toString());
		if (currentTeamId === teamId) {
			params.delete("team");
		} else {
			params.set("team", teamId);
		}
		params.delete("page");
		setOpen(false);
		router.replace(`?${params.toString()}`, { scroll: false });
	};

	const selectedTeam = teams.find((t) => t.id === currentTeamId);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className="w-full justify-between bg-surface text-on-surface hover:bg-surface-container"
				>
					{selectedTeam ? selectedTeam.name : "Rechercher une équipe..."}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[calc(100vw-2rem)] sm:w-[300px] p-0" align="start">
				<Command>
					<div className="flex items-center border-b px-3">
						<CommandInput
							placeholder="Nom de l'équipe..."
							className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
						/>
					</div>
					<CommandList>
						<CommandEmpty>Aucune équipe trouvée.</CommandEmpty>
						<CommandGroup className="max-h-[300px] overflow-y-auto">
							{teams.map((team) => (
								<CommandItem
									key={team.id}
									value={team.name}
									onSelect={() => handleSelect(team.id)}
									className={cn(
										currentTeamId === team.id && "bg-surface-container-highest font-medium"
									)}
								>
									<span className="truncate">{team.name}</span>
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
