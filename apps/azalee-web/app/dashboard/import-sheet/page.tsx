import { AdminPageHeader as DashboardPageHeader } from "@rose-griffon/ui";
import { ImportSheetForm } from "./ImportSheetForm";

export default function ImportSheetPage() {
  return (
    <div className="space-y-6 sm:space-y-8 pb-24 sm:pb-8">
      <DashboardPageHeader
        breadcrumbs={[
          { label: "Tableau de bord", href: "/dashboard" },
          { label: "Import Tableur" },
        ]}
        title="Import Tableur"
        subtitle="Convertir Sheet ou CSV en tableau"
        icon="table_chart"
      />

      <ImportSheetForm />
    </div>
  );
}
