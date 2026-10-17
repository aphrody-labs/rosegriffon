import { AdminPageHeader, Badge, Card, CardContent } from "@rosegriffon/ui";
import { Shield } from "lucide-react";

import { getPgPool } from "@/lib/db/pg";

export const dynamic = "force-dynamic";

export const metadata = {
  description: "Les dernières actions sensibles enregistrées par le site.",
  title: "Journal d'audit — Administration",
};

interface LigneAudit {
  id: string;
  action: string;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  pseudo: string | null;
}

const LIMITE = 100;

export default async function PageAudit() {
  const { rows } = await getPgPool().query<LigneAudit>(
    `SELECT a.id, a.action, a.details, a.ip_address, a.created_at, p.username AS pseudo
       FROM audit_logs a
       LEFT JOIN profiles p ON p.id::text = a.user_id::text
      ORDER BY a.created_at DESC
      LIMIT $1`,
    [LIMITE],
  );

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <AdminPageHeader
        icon={<Shield className="size-5" />}
        title="Journal d'audit"
        description={`Les ${LIMITE} dernières actions enregistrées, de la plus récente à la plus ancienne.`}
      />
      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-muted-foreground">Aucune action enregistrée pour le moment.</CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {rows.map(ligne => (
            <li key={ligne.id}>
              <Card>
                <CardContent className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-4">
                  <Badge variant="secondary">{ligne.action}</Badge>
                  <span className="font-medium">{ligne.pseudo ?? "Compte supprimé"}</span>
                  <time dateTime={new Date(ligne.created_at).toISOString()} className="text-sm text-muted-foreground">
                    {new Date(ligne.created_at).toLocaleString("fr-FR")}
                  </time>
                  {ligne.ip_address && <span className="text-sm text-muted-foreground">{ligne.ip_address}</span>}
                  {ligne.details && Object.keys(ligne.details).length > 0 && (
                    <code className="w-full break-all text-xs text-muted-foreground">{JSON.stringify(ligne.details)}</code>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
