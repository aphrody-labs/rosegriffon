"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ChronicleEditor } from "@/components/admin/ChronicleEditor";
import { AdminPageHeader } from "@rg/ui";
import type { Tables } from "@rg/db";

import { updateChronicle } from "../../actions";

interface EditChronicleClientProps {
  article: Tables<"articles">;
}

export default function EditChronicleClient({ article }: EditChronicleClientProps) {
  const router = useRouter();

  const handleSave = async (data: {
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    category: string;
    featured_image: string;
    published: boolean;
  }) => {
    try {
      const result = await updateChronicle(article.id, {
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt,
        content: data.content,
        category: data.category,
        featured_image_url: data.featured_image,
        status: data.published ? "published" : "draft",
      });

      if (!result.success) {
        toast.error(result.error || "Une erreur est survenue");
        return;
      }

      toast.success(
        data.published ? "Chronique mise à jour et publiée !" : "Brouillon mis à jour avec succès !"
      );

      router.push("/admin/chroniques");
      router.refresh();
    } catch (error) {
      console.error("Erreur lors de la mise à jour:", error);
      toast.error("Erreur inattendue");
    }
  };

  const handleCancel = () => {
    router.push("/admin/chroniques");
  };

  // Map article data to editor format
  const initialData = {
    ...article,
    featured_image: article.featured_image_url || "",
    published: article.status === "published",
    excerpt: article.excerpt || "",
    category: article.category || "",
  };

  return (
    <div className="container max-w-5xl py-8">
      <AdminPageHeader title="Modifier la Chronique" description="Mettez à jour votre chronique" />

      <ChronicleEditor initialData={initialData} onSave={handleSave} onCancel={handleCancel} />
    </div>
  );
}
