"use client";

import { Input } from "@rg/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Search } from "@/lib/icons-config";
import { cn } from "@/lib/utils";

export function GlobalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");

  useEffect(() => {
    setQuery(searchParams?.get("q") || "");
  }, [searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
    }
  };

  return (
    <form onSubmit={handleSearch} className={cn("relative w-full", className)}>
      <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Rechercher..."
        className="w-full pl-9 bg-background/50 border-muted focus:bg-background transition-colors"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
    </form>
  );
}