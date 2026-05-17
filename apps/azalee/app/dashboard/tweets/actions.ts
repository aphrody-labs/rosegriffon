"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/auth-helpers";
import { isAdminRole } from "@/lib/auth-roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { type TweetFormValues, TweetSchema } from "./schema";

async function requireTweetAdmin() {
  const session = await getServerSession();
  if (!session?.user) return { error: "Non authentifié" as const, session: null };

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (!profile || !isAdminRole(profile.role)) {
    return { error: "Permissions insuffisantes" as const, session: null };
  }

  return { error: null, session };
}

export async function deleteTweet(id: string) {
  const { error: authError, session } = await requireTweetAdmin();
  if (authError || !session) throw new Error(authError || "Non authentifié");

  const adminDb = createAdminClient();
  await adminDb.from("tweets").delete().eq("id", id);
  revalidatePath("/dashboard/tweets");
}

export async function saveTweet(data: TweetFormValues) {
  const parsed = TweetSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Données invalides" };
  }

  const { error: authError, session } = await requireTweetAdmin();
  if (authError || !session) return { success: false, error: authError || "Non authentifié" };

  const adminDb = createAdminClient();
  const payload = {
    text: parsed.data.text,
    author_username: parsed.data.author_username,
    author_name: parsed.data.author_name,
    updated_at: new Date().toISOString(),
  };

  let error;
  if (parsed.data.id) {
    ({ error } = await adminDb.from("tweets").update(payload).eq("id", parsed.data.id));
  } else {
    // Create new
    const id = Date.now().toString(); // Simple ID generation
    ({ error } = await adminDb
      .from("tweets")
      .insert([{ ...payload, id, created_at: new Date().toISOString() }]));
  }

  if (error) {
    console.error(error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/tweets");
  return { success: true };
}
