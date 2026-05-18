"use client";

import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from "@rg/ui";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Label } from "@rg/ui";

import { Eye, Loader2, Save } from "@/lib/icons-config";
import { createClient } from "@/lib/supabase/client";

interface ArticleEditorProps {
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    color: string | null;
  }>;
  userId: string;
  initialData?: {
    id?: string;
    title?: string;
    slug?: string;
    excerpt?: string;
    content?: string;
    category?: string;
    featured_image_url?: string;
    meta_title?: string;
    meta_description?: string;
    status?: string;
  };
}

export function ArticleEditor({ categories, userId, initialData }: ArticleEditorProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    excerpt: initialData?.excerpt || "",
    content: initialData?.content || "",
    category: initialData?.category || "",
    featured_image_url: initialData?.featured_image_url || "",
    meta_title: initialData?.meta_title || "",
    meta_description: initialData?.meta_description || "",
  });

  const handleSubmit = async (status: "draft" | "published") => {
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error("Le titre et le contenu sont obligatoires");
      return;
    }

    setIsLoading(true);
    const supabase = createClient();

    try {
      const slug =
        initialData?.slug ||
        formData.title
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .trim();

      const articleData = {
        ...formData,
        slug,
        status,
        author_id: userId,
        app: "website",
        published_at: status === "published" ? new Date().toISOString() : null,
      };

      let result;
      if (initialData?.id) {
        result = await supabase
          .from("articles")
          .update(articleData)
          .eq("id", initialData.id)
          .select()
          .single();
      } else {
        result = await supabase.from("articles").insert(articleData).select().single();
      }

      if (result.error) throw result.error;

      toast.success(
        status === "published" ? "Chronique publiée avec succès !" : "Brouillon enregistré !"
      );

      router.push("/dashboard/articles");
      router.refresh();
    } catch (error) {
      console.error("Error saving article:", error);
      toast.error(error instanceof Error ? error.message : "Erreur lors de l'enregistrement de la chronique");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">
          Titre <span className="text-red-500">*</span>
        </Label>
        <Input
          id="title"
          placeholder="Un titre accrocheur pour votre chronique..."
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          maxLength={255}
          required
        />
        <p className="text-xs text-gray-500">{formData.title.length}/255 caractères</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Catégorie</Label>
        <Select
          value={formData.category}
          onValueChange={(value) => setFormData({ ...formData, category: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Sélectionner une catégorie" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.slug}>
                <div className="flex items-center gap-2">
                  {cat.color && (
                    <div className="size-3 rounded-full" style={{ backgroundColor: cat.color }} />
                  )}
                  {cat.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="excerpt">Extrait</Label>
        <Textarea
          id="excerpt"
          placeholder="Un court résumé de votre chronique (1-2 phrases)..."
          value={formData.excerpt}
          onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
          rows={2}
          maxLength={300}
        />
        <p className="text-xs text-gray-500">{formData.excerpt.length}/300 caractères</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="featured_image_url">Image à la une (URL)</Label>
        <Input
          id="featured_image_url"
          type="url"
          placeholder="https://exemple.com/image.jpg"
          value={formData.featured_image_url}
          onChange={(e) => setFormData({ ...formData, featured_image_url: e.target.value })}
        />
        {formData.featured_image_url && (
          <div className="mt-2 rounded-lg overflow-hidden border relative h-48">
            <Image
              src={formData.featured_image_url}
              alt="Aperçu"
              fill
              className="object-cover"
              onError={(e) => {
                // Note: onError on next/image is different, usually handled by state
                // For simplicity in this refactor, we might need a state to hide it if it fails
                // But next/image doesn't support style.display = none directly on the component easily
                // We'll keep it simple for now or use a wrapper if needed.
                // However, next/image onError provides a synthetic event.
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
              }}
              unoptimized // Since it's an external URL input by user, we might not have it in next.config.js domains
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="content">
          Contenu <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="content"
          placeholder="Rédigez votre chronique ici... (Markdown supporté)"
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          rows={15}
          className="font-mono text-sm"
          required
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() => handleSubmit("draft")}
          disabled={isLoading}
          className="flex-1"
        >
          {isLoading ? (
            <Loader2 className="size-4 mr-2 animate-spin" />
          ) : (
            <Save className="size-4 mr-2" />
          )}
          Enregistrer en brouillon
        </Button>

        <Button
          type="button"
          onClick={() => handleSubmit("published")}
          disabled={isLoading}
          className="flex-1"
        >
          {isLoading ? (
            <Loader2 className="size-4 mr-2 animate-spin" />
          ) : (
            <Eye className="size-4 mr-2" />
          )}
          Publier la chronique
        </Button>
      </div>
    </div>
  );
}