import { ACHILLEA_SESSION_COOKIE_NAME } from "@rosegriffon/achillea-core/auth";

/** Domaine parent sur lequel le site pose le cookie de session en production. */
export const ACHILLEA_SESSION_COOKIE_DOMAIN = ".rosegriffon.fr";

/**
 * `Set-Cookie` qui efface la session Achilléa.
 *
 * Un cookie ne s'efface qu'avec le même nom, le même domaine et le même
 * chemin que ceux qui l'ont posé : attributs repris de
 * `apps/rg-website/src/app/api/achillea/session/route.ts` (domaine parent,
 * `HttpOnly`, `Path=/`, `SameSite=Lax`, `Secure` en production). La production
 * se reconnaît aussi aux hôtes de la requête (URL servie, `Origin`,
 * `X-Forwarded-Host`) : relayée en processus par `rg-core`, l'URL peut être
 * locale alors que le navigateur parle à `ranked.rosegriffon.fr`.
 */
export function achilleaSessionClearCookie(request: Request, nodeEnv = process.env.NODE_ENV): string {
  const hostOf = (value: string | null) => {
    if (!value) return "";
    try {
      return new URL(value.includes("://") ? value : `https://${value}`).hostname;
    } catch {
      return "";
    }
  };
  const hosts = [request.url, request.headers.get("origin"), request.headers.get("x-forwarded-host")].map(hostOf);
  const production =
    nodeEnv === "production" || hosts.some(host => host === "rosegriffon.fr" || host.endsWith(".rosegriffon.fr"));
  return [
    `${ACHILLEA_SESSION_COOKIE_NAME}=`,
    ...(production ? [`Domain=${ACHILLEA_SESSION_COOKIE_DOMAIN}`] : []),
    "Path=/",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "HttpOnly",
    ...(production ? ["Secure"] : []),
    "SameSite=Lax",
  ].join("; ");
}
