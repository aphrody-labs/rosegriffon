"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@rose-griffon/ui";
import { KeyRound, Link2, Truck, UserCircle } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

const TABS = [
	{ icon: UserCircle, label: "Profil", value: "profile" },
	{ icon: Truck, label: "Adresse", value: "address" },
	{ icon: Link2, label: "Connexions", value: "connections" },
	{ icon: KeyRound, label: "Sécurité", value: "security" },
] as const;

export type AccountTabValue = (typeof TABS)[number]["value"];

interface AccountTabsProps {
	initial: AccountTabValue;
	profile: React.ReactNode;
	address: React.ReactNode;
	connections: React.ReactNode;
	security: React.ReactNode;
}

export function AccountTabs({
	initial,
	profile,
	address,
	connections,
	security,
}: AccountTabsProps) {
	const router = useRouter();
	const pathname = usePathname();
	const [value, setValue] = React.useState<AccountTabValue>(initial);

	const handleChange = (next: string) => {
		const tab = next as AccountTabValue;
		setValue(tab);
		const url = `${pathname}?tab=${tab}`;
		router.replace(url, { scroll: false });
	};

	const slots: Record<AccountTabValue, React.ReactNode> = {
		address,
		connections,
		profile,
		security,
	};

	return (
		<Tabs value={value} onValueChange={handleChange} className="w-full">
			<TabsList
				className="grid h-auto w-full grid-cols-2 gap-1 p-1 sm:grid-cols-4"
				aria-label="Sections du compte"
			>
				{TABS.map(({ value: v, label, icon: Icon }) => (
					<TabsTrigger
						key={v}
						value={v}
						aria-label={label}
						className="flex min-h-11 flex-col items-center justify-center gap-0.5 px-1 text-xs sm:h-9 sm:min-h-9 sm:flex-row sm:gap-2 sm:text-sm"
					>
						<Icon className="size-4 shrink-0" aria-hidden="true" />
						<span className="truncate">{label}</span>
					</TabsTrigger>
				))}
			</TabsList>

			{TABS.map(({ value: v }) => (
				<TabsContent
					key={v}
					value={v}
					className="mt-6 focus-visible:outline-hidden"
				>
					{slots[v]}
				</TabsContent>
			))}
		</Tabs>
	);
}