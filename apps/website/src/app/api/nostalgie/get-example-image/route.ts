import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/server";

/**
 * API Route pour récupérer l'URL publique ou signée de l'image ogVR.jpg
 * depuis le bucket 'nostalgie' de Supabase Storage
 *
 * Endpoints:
 * GET /api/nostalgie/get-example-image - Récupère l'URL publique/signée
 */

export async function GET() {
  try {
    const supabase = createAdminClient();

    if (!supabase) {
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    const bucketName = "nostalgie";
    const fileName = "ogVR.jpg";

    // Try to get public URL first (if bucket is public)
    const { data: publicData } = supabase.storage.from(bucketName).getPublicUrl(fileName);

    // If bucket is private, create a signed URL (5 minutes validity)
    const { data: signedData, error: signedError } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(fileName, 300); // 5 minutes

    if (signedError && signedData === null) {
      // If signed URL fails, return public URL as fallback
      console.warn(`Could not create signed URL for ${fileName}: ${signedError.message}`);
      return NextResponse.json({
        success: true,
        url: publicData.publicUrl,
        type: "public",
        bucket: bucketName,
        file: fileName,
      });
    }

    // Return signed URL if available
    if (signedData?.signedUrl) {
      return NextResponse.json({
        success: true,
        url: signedData.signedUrl,
        type: "signed",
        bucket: bucketName,
        file: fileName,
        expiresIn: 300,
      });
    }

    // Fallback to public URL
    return NextResponse.json({
      success: true,
      url: publicData.publicUrl,
      type: "public",
      bucket: bucketName,
      file: fileName,
    });
  } catch (error) {
    console.error("Error fetching example image URL:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch image URL",
      },
      { status: 500 }
    );
  }
}
