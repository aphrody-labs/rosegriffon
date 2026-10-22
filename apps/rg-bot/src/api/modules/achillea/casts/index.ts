/**
 * `/casts` — cellule cast : évènements à diffuser, sondage de disponibilités,
 * auto-attribution, échange et confirmation des postes, vitrine des casters.
 *
 * Rôle « sub-CP cast » : faute de rôle dédié, l'administrateur (`role >= 2`)
 * en tient lieu, comme dans le contrôleur legacy.
 */

import { Elysia, status, t } from "elysia";
import { dbPlugin } from "../../../plugins/db";
import { isInternalCall, requireRole, requireSession, ROLE_ADMINISTRATOR } from "../guards";
import { CastModel } from "./model";
import { dispatchReminders, notifyAttributions } from "./notifications";
import { castDb, CastService } from "./service";

const message = t.Object({ message: t.String() });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseDate(value: string | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const eventNotFound = (id: string) => status(404, { message: `CastEvent ${id} introuvable` });
const attributionNotFound = (id: string) => status(404, { message: `CastAttribution ${id} introuvable` });

export const castsController = new Elysia({ prefix: "/casts" })
  .use(dbPlugin)
  .get(
    "/casters",
    async ({ db, set }) => {
      set.headers["cache-control"] = "public, max-age=60";
      return CastService.listCasters(castDb(db));
    },
    { response: { 200: t.Array(CastModel.caster) } },
  )
  .get(
    "/events",
    async ({ db, headers, query }) => {
      const auth = await requireSession(headers);
      if (auth.error) return auth.error;
      const from = parseDate(query.from);
      const to = parseDate(query.to);
      if (from === null || to === null) return status(400, { message: "Date invalide (from / to)" });
      return CastService.listEvents(castDb(db), {
        status: query.status,
        from,
        to,
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 25,
      });
    },
    {
      query: CastModel.listQuery,
      response: { 200: CastModel.list, 400: message, 401: message },
    },
  )
  .get(
    "/events/:id",
    async ({ db, headers, params: { id } }) => {
      const auth = await requireSession(headers);
      if (auth.error) return auth.error;
      if (!UUID.test(id)) return eventNotFound(id);
      const detail = await CastService.getEventDetail(castDb(db), id);
      return detail ?? eventNotFound(id);
    },
    { params: CastModel.idParams, response: { 200: CastModel.detail, 401: message, 404: message } },
  )
  .post(
    "/events",
    async ({ db, headers, body }) => {
      const auth = await requireRole(db, headers, ROLE_ADMINISTRATOR);
      if (auth.error) return auth.error;
      const scheduledAt = parseDate(body.scheduledAt);
      if (!scheduledAt) return status(400, { message: "scheduledAt invalide" });
      const tournamentId = body.tournamentId?.trim() || null;
      if (tournamentId && !UUID.test(tournamentId)) return status(400, { message: "tournamentId invalide" });
      const event = await CastService.createEvent(castDb(db), {
        name: body.name.trim(),
        kind: body.kind,
        scheduledAt,
        duration: body.duration,
        tournamentId,
        twitchUrl: body.twitchUrl?.trim() || null,
        description: body.description ?? null,
        createdBy: auth.session.id,
        slots: body.slots,
      });
      return status(201, event);
    },
    {
      body: CastModel.createBody,
      response: { 201: CastModel.event, 400: message, 401: message, 403: message },
    },
  )
  .post(
    "/events/:id/survey",
    async ({ db, headers, params: { id }, body }) => {
      const auth = await requireRole(db, headers, ROLE_ADMINISTRATOR);
      if (auth.error) return auth.error;
      const casts = castDb(db);
      const event = UUID.test(id) ? await CastService.findEvent(casts, id) : null;
      if (!event) return eventNotFound(id);
      return CastService.openSurvey(casts, event, body.casterPool, auth.session.id);
    },
    {
      params: CastModel.idParams,
      body: CastModel.surveyBody,
      response: { 200: CastModel.surveyResult, 401: message, 403: message, 404: message },
    },
  )
  .post(
    "/events/:id/availability",
    async ({ db, headers, params: { id }, body }) => {
      const auth = await requireSession(headers);
      if (auth.error) return auth.error;
      const casts = castDb(db);
      const event = UUID.test(id) ? await CastService.findEvent(casts, id) : null;
      if (!event) return eventNotFound(id);
      return CastService.recordAvailability(casts, {
        userId: auth.session.id,
        eventId: event.id,
        status: body.status,
        preferredRoles: body.preferredRoles,
        notes: body.notes,
      });
    },
    {
      params: CastModel.idParams,
      body: CastModel.availabilityBody,
      response: { 200: CastModel.availability, 401: message, 404: message },
    },
  )
  .post(
    "/events/:id/auto-assign",
    async ({ db, headers, params: { id }, body }) => {
      const auth = await requireRole(db, headers, ROLE_ADMINISTRATOR);
      if (auth.error) return auth.error;
      const casts = castDb(db);
      const event = UUID.test(id) ? await CastService.findEvent(casts, id) : null;
      if (!event) return eventNotFound(id);
      const attributions = await CastService.autoAssign(casts, event, auth.session.id, body?.maxSlotsPerCaster);
      await notifyAttributions(casts, event, attributions);
      return { created: attributions.length, attributions };
    },
    {
      params: CastModel.idParams,
      body: CastModel.autoAssignBody,
      response: { 200: CastModel.autoAssignResult, 401: message, 403: message, 404: message },
    },
  )
  .patch(
    "/attributions/:id",
    async ({ db, headers, params: { id }, body }) => {
      const auth = await requireRole(db, headers, ROLE_ADMINISTRATOR);
      if (auth.error) return auth.error;
      if (!UUID.test(id)) return attributionNotFound(id);
      const casts = castDb(db);
      const updated = await CastService.swap(casts, id, body.newCasterId.trim(), auth.session.id);
      if (!updated) return attributionNotFound(id);
      const event = await CastService.findEventOfSlot(casts, updated.slotId);
      if (event) await notifyAttributions(casts, event, [updated]);
      return updated;
    },
    {
      params: CastModel.idParams,
      body: CastModel.swapBody,
      response: { 200: CastModel.attribution, 401: message, 403: message, 404: message },
    },
  )
  .post(
    "/attributions/:id/confirm",
    async ({ db, headers, params: { id } }) => {
      const auth = await requireSession(headers);
      if (auth.error) return auth.error;
      const casts = castDb(db);
      const attribution = UUID.test(id) ? await CastService.findAttribution(casts, id) : null;
      if (!attribution) return attributionNotFound(id);
      if (attribution.userId !== auth.session.id)
        return status(403, { message: "Seul le caster assigné peut confirmer cette attribution" });
      const confirmed = await CastService.confirm(casts, id, auth.session.id);
      return confirmed ?? status(409, { message: "Attribution modifiée entre-temps" });
    },
    {
      params: CastModel.idParams,
      response: { 200: CastModel.attribution, 401: message, 403: message, 404: message, 409: message },
    },
  )
  // Rappels J-2 / H-2 (MP + récapitulatif staff). À appeler toutes les 15 min
  // par l'ordonnanceur (`x-internal-secret`) ; un administrateur peut aussi le
  // déclencher. Idempotent : un caster n'est rappelé qu'une fois par palier.
  .post(
    "/reminders/dispatch",
    async ({ db, headers }) => {
      if (!isInternalCall(headers)) {
        const auth = await requireRole(db, headers, ROLE_ADMINISTRATOR);
        if (auth.error) return auth.error;
      }
      const casts = castDb(db);
      const now = new Date();
      return { j2: await dispatchReminders(casts, "j2", now), h2: await dispatchReminders(casts, "h2", now) };
    },
    {
      response: {
        200: t.Object({
          j2: CastModel.reminderReport,
          h2: CastModel.reminderReport,
        }),
        401: message,
        403: message,
      },
    },
  );
