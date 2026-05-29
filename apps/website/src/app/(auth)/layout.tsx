import { redirect } from "next/navigation";

import { getServerUser } from "@/lib/auth-helpers";

/**
 * Server-side guard pour les pages d'auth (login, forgot-password, reset).
 * Si l'utilisateur a déjà une session valide, on évite la confusion en le
 * renvoyant directement sur son espace.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
	const user = await getServerUser();
	if (user) {
		redirect("/dashboard");
	}
	return <>{children}</>;
}
