"use client";

import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useTableBroadcast } from "@/hooks";
import { ArrowUpDown, Search } from "@/lib/icons-config";
import type { Database } from "@/types/supabase";

import { UserEditDialog } from "./user-edit-dialog";

type User = Database["public"]["Tables"]["profiles"]["Row"];

const columns: ColumnDef<User>[] = [
	{
		accessorKey: "email",
		header: ({ column }) => (
			<Button
				variant="ghost"
				onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
			>
				Email
				<ArrowUpDown className="ml-2 h-4 w-4" />
			</Button>
		),
		cell: ({ row }) =>
			row.getValue("email") || (
				<span className="text-muted-foreground">N/A</span>
			),
	},
	{
		accessorKey: "full_name",
		header: "Nom Complet",
		cell: ({ row }) =>
			row.getValue("full_name") || (
				<span className="text-muted-foreground">N/A</span>
			),
	},
	{
		accessorKey: "role",
		header: "Rôle",
		cell: ({ row }) => {
			const role = row.getValue("role") as string;
			return (
				<Badge variant={role === "admin" ? "default" : "secondary"}>
					{role || "user"}
				</Badge>
			);
		},
	},
	{
		accessorKey: "created_at",
		header: ({ column }) => (
			<Button
				variant="ghost"
				onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
			>
				Date
				<ArrowUpDown className="ml-2 h-4 w-4" />
			</Button>
		),
		cell: ({ row }) => {
			const dateStr = row.getValue("created_at") as string | null;
			if (!dateStr) return <span className="text-muted-foreground">N/A</span>;
			const date = new Date(dateStr);
			return date.toLocaleDateString("fr-FR", {
				year: "numeric",
				month: "short",
				day: "numeric",
			});
		},
	},
	{
		id: "actions",
		cell: ({ row }) => <UserEditDialog user={row.original} />,
	},
];

interface UsersTableProps {
	users: User[];
}

export function UsersTable({ users: initialUsers }: UsersTableProps) {
	const [data, setData] = useState<User[]>(initialUsers);
	const [sorting, setSorting] = useState<SortingState>([]);
	const searchParams = useSearchParams();
	const { replace } = useRouter();

	useEffect(() => {
		setData(initialUsers);
	}, [initialUsers]);

	useTableBroadcast({
		table: "profiles",
		onUpdate: (updatedProfile) => {
			const profile = updatedProfile as User;
			setData((prevData) => {
				const existingIndex = prevData.findIndex((u) => u.id === profile.id);
				if (existingIndex >= 0) {
					const newData = [...prevData];
					newData[existingIndex] = { ...newData[existingIndex], ...profile };
					return newData;
				}
				return prevData;
			});
			toast.info("Utilisateur mis à jour en temps réel");
		},
		onInsert: (newProfile) => {
			const profile = newProfile as User;
			setData((prevData) => [...prevData, profile]);
			toast.success("Nouvel utilisateur ajouté");
		},
		onDelete: (deletedProfile) => {
			const profile = deletedProfile as User;
			setData((prevData) => prevData.filter((u) => u.id !== profile.id));
			toast.info("Utilisateur supprimé");
		},
	});

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		onSortingChange: setSorting,
		state: {
			sorting,
		},
	});

	const handleSearch = (term: string) => {
		const params = new URLSearchParams(searchParams || "");
		if (term) {
			params.set("query", term);
		} else {
			params.delete("query");
		}
		params.set("page", "1");
		replace(`/admin/users?${params.toString()}`);
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-2">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Rechercher par email..."
						defaultValue={searchParams?.get("query")?.toString()}
						onChange={(e) => {
							const value = e.target.value;
							const timeoutId = setTimeout(() => handleSearch(value), 300);
							return () => clearTimeout(timeoutId);
						}}
						className="pl-10"
					/>
				</div>
			</div>

			<div className="rounded-lg border border-border bg-card">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<TableHead key={header.id}>
										{header.isPlaceholder
											? null
											: flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows?.length ? (
							table.getRowModel().rows.map((row) => (
								<TableRow key={row.id}>
									{row.getVisibleCells().map((cell) => (
										<TableCell key={cell.id}>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell
									colSpan={columns.length}
									className="h-24 text-center"
								>
									Aucun utilisateur trouvé.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
