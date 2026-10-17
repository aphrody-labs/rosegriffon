"use client";

import { ArrowLeft, KeyRound, Link2, Truck, UserCircle } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";

import { Button } from "../button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../tabs";
import type { AccountTabId } from "./types";

const TAB_META: Record<AccountTabId, { label: string; icon: typeof UserCircle }> = {
  address: { icon: Truck, label: "Adresse" },
  connections: { icon: Link2, label: "Connexions" },
  profile: { icon: UserCircle, label: "Profil" },
  security: { icon: KeyRound, label: "Sécurité" },
};

interface AccountShellProps {
  email?: string | null;
  /** Lien de retour (profil public, tableau de bord…). */
  backHref?: string;
  backLabel?: string;
  initialTab: AccountTabId;
  /** Onglets montés, dans l'ordre d'affichage. */
  tabs: { id: AccountTabId; content: ReactNode }[];
}

/**
 * Coquille de la page « Mon compte », partagée par les deux apps.
 *
 * L'onglet actif est reflété dans l'URL (`?tab=…`) : un lien vers un réglage
 * précis reste partageable et le retour navigateur fonctionne. `router.replace`
 * évite d'empiler une entrée d'historique par clic d'onglet.
 */
export function AccountShell({ email, backHref, backLabel = "Retour", initialTab, tabs }: AccountShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [active, setActive] = useState<AccountTabId>(initialTab);

  const change = (next: string) => {
    setActive(next as AccountTabId);
    router.replace(`${pathname}?tab=${next}`, { scroll: false });
  };

  return (
    <div className="mx-auto w-full max-w-5xl pb-24 sm:px-6 sm:py-6 lg:px-8 lg:py-10">
      {/* Barre d'application : retour, titre et identité restent sous l'en-tête du site pendant le défilement. */}
      <header className="sticky top-16 z-20 flex min-h-14 items-center gap-1 border-b border-border bg-background/90 px-2 backdrop-blur sm:static sm:mb-6 sm:border-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none lg:top-14">
        {backHref && (
          <Link
            href={backHref}
            aria-label={backLabel}
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted active:bg-muted"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl leading-tight font-bold tracking-tight text-foreground sm:text-3xl">
            Paramètres du compte
          </h1>
          {email && <p className="truncate text-xs text-muted-foreground sm:text-sm">{email}</p>}
        </div>
      </header>

      <Tabs value={active} onValueChange={change} className="w-full">
        <TabsList
          aria-label="Sections du compte"
          // Une rangée de pastilles qui défile : aucun libellé tronqué, cibles de 44 px,
          // et la rangée reste accrochée sous la barre pendant le défilement.
          className="sticky top-[7.5rem] z-10 flex h-auto w-full snap-x justify-start gap-2 overflow-x-auto rounded-none bg-background/90 p-2 backdrop-blur [scrollbar-width:none] sm:static sm:rounded-lg sm:bg-muted sm:p-1 sm:backdrop-blur-none lg:top-[6.5rem]"
        >
          {tabs.map(({ id }) => {
            const meta = TAB_META[id];
            return (
              <TabsTrigger
                key={id}
                value={id}
                className="flex min-h-11 shrink-0 snap-start items-center justify-center gap-2 rounded-full px-4 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:min-h-9 sm:rounded-md"
              >
                <meta.icon className="size-4 shrink-0" aria-hidden />
                <span>{meta.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {tabs.map(({ id, content }) => (
          <TabsContent key={id} value={id} className="mt-4 px-4 focus-visible:outline-hidden sm:mt-6 sm:px-0">
            {content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
