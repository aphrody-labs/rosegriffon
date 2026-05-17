"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logAdminAction } from "@/lib/admin-logger";
import { getCalendarEvents } from "@/lib/api/events";
import { getServerUser } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import type { Insert } from "@/types/rg";

const eventSchema = z.object({
  title: z.string().min(3, "Le titre doit contenir au moins 3 caractères"),
  description: z.string().optional(),
  start_time: z.string().refine((val) => !Number.isNaN(Date.parse(val)), {
    message: "Date de début invalide",
  }),
  end_time: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
      message: "Date de fin invalide",
    }),
  location: z.string().optional(),
  image_url: z.string().optional(),
});

type ActionState = {
  message?: string;
  errors?: Record<string, string[]>;
  success?: boolean;
};

export async function syncGoogleEvents() {
  const supabase = await createClient();
  const googleEvents = await getCalendarEvents();

  let importedCount = 0;
  let skippedCount = 0;

  for (const event of googleEvents) {
    if (!event.summary || !event.start) continue;

    // Determine start/end time
    const startTime = event.start.dateTime || event.start.date;
    const endTime = event.end?.dateTime || event.end?.date;

    if (!startTime) continue;

    // Check for duplicates (fuzzy match by title and start time)
    // Ideally we would store the Google ID, but for now we check title + start
    const { data: existing } = await supabase
      .from("events")
      .select("id")
      .eq("title", event.summary)
      .eq("start_time", startTime)
      .single();

    if (existing) {
      skippedCount++;
      continue;
    }

    const eventData: Insert<"events"> = {
      title: event.summary,
      description: event.description || "",
      location: event.location || "",
      start_time: startTime,
      end_time: endTime || startTime,
      // Default image if not present (could extract from description if you had logic for that)
      image_url: null,
    };

    const { error } = await supabase.from("events").insert([eventData]);

    if (!error) {
      importedCount++;
    } else {
      console.error("Error importing event:", error);
    }
  }

  const user = await getServerUser();

  if (user) {
    await logAdminAction("sync", "events", undefined, {
      imported: importedCount,
      skipped: skippedCount,
    });
  }

  revalidatePath("/admin/events");
  return { success: true, imported: importedCount, skipped: skippedCount };
}

export async function createEvent(_prevState: ActionState, formData: FormData) {
  const supabase = await createClient();

  const rawData = {
    title: formData.get("title"),
    description: formData.get("description"),
    start_time: formData.get("start_time"),
    end_time: formData.get("end_time") || null,
    location: formData.get("location"),
    image_url: formData.get("image_url"),
  };

  const validatedFields = eventSchema.safeParse(rawData);

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Erreur de validation des champs",
    };
  }

  // Casting validatedFields.data to Insert<"events"> to ensure compatibility
  // Zod schema should match DB schema but sometimes optional vs null can vary
  const eventData: Insert<"events"> = {
    title: validatedFields.data.title,
    description: validatedFields.data.description,
    start_time: validatedFields.data.start_time,
    end_time: validatedFields.data.end_time || validatedFields.data.start_time,
    location: validatedFields.data.location,
    image_url: validatedFields.data.image_url,
  };

  const { error } = await supabase.from("events").insert([eventData]);

  if (error) {
    return {
      message: `Erreur lors de la création de l'événement: ${error.message}`,
    };
  }

  const user = await getServerUser();

  if (user) {
    await logAdminAction("create", "event", undefined, validatedFields.data);
  }

  revalidatePath("/admin/events");
  redirect("/admin/events");
}

export async function updateEvent(id: string, _prevState: ActionState, formData: FormData) {
  const supabase = await createClient();

  const rawData = {
    title: formData.get("title"),
    description: formData.get("description"),
    start_time: formData.get("start_time"),
    end_time: formData.get("end_time") || null,
    location: formData.get("location"),
    image_url: formData.get("image_url"),
  };

  const validatedFields = eventSchema.safeParse(rawData);

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Erreur de validation des champs",
    };
  }

  // Clean the data to match Update<"events"> (remove nulls for fields that don't allow it)
  const updateData = {
    ...validatedFields.data,
    end_time: validatedFields.data.end_time || undefined,
  };

  const { error } = await supabase.from("events").update(updateData).eq("id", id);

  if (error) {
    return {
      message: `Erreur lors de la mise à jour de l'événement: ${error.message}`,
    };
  }

  const user = await getServerUser();

  if (user) {
    await logAdminAction("update", "event", id, validatedFields.data);
  }

  revalidatePath("/admin/events");
  redirect("/admin/events");
}

export async function deleteEvent(id: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("events").delete().eq("id", id);

  if (error) {
    return {
      message: `Erreur lors de la suppression de l'événement: ${error.message}`,
    };
  }

  const user = await getServerUser();

  if (user) {
    await logAdminAction("delete", "event", id, {});
  }

  revalidatePath("/admin/events");
  return { success: true };
}
