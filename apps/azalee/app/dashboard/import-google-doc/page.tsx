import { AdminPageHeader as DashboardPageHeader } from "@rose-griffon/ui";
import { ImportDocForm } from "./ImportDocForm";

export default function ImportGoogleDocPage() {
  return (
    <div className="space-y-6 sm:space-y-8 pb-24 sm:pb-8">
      <DashboardPageHeader
        breadcrumbs={[
          { label: "Tableau de bord", href: "/dashboard" },
          { label: "Import Google Doc" },
        ]}
        title="Import Google Doc"
        subtitle="Convertir un document Google en article"
        icon="description"
      />

      <ImportDocForm />
    </div>
  );
}
