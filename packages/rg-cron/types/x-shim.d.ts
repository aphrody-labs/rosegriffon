// Shim de types pour `@aphrody-code/x` — utilisé UNIQUEMENT à la compilation.
// Empêche tsc d'analyser les sources TS brutes du package tiers qui provoquent
// des erreurs de strictNullChecks/noImplicitAny incompatibles.

/* eslint-disable @typescript-eslint/no-explicit-any */

declare module "@aphrody-code/x" {
	export type XClient = any;
	export const XClient: any;
	
	export type XSession = any;
	export const XSession: any;

	export const radarSearch: any;
	export type Tweet = any;
}
