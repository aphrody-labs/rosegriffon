"use server";

import { createLogger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import type { StreamSchedule } from "@rose-griffon/types";

const logger = createLogger("stream-schedule");

const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

function isValidTimeFormat(time: unknown): boolean {
	if (typeof time !== "string") {
		return false;
	}
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

			if (!dayName) {
				return;
			}

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

			groupedByDay[dayName].push(schedule as unknown as StreamSchedule);
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
			groupedByDay.Prochainement = comingSoon as unknown as StreamSchedule[];
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
		return (schedules || []) as unknown as StreamSchedule[];
	} catch (error) {
		logger.error("Exception dans getAllSchedules:", error);
		return [];
	}
}
