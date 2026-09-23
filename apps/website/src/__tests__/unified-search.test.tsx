import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const push = mock(() => {});
mock.module("next/navigation", () => ({ useRouter: () => ({ push }) }));

const { UnifiedSearchBar } =
	await import("../../../../packages/app-shell/src/components/UnifiedSearchBar");
const originalFetch = globalThis.fetch;

function stubFetch(responder: () => Promise<Response>) {
	globalThis.fetch = Object.assign(mock(responder), { preconnect: originalFetch.preconnect });
}

afterEach(() => {
	cleanup();
	globalThis.fetch = originalFetch;
	push.mockClear();
});

describe("UnifiedSearchBar", () => {
	test("efface les anciens résultats et distingue une panne de recherche", async () => {
		stubFetch(
			async () =>
				new Response(
					JSON.stringify({
						resultats: [{ domaine: "wiki", href: "/wiki/chara/axel", id: "axel", titre: "Axel" }],
					}),
					{ status: 200 }
				)
		);
		render(<UnifiedSearchBar />);
		const input = screen.getByRole("textbox", { name: "Recherche unifiée" });
		fireEvent.change(input, { target: { value: "axel" } });
		await waitFor(() => expect(screen.getByText("Axel")).toBeTruthy());

		stubFetch(async () => new Response("", { status: 503 }));
		fireEvent.change(input, { target: { value: "jude" } });
		expect(screen.queryByText("Axel")).toBeNull();
		expect(screen.getByRole("status").textContent).toContain("Recherche dans");
		await waitFor(() =>
			expect(screen.getByRole("status").textContent).toContain("temporairement indisponible")
		);
	});
});
