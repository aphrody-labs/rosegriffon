import { Routes } from "@angular/router";
import { clanGuard } from "./core/guards/clan-guard";
import { authGuard } from "./core/guards/auth-guard";
import { inClanGuard } from "./core/guards/in-clan-guard";
import { userProfileGuard } from "./core/guards/user-profile-guard";
import { ClanMemberRole } from "./core/models/ClanMember";
import { userRoleGuard } from "./core/guards/user-role-guard";
import { UserRole } from "./core/models/Suggestion";

export const routes: Routes = [
	{
		path: "",
		loadComponent: () => import("./views/homepage/homepage").then((m) => m.Homepage),
	},
	{
		path: "auth",
		loadComponent: () => import("./views/auth-page/auth-page").then((m) => m.AuthPage),
	},
	{
		path: "clans",
		loadComponent: () => import("./views/clans-list/clans-list").then((m) => m.ClansList),
	},
	{
		path: "clans/create",
		loadComponent: () => import("./views/clan-creation/clan-creation").then((m) => m.ClanCreation),
		canActivate: [authGuard],
	},
	{
		path: "clans/dashboard",
		loadComponent: () =>
			import("./views/clan-dashboard/clan-dashboard").then((m) => m.ClanDashboard),
		canActivate: [inClanGuard(ClanMemberRole.SubCaptain)],
	},
	{
		path: "clans/:id",
		loadComponent: () => import("./views/clan-profile/clan-profile").then((m) => m.ClanProfile),
		canActivate: [clanGuard],
	},
	{
		path: "users/:id",
		loadComponent: () =>
			import("./views/user-profile/user-profile.component").then((m) => m.UserProfile),
		canActivate: [userProfileGuard],
	},
	{
		path: "events/create/tournament",
		loadComponent: () =>
			import("./views/tournament-creation/tournament-creation").then((m) => m.TournamentCreation),
		canActivate: [authGuard],
	},
	{
		path: "events/list/tournament",
		loadComponent: () =>
			import("./shared/components/tournament-table/tournament-table").then(
				(m) => m.TournamentTable
			),
		data: { isStandalone: true },
	},
	{
		// Astral League — championnat (format officiel Achillea)
		path: "leagues/astral",
		loadComponent: () =>
			import("./views/asytral-league/asytral-league").then((m) => m.AsytralLeague),
	},
	{
		path: "leagues/astral-s1",
		redirectTo: "leagues/astral",
		pathMatch: "full",
	},
	// Alias orthographe sheet « Asytral »
	{
		path: "leagues/asytral",
		redirectTo: "leagues/astral",
		pathMatch: "full",
	},
	{
		path: "leagues/asytral-s1",
		redirectTo: "leagues/astral",
		pathMatch: "full",
	},
	{
		path: "events/tournaments/circuit/ranking",
		loadComponent: () =>
			import("./views/tournament-ranking/tournament-ranking").then((m) => m.TournamentRanking),
	},
	{
		path: "events/tournaments/:id",
		loadComponent: () =>
			import("./views/tournament-page/tournament-page").then((m) => m.TournamentPage),
	},
	{
		path: "organizations/create",
		loadComponent: () =>
			import("./views/organization-creation/organization-creation").then(
				(m) => m.OrganizationCreation
			),
		canActivate: [authGuard],
	},
	{
		path: "admins/dashboard",
		loadComponent: () =>
			import("./views/admin-dashboard/admin-dashboard").then((m) => m.AdminDashboard),
		// Modérateur+ peut atteindre le dashboard (onglets Litiges/Télémétrie Ranked).
		// Les actions sensibles (valider/annuler) restent protégées Admin+ côté serveur.
		canActivate: [userRoleGuard(UserRole.Moderator)],
	},
	{
		path: "admins/sanctions",
		loadComponent: () =>
			import("./views/admin-dashboard/sanctions-tab/sanctions-tab").then(
				(m) => m.SanctionsTabComponent
			),
		canActivate: [userRoleGuard(UserRole.Administrator)],
	},
	{
		path: "admins/dashboard/organizations/validate/:id",
		loadComponent: () =>
			import("./views/organization-validation/organization-validation").then(
				(m) => m.OrganizationValidation
			),
		canActivate: [userRoleGuard(UserRole.Administrator)],
	},
	{
		path: "admins/ranked-disputes",
		loadComponent: () =>
			import("./views/admin-dashboard/ranked-disputes-tab/ranked-disputes-tab").then(
				(m) => m.RankedDisputesTabComponent
			),
		canActivate: [userRoleGuard(UserRole.Administrator)],
	},
	{
		path: "ranked",
		loadComponent: () => import("./views/ranked/ranked").then((m) => m.Ranked),
		canActivate: [authGuard],
	},
	{
		path: "ranked/tiers",
		loadComponent: () => import("./views/ranked-tiers/ranked-tiers").then((m) => m.RankedTiers),
	},
	{
		path: "ranked/leaderboard",
		loadComponent: () =>
			import("./views/ranked-leaderboard/ranked-leaderboard").then((m) => m.RankedLeaderboard),
	},
	{
		path: "ranked/history",
		loadComponent: () =>
			import("./views/ranked-history/ranked-history").then((m) => m.RankedHistory),
		canActivate: [authGuard],
	},
	{
		path: "ranked/match",
		loadComponent: () => import("./views/ranked-match/ranked-match").then((m) => m.RankedMatch),
		canActivate: [authGuard],
	},
	{
		// Page d'acceptation d'un défi par lien (gère elle-même la connexion requise).
		path: "ranked/defi/:code",
		loadComponent: () =>
			import("./views/ranked-challenge/ranked-challenge").then((m) => m.RankedChallenge),
	},
	{
		path: "licence",
		loadComponent: () => import("./views/licence/licence").then((m) => m.Licence),
		canActivate: [authGuard],
	},
	{
		// Vérification PUBLIQUE d'une licence (pas de guard).
		path: "licence/verify/:qr",
		loadComponent: () =>
			import("./views/licence-verify/licence-verify").then((m) => m.LicenceVerify),
	},
	{
		path: "wallet",
		loadComponent: () => import("./views/wallet/wallet").then((m) => m.Wallet),
		canActivate: [authGuard],
	},
	{
		path: "casts",
		loadComponent: () =>
			import("./views/casts-public/casts-public").then((m) => m.CastsPublicComponent),
	},
	{
		path: "casts/:tournamentId/availability",
		loadComponent: () =>
			import("./views/cast-availability/cast-availability").then(
				(m) => m.CastAvailabilityComponent
			),
		canActivate: [authGuard],
	},
	{
		path: "casts/:tournamentId/planning",
		loadComponent: () =>
			import("./views/cast-planning/cast-planning").then((m) => m.CastPlanningComponent),
		canActivate: [userRoleGuard(UserRole.Administrator)],
	},
	{
		path: "guide",
		loadComponent: () => import("./views/guide/guide").then((m) => m.Guide),
	},
	{
		path: "guide/brand",
		loadComponent: () =>
			import("./views/guide/brand/brand.component").then((m) => m.BrandComponent),
	},
	{
		path: "forbidden",
		loadComponent: () => import("./views/forbidden/forbidden").then((m) => m.Forbidden),
	},
	{
		path: "not-found",
		loadComponent: () => import("./views/not-found/not-found").then((m) => m.NotFound),
	},
	{ path: "**", redirectTo: "not-found" },
];
