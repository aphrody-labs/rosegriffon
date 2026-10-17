"use client";

import { ResponsiveDialog } from "@rosegriffon/ui/responsive-dialog";
import { Button } from "@rosegriffon/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@rosegriffon/ui/tabs";
import { Gamepad2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AvatarCode } from "./AvatarCode";
import { BanquePortraits } from "./BanquePortraits";

/** Bouton + fenêtre de choix d'un avatar issu du jeu (banque de personnages ou code `chara_edit`). */
export function AvatarJeuDialog({
  avatarUrl,
  codeActuel,
}: {
  avatarUrl: string | null;
  codeActuel: string | null;
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);

  const termine = () => {
    setOuvert(false);
    router.refresh();
  };

  return (
    <>
      <Button variant="outline" size="sm" className="h-11 w-full rounded-full" onClick={() => setOuvert(true)}>
        <Gamepad2 className="size-4" aria-hidden />
        Avatar du jeu
      </Button>
      <ResponsiveDialog
        open={ouvert}
        onOpenChange={setOuvert}
        title="Avatar du jeu"
        description="Un portrait de la banque de personnages, ou ton avatar créé dans l'éditeur."
        contentClassName="sm:max-w-2xl"
      >
        <Tabs defaultValue={codeActuel ? "code" : "banque"} className="min-w-0 pb-4">
          <TabsList className="grid h-11 w-full grid-cols-2">
            <TabsTrigger value="banque" className="h-9">
              Banque de personnages
            </TabsTrigger>
            <TabsTrigger value="code" className="h-9">
              Avatar créé
            </TabsTrigger>
          </TabsList>
          <TabsContent value="banque" className="mt-3 max-h-[65vh] overflow-y-auto px-1">
            <BanquePortraits avatarUrl={avatarUrl} onSaved={termine} />
          </TabsContent>
          <TabsContent value="code" className="mt-3 max-h-[65vh] overflow-y-auto px-1">
            <AvatarCode codeActuel={codeActuel} onSaved={termine} />
          </TabsContent>
        </Tabs>
      </ResponsiveDialog>
    </>
  );
}
