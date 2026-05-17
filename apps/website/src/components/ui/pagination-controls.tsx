"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  baseUrl: string;
}

export function PaginationControls({ currentPage, totalPages, baseUrl }: PaginationControlsProps) {
  const searchParams = useSearchParams();

  const createPageUrl = (page: number) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("page", page.toString());
    return `${baseUrl}?${params.toString()}`;
  };

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        Page {currentPage} sur {totalPages}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={currentPage <= 1} asChild>
          <Link href={createPageUrl(currentPage - 1)}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Précédent
          </Link>
        </Button>
        <Button variant="outline" size="sm" disabled={currentPage >= totalPages} asChild>
          <Link href={createPageUrl(currentPage + 1)}>
            Suivant
            <ChevronRight className="w-4 h-4 ml-2" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
