"use server";

import { google } from "googleapis";
import { revalidatePath } from "next/cache";
import { createPostgresClient } from "@rosegriffon/db/service";
import { getServerSession } from "@/lib/auth-helpers";
import { isAdminRole } from "@/lib/auth-roles";
import { getServiceAccountAuth } from "@/lib/google/auth";
import { convertGoogleDocToHtml } from "@/lib/google-docs";

const DRIVE_FOLDER_ID = "19UJsSXVRV0sEd67JCwHSu9Atm3H_5D6K";
const DOC_SCOPES = [
  "https://www.googleapis.com/auth/documents.readonly",
  "https://www.googleapis.com/auth/drive",
];

function getGoogleAuth() {
  const auth = getServiceAccountAuth(DOC_SCOPES);
  if (!auth) {
    throw new Error(
      "Compte de service Google non configuré (GOOGLE_APPLICATION_CREDENTIALS ou équivalent)",
    );
  }
  return auth;
}

async function requireDocAdmin() {
  const session = await getServerSession();
  if (!session?.user) {
    return { error: "Non authentifié" as const, user: null };
  }

  const supabase = createPostgresClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (!profile || !isAdminRole(profile.role)) {
    return { error: "Permissions insuffisantes" as const, user: null };
  }

  return { error: null, user: session.user };
}

export async function importGoogleDoc(docId: string) {
  try {
    const { error: authError, user } = await requireDocAdmin();
    if (authError || !user) {
      return { success: false, error: authError || "Non authentifié" };
    }

    const auth = getGoogleAuth();
    const docs = google.docs({
      auth,
      version: "v1",
    });

    const docResponse = await docs.documents.get({ documentId: docId });
    const doc = docResponse.data;

    if (!doc.title || !doc.body) {
      return { error: "Document invalide ou vide", success: false };
    }

    const htmlContent = convertGoogleDocToHtml(doc);

    const baseSlug = (doc.title || "sans-titre")
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "-")
      .replaceAll(/^-|-$/g, "");
    const slug = `${baseSlug}-${Date.now().toString().slice(-6)}`;

    // Use Admin Client to bypass RLS
    const supabase = createPostgresClient();
    const { data, error } = await (supabase as any)
      .from("articles")
      .insert({
        author_id: user.id,
        category: "Import Google Doc",
        content: htmlContent,
        excerpt: "Importé depuis Google Docs",
        slug: slug,
        status: "draft",
        title: doc.title,
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase Insert Error:", error);
      return {
        error: `Erreur base de données: ${error.message}`,
        success: false,
      };
    }

    revalidatePath("/admin/news");
    return { data, success: true };
  } catch (error: unknown) {
    const err = error as { code?: number; message?: string };
    console.error("Google Import Error:", err);
    if (err.code === 403) {
      return { success: false, error: "Accès refusé. Document non public." };
    }
    return { error: err.message || "Erreur lors de l'import.", success: false };
  }
}

/**
 * Importer tous les Google Docs d'un dossier spécifique
 */
export async function importDriveFolder() {
  try {
    const { error: authError } = await requireDocAdmin();
    if (authError) {
      return { success: false, error: authError };
    }

    const auth = getGoogleAuth();
    const drive = google.drive({ auth, version: "v3" });

    // Lister les fichiers Google Docs dans le dossier
    const res = await drive.files.list({
      fields: "files(id, name)",
      q: `'${DRIVE_FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.document' and trashed = false`,
    });

    const files = res.data.files || [];
    if (files.length === 0) {
      return {
        success: true,
        message: "Aucun document trouvé dans le dossier.",
      };
    }

    let importedCount = 0;
    for (const file of files) {
      if (file.id) {
        const result = await importGoogleDoc(file.id);
        if (result.success) {
          importedCount++;
        }
      }
    }

    revalidatePath("/admin/news");
    return {
      message: `${importedCount} articles importés avec succès.`,
      success: true,
    };
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("Drive Import Error:", err);
    return {
      error: err.message || "Erreur lors de l'importation du dossier.",
      success: false,
    };
  }
}

/**
 * Exporter un article vers Google Drive (en tant que nouveau Google Doc)
 */
export async function exportToGoogleDrive(newsId: string) {
  try {
    const { error: authError } = await requireDocAdmin();
    if (authError) {
      return { success: false, error: authError };
    }

    const supabase = createPostgresClient();
    const { data: news, error: fetchError } = await supabase
      .from("articles")
      .select("*")
      .eq("id", newsId)
      .single();

    if (fetchError || !news) {
      return { success: false, error: "Article introuvable." };
    }

    const item = news as any;
    const auth = getGoogleAuth();
    const drive = google.drive({ auth, version: "v3" });

    const res = await drive.files.create({
      media: {
        body: item.content,
        mimeType: "text/html",
      },
      requestBody: {
        mimeType: "application/vnd.google-apps.document",
        name: `[Export] ${item.title}`,
        parents: [DRIVE_FOLDER_ID],
      },
    });

    return { fileId: res.data.id, success: true };
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("Drive Export Error:", err);
    return {
      error: err.message || "Erreur lors de l'exportation.",
      success: false,
    };
  }
}
