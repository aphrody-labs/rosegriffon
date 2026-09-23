import { describe, expect, test } from "bun:test";
import { listPublicClans } from "./unified-clans";

const clan = {
	id: 1,
	name: "Rose Griffon",
	shortName: "RG",
	avatarUrl: "",
	biography: "",
	fame: 10,
	isRecruiting: true,
	membersLimit: false,
};

describe("annuaire clans unifié", () => {
	test("lit les pages API et respecte la limite de 50", async () => {
		const urls: string[] = [];
		const fetcher = async (input: RequestInfo | URL) => {
			const url = new URL(String(input));
			urls.push(url.toString());
			return Response.json({
				data:
					url.searchParams.get("page") === "1"
						? Array.from({ length: 50 }, (_, id) => ({ ...clan, id }))
						: [{ ...clan, id: 50 }],
				count: 51,
			});
		};
		const result = await listPublicClans(fetcher, "https://api.example.test");
		expect(result).toHaveLength(51);
		expect(urls).toEqual([
			"https://api.example.test/v1/achillea/clans?page=1&pageSize=50",
			"https://api.example.test/v1/achillea/clans?page=2&pageSize=50",
		]);
	});

	test("rejette une réponse compacte incomplète sans inventer de données", async () => {
		const fetcher = async () =>
			Response.json({
				data: [{ id: 1, name: "Incomplet" }],
				count: 1,
			});
		expect(listPublicClans(fetcher)).rejects.toThrow("réponse invalide");
	});
});
