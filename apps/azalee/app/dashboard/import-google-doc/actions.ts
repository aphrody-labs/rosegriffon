"use server";

import fs from "node:fs";
import path from "node:path";
import { google } from "googleapis";
import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/auth-helpers";
import { isAdminRole } from "@/lib/auth-roles";
import { convertGoogleDocToHtml } from "@/lib/google-docs";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const DRIVE_FOLDER_ID = "19UJsSXVRV0sEd67JCwHSu9Atm3H_5D6K";

function getGoogleAuth() {
  const keyFilePath = path.join(process.cwd(), "google.json");

  // 1. Try local file (dev/legacy)
  if (fs.existsSync(keyFilePath)) {
    return new google.auth.GoogleAuth({
      keyFile: keyFilePath,
      scopes: [
        "https://www.googleapis.com/auth/documents.readonly",
        "https://www.googleapis.com/auth/drive",
      ],
    });
  }

  // 2. Try JSON content in Env Var (Docker/Prod)
  if (process.env.GOOGLE_SERVICE_ACCOUNT) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
      return new google.auth.GoogleAuth({
        credentials,
        scopes: [
          "https://www.googleapis.com/auth/documents.readonly",
          "https://www.googleapis.com/auth/drive",
        ],
      });
    } catch (e) {
      console.error("Invalid GOOGLE_SERVICE_ACCOUNT JSON", e);
    }
  }

  // 3. Fallback to standard discovery (GOOGLE_APPLICATION_CREDENTIALS or GCE metadata)
  return new google.auth.GoogleAuth({
    scopes: [
      "https://www.googleapis.com/auth/documents.readonly",
      "https://www.googleapis.com/auth/drive",
    ],
  });
}

async function requireDocAdmin() {
  const session = await getServerSession();
  if (!session?.user) return { error: "Non authentifié" as const, user: null };

  const supabase = await createClient();
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
    if (authError || !user) return { success: false, error: authError || "Non authentifié" };

    const auth = getGoogleAuth();
    const docs = google.docs({
      version: "v1",
      auth,
    });

    const docResponse = await docs.documents.get({ documentId: docId });
    const doc = docResponse.data;

    if (!doc.title || !doc.body) {
      return { success: false, error: "Document invalide ou vide" };
    }

    const htmlContent = convertGoogleDocToHtml(doc);

    const baseSlug = (doc.title || "sans-titre")
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "-")
      .replaceAll(/^-|-$/g, "");
    const slug = `${baseSlug}-${Date.now().toString().slice(-6)}`;

    // Use Admin Client to bypass RLS
    const supabase = createAdminClient();
    const { data, error } = await (supabase as any)
      .from("articles")
      .insert({
        title: doc.title,
        content: htmlContent,
        author_id: user.id,
        status: "draft",
        slug: slug,
        category: "Import Google Doc",
        excerpt: "Importé depuis Google Docs",
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase Insert Error:", error);
      return { success: false, error: `Erreur base de données: ${error.message}` };
    }

    revalidatePath("/dashboard/news");
    return { success: true, data };
  } catch (error: unknown) {
    const err = error as { code?: number; message?: string };
    console.error("Google Import Error:", err);
    if (err.code === 403) return { success: false, error: "Accès refusé. Document non public." };
    return { success: false, error: err.message || "Erreur lors de l'import." };
  }
}

/**
 * Importer tous les Google Docs d'un dossier spécifique
 */
export async function importDriveFolder() {
  try {
    const { error: authError } = await requireDocAdmin();
    if (authError) return { success: false, error: authError };

    const auth = getGoogleAuth();
    const drive = google.drive({ version: "v3", auth });

    // Lister les fichiers Google Docs dans le dossier
    const res = await drive.files.list({
      q: `'${DRIVE_FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.document' and trashed = false`,
      fields: "files(id, name)",
    });

    const files = res.data.files || [];
    if (files.length === 0)
      return { success: true, message: "Aucun document trouvé dans le dossier." };

    let importedCount = 0;
    for (const file of files) {
      if (file.id) {
        const result = await importGoogleDoc(file.id);
        if (result.success) importedCount++;
      }
    }

    revalidatePath("/dashboard/news");
    return { success: true, message: `${importedCount} articles importés avec succès.` };
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("Drive Import Error:", err);
    return { success: false, error: err.message || "Erreur lors de l'importation du dossier." };
  }
}

/**
 * Exporter un article vers Google Drive (en tant que nouveau Google Doc)
 */
export async function exportToGoogleDrive(newsId: string) {
  try {
    const { error: authError } = await requireDocAdmin();
    if (authError) return { success: false, error: authError };

    const supabase = await createClient();
    const { data: news, error: fetchError } = await supabase
      .from("articles")
      .select("*")
      .eq("id", newsId)
      .single();

    if (fetchError || !news) return { success: false, error: "Article introuvable." };

    const item = news as any;
    const auth = getGoogleAuth();
    const drive = google.drive({ version: "v3", auth });

    const res = await drive.files.create({
      requestBody: {
        name: `[Export] ${item.title}`,
        mimeType: "application/vnd.google-apps.document",
        parents: [DRIVE_FOLDER_ID],
      },
      media: {
        mimeType: "text/html",
        body: item.content,
      },
    });

    return { success: true, fileId: res.data.id };
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("Drive Export Error:", err);
    return { success: false, error: err.message || "Erreur lors de l'exportation." };
  }
}
