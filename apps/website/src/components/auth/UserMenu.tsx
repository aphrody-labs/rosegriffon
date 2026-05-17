"use client";

import { ChevronDown, Loader2, LogOut, Settings, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

export function UserMenu() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fermer le menu quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  if (isLoading) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <Loader2 className="h-5 w-5 animate-spin" />
      </Button>
    );
  }

  if (!user) {
    return (
      <Link href="/login">
        <Button size="sm">Se connecter</Button>
      </Link>
    );
  }

  const displayName = user.name || user.email?.split("@")[0] || "Utilisateur";
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Avatar className="h-8 w-8">
          <AvatarImage src={`https://avatar.vercel.sh/${user.id}`} />
          <AvatarFallback className="bg-rose-500 text-white text-xs font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className="hidden sm:inline text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[150px]">
          {displayName}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 text-gray-500 transition-transform", isOpen && "rotate-180")}
        />
      </button>

      {/* Menu déroulant */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {displayName}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
          </div>

          {/* Menu items */}
          <nav className="py-2">
            <Link
              href="/profile"
              className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <User className="h-4 w-4" />
              Mon profil
            </Link>

            <Link
              href="/settings"
              className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <Settings className="h-4 w-4" />
              Paramètres
            </Link>

            <hr className="my-2 border-gray-200 dark:border-gray-700" />

            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:opacity-50"
            >
              {isLoggingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              {isLoggingOut ? "Déconnexion..." : "Se déconnecter"}
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}
