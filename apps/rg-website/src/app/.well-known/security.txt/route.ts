// SPDX-License-Identifier: Apache-2.0
// /.well-known/security.txt (RFC 9116). Régénéré chaque jour : `Expires` reste à un an.
import { securityTxt } from "@/lib/security-txt";
import { SITE_URL } from "@/lib/site-url";

export const dynamic = "force-static";
export const revalidate = 86400;

export function GET(): Response {
  return new Response(securityTxt(SITE_URL), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
