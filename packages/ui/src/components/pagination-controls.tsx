"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type * as React from "react";

import { Button } from "./button";

interface PaginationControlsProps {
	currentPage: number;
	totalPages: number;
	baseUrl: string;
	previousLabel?: React.ReactNode;
	nextLabel?: React.ReactNode;
	pageLabel?: (current: number, total: number) => React.ReactNode;
	LinkComponent?: React.ComponentType<{
		href: string;
		className?: string;
		children?: React.ReactNode;
	}>;
}

const defaultPageLabel = (current: number, total: number) =>
	`Page ${current} sur ${total}`;

export function PaginationControls({
	currentPage,
	totalPages,
	baseUrl,
	previousLabel = "Précédent",
	nextLabel = "Suivant",
	pageLabel = defaultPageLabel,
	LinkComponent = Link,
}: PaginationControlsProps) {
	const searchParams = useSearchParams();

	const createPageUrl = (page: number) => {
		const params = new URLSearchParams(searchParams?.toString() || "");
		params.set("page", page.toString());
		return `${baseUrl}?${params.toString()}`;
	};

	return (
		<div className="flex items-center justify-between">
			<p className="text-sm text-muted-foreground">
				{pageLabel(currentPage, totalPages)}
			</p>
			<div className="flex gap-2">
				<Button variant="outline" size="sm" disabled={currentPage <= 1} asChild>
					<LinkComponent href={createPageUrl(currentPage - 1)}>
						<ChevronLeft className="size-4 mr-2" />
						{previousLabel}
					</LinkComponent>
				</Button>
				<Button
					variant="outline"
					size="sm"
					disabled={currentPage >= totalPages}
					asChild
				>
					<LinkComponent href={createPageUrl(currentPage + 1)}>
						{nextLabel}
						<ChevronRight className="size-4 ml-2" />
					</LinkComponent>
				</Button>
			</div>
		</div>
	);
}
