"use server";

import { revalidatePath } from "next/cache";
import { getServerUser } from "@/lib/auth-helpers";

import { createLogger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import type { Insert } from "@rosegriffon/db";
import type { StreamSchedule } from "@rosegriffon/types";

import { fetchGoogleCalendarEvents } from "./google-calendar-actions";

const logger = createLogger("stream-schedule");

const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

function isValidTimeFormat(time: unknown): boolean {
  if (typeof time !== "string") {return false;}
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
}

/**
 * Récupère tous les horaires de stream groupés par jour
 */
export async function getSchedulesByDay(): Promise<Record<string, StreamSchedule[]>> {
  try {
    const supabase = await createClient();

    logger.debug("Récupération des horaires actifs");

    const { data: schedules, error } = await supabase
      .from("stream_schedules")
      .select("*")
      .eq("status", "active")
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) {
      logger.error("Erreur lors de la récupération des horaires actifs:", error);
      return {};
    }

    // Grouper par jour
    const groupedByDay: Record<string, StreamSchedule[]> = {};

    schedules?.forEach((schedule) => {
      const dayIndex = schedule.day_of_week % 7; // Ensure valid index
      const dayName = DAYS[dayIndex];

      if (!dayName) {return;}

      if (!groupedByDay[dayName]) {
        groupedByDay[dayName] = [];
      }

      // Valider les formats de temps
      if (!isValidTimeFormat(schedule.start_time) || !isValidTimeFormat(schedule.end_time)) {
        logger.warn(`Format d'heure invalide pour ${schedule.streamer_name}`, {
          end_time: schedule.end_time,
          start_time: schedule.start_time,
        });
      }

      groupedByDay[dayName].push(schedule);
    });

    logger.debug(
      `${Object.keys(groupedByDay).length} jour(s) avec ${schedules?.length || 0} stream(s)`
    );

    // Ajouter les "à venir"
    const { data: comingSoon, error: comingSoonError } = await supabase
      .from("stream_schedules")
      .select("*")
      .eq("status", "coming_soon")
      .order("created_at", { ascending: false });

    if (comingSoonError) {
      logger.warn("Erreur lors de la récupération des streams à venir:", comingSoonError);
    }

    if (comingSoon && comingSoon.length > 0) {
      logger.debug(`${comingSoon.length} stream(s) à venir`);
      groupedByDay.Prochainement = comingSoon;
    }

    return groupedByDay;
  } catch (error) {
    logger.error("Exception dans getSchedulesByDay:", error);
    return {};
  }
}

/**
 * Récupère tous les horaires de stream sans groupement
 */
export async function getAllSchedules(): Promise<StreamSchedule[]> {
  try {
    const supabase = await createClient();

    logger.debug("Récupération de tous les horaires");

    const { data: schedules, error } = await supabase
      .from("stream_schedules")
      .select("*")
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) {
      logger.error("Erreur lors de la récupération de tous les horaires:", error);
      return [];
    }

    logger.debug(`${schedules?.length || 0} horaire(s) récupéré(s)`);
    return schedules || [];
  } catch (error) {
    logger.error("Exception dans getAllSchedules:", error);
    return [];
  }
}

/**
 * Ajoute un nouvel horaire de stream
 */
export async function addSchedule(
  data: Insert<"stream_schedules">
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // Vérifier les permissions
    const user = await getServerUser();
    if (!user) {
      logger.warn("Tentative d'ajout sans authentification");
      return { error: "Non authentifié", success: false };
    }

    // Valider les données
    if (!isValidTimeFormat(data.start_time) || !isValidTimeFormat(data.end_time)) {
      return { error: "Format d'heure invalide", success: false };
    }

    logger.debug(`Ajout d'un horaire pour ${data.streamer_name}`);

    const { error } = await supabase.from("stream_schedules").insert([data]);

    if (error) {
      logger.error("Erreur lors de l'ajout de l'horaire:", error);
      return { error: error.message, success: false };
    }

    logger.info(`Horaire ajouté pour ${data.streamer_name}`);
    return { success: true };
  } catch (error) {
    logger.error("Exception dans addSchedule:", error);
    return { error: "Erreur serveur", success: false };
  }
}

/**
 * Met à jour un horaire de stream
 */
export async function updateSchedule(
  id: string,
  updateData: Partial<StreamSchedule> // This is actually Update<"stream_schedules"> but Partial<StreamSchedule> is compatible
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // Vérifier les permissions
    const user = await getServerUser();
    if (!user) {
      logger.warn(`Tentative de mise à jour sans authentification (ID: ${id})`);
      return { error: "Non authentifié", success: false };
    }

    // Valider les formats de temps s'ils sont fournis
    if (updateData.start_time && !isValidTimeFormat(updateData.start_time)) {
      return {
        error: "Format d'heure invalide pour start_time",
        success: false,
      };
    }
    if (updateData.end_time && !isValidTimeFormat(updateData.end_time)) {
      return { error: "Format d'heure invalide pour end_time", success: false };
    }

    logger.debug(`Mise à jour de l'horaire ${id}`);

    const { error } = await supabase.from("stream_schedules").update(updateData).eq("id", id);

    if (error) {
      logger.error(`Erreur lors de la mise à jour de l'horaire ${id}:`, error);
      return { error: error.message, success: false };
    }

    logger.info(`Horaire ${id} mis à jour`);
    return { success: true };
  } catch (error) {
    logger.error("Exception dans updateSchedule:", error);
    return { error: "Erreur serveur", success: false };
  }
}

/**
 * Supprime un horaire de stream
 */
export async function deleteSchedule(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // Vérifier les permissions
    const user = await getServerUser();
    if (!user) {
      logger.warn(`Tentative de suppression sans authentification (ID: ${id})`);
      return { error: "Non authentifié", success: false };
    }

    logger.debug(`Suppression de l'horaire ${id}`);

    const { error } = await supabase.from("stream_schedules").delete().eq("id", id);

    if (error) {
      logger.error(`Erreur lors de la suppression de l'horaire ${id}:`, error);
      return { error: error.message, success: false };
    }

    logger.info(`Horaire ${id} supprimé`);
    return { success: true };
  } catch (error) {
    logger.error("Exception dans deleteSchedule:", error);
    return { error: "Erreur serveur", success: false };
  }
}

/**
 * Récupère les statistiques des horaires
 */
export async function getScheduleStats(): Promise<{
  total: number;
  active: number;
  comingSoon: number;
  streamersCount: number;
}> {
  try {
    const schedules = await getAllSchedules();

    const active = schedules.filter((s) => s.status === "active").length;
    const comingSoon = schedules.filter((s) => s.status === "coming_soon").length;
    const streamersSet = new Set(schedules.map((s) => s.streamer_name));

    return {
      active,
      comingSoon,
      streamersCount: streamersSet.size,
      total: schedules.length,
    };
  } catch (error) {
    logger.error("Exception dans getScheduleStats:", error);
    return { active: 0, comingSoon: 0, streamersCount: 0, total: 0 };
  }
}

/**
 * Synchronise le planning avec Google Calendar
 */
export async function syncWithGoogleCalendar() {
  try {
    const supabase = await createClient();
    const events = await fetchGoogleCalendarEvents(14); // 2 semaines

    // Supprimer l'ancien planning (tout ce qui a un jour valide)
    const { error: deleteError } = await supabase
      .from("stream_schedules")
      .delete()
      .gte("day_of_week", 0);

    if (deleteError) {throw deleteError;}

    // Insérer le nouveau planning
    if (events.length > 0) {
      const { error: insertError } = await supabase.from("stream_schedules").insert(
        events.map((e) => ({
          category: e.category,
          day_of_week: e.day_of_week,
          start_time: e.start_time!,
          status: "active",
          streamer_name: e.streamer_name,
        }))
      );

      if (insertError) {throw insertError;}
    }

    revalidatePath("/admin/stream-schedule");
    revalidatePath("/rose-griffon-tv");
    return { count: events.length, success: true };
  } catch (error) {
    logger.error("Erreur sync Google Calendar:", error);
    return { error: "Erreur lors de la synchronisation", success: false };
  }
}
