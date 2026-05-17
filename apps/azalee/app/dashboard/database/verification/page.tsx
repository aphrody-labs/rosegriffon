import { Pencil } from "lucide-react";
import Link from "next/link";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiClient } from "@/lib/api-client";
import { verifier } from "@/lib/verification";

export default async function VerificationPage() {
  const characters = await apiClient.inagle.getAllCharacters();

  const invalidCharacters = characters
    .map((c) => ({ char: c, validation: verifier.validateCharacter(c) }))
    .filter((r) => !r.validation.isValid);

  return (
    <div className="space-y-6 sm:space-y-8 pb-24 sm:pb-8">
      <DashboardPageHeader
        breadcrumbs={[
          { label: "Tableau de bord", href: "/dashboard" },
          { label: "Base de données", href: "/dashboard/database" },
          { label: "Vérification" },
        ]}
        title="Vérification des données"
        subtitle={`${invalidCharacters.length} personnage${invalidCharacters.length !== 1 ? "s" : ""} nécessitent une attention`}
        icon="verified"
      />

      <div className="rounded-[24px] sm:rounded-[32px] border border-outline-variant/30 overflow-hidden bg-surface-container-lowest shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-surface-container-low/50">
              <TableRow className="border-outline-variant/10 hover:bg-transparent">
                <TableHead className="min-w-[120px] px-4 sm:px-8 h-12 sm:h-14 text-[10px] font-black uppercase tracking-widest text-on-surface-variant whitespace-nowrap">
                  ID
                </TableHead>
                <TableHead className="min-w-[200px] h-12 sm:h-14 text-[10px] font-black uppercase tracking-widest text-on-surface-variant whitespace-nowrap">
                  Nom (Original)
                </TableHead>
                <TableHead className="min-w-[250px] h-12 sm:h-14 text-[10px] font-black uppercase tracking-widest text-on-surface-variant whitespace-nowrap">
                  Problèmes
                </TableHead>
                <TableHead className="text-right px-4 sm:px-8 h-12 sm:h-14 text-[10px] font-black uppercase tracking-widest text-on-surface-variant whitespace-nowrap">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invalidCharacters.slice(0, 50).map(({ char, validation }) => (
                <TableRow
                  key={char.charaId}
                  className="border-outline-variant/5 hover:bg-surface-container-low/50 transition-all duration-300"
                >
                  <TableCell className="px-4 sm:px-8 py-4 font-mono text-xs text-on-surface-variant">
                    {char.charaId}
                  </TableCell>
                  <TableCell className="font-bold text-on-surface">
                    {char.names.ja || char.names.en || "???"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {validation.issues.map((issue, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="rounded-full text-[10px] font-bold uppercase tracking-wider bg-error/5 text-error border-error/20"
                        >
                          {issue}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right px-4 sm:px-8">
                    <Link
                      href={`/dashboard/database/inagle_characters/${char.charaId}`}
                      className="inline-flex items-center gap-1.5 text-primary hover:text-primary/80 text-sm font-bold transition-colors"
                    >
                      <Pencil size={16} aria-hidden="true" />
                      Corriger
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {invalidCharacters.length > 50 && (
          <div className="p-4 sm:p-6 text-center text-sm text-on-surface-variant border-t border-outline-variant/10 bg-surface-container-low/30">
            Et {invalidCharacters.length - 50} autres...
          </div>
        )}
      </div>
    </div>
  );
}
