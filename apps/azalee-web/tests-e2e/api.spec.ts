import { test, expect } from "@playwright/test";

test.describe("API Endpoints & GraphQL Validation", () => {
	// 1. Health check route
	test("GET /api/health returns correct schema", async ({ request }) => {
		const response = await request.get("/api/health");
		expect(response.status()).toBe(200);
		
		const body = await response.json();
		expect(body).toHaveProperty("status");
		expect(body).toHaveProperty("checks");
		expect(body.status).toBe("ok");
		expect(body.checks.db).toBe("ok");
	});

	// 2. News feed route
	test("GET /api/news/feed returns paginated articles", async ({ request }) => {
		const response = await request.get("/api/news/feed?page=1&limit=5");
		expect(response.status()).toBe(200);
		
		const body = await response.json();
		expect(body).toHaveProperty("items");
		expect(body).toHaveProperty("hasMore");
		expect(Array.isArray(body.items)).toBe(true);
		
		if (body.items.length > 0) {
			const item = body.items[0];
			expect(item).toHaveProperty("id");
			expect(item).toHaveProperty("title");
			expect(item).toHaveProperty("slug");
			expect(item).toHaveProperty("excerpt");
			expect(item).toHaveProperty("type", "article");
		}
	});

	// 3. Popular tags route
	test("GET /api/tags/popular returns tags list", async ({ request }) => {
		const response = await request.get("/api/tags/popular");
		expect(response.status()).toBe(200);
		
		const body = await response.json();
		expect(Array.isArray(body)).toBe(true);
		if (body.length > 0) {
			expect(body[0]).toHaveProperty("tag");
			expect(body[0]).toHaveProperty("count");
		}
	});

	// 4. GraphQL endpoint (Yoga JIT caching)
	test("POST /api/graphql resolves character query successfully", async ({ request }) => {
		const graphqlQuery = {
			query: `
				query GetTestCharacter {
					characters(limit: 1) {
						id
						name {
							fr
							en
						}
					}
				}
			`
		};

		const response = await request.post("/api/graphql", {
			data: graphqlQuery,
			headers: {
				"Content-Type": "application/json"
			}
		});

		expect(response.status()).toBe(200);
		
		const body = await response.json();
		expect(body).toHaveProperty("data");
		expect(body.data).toHaveProperty("characters");
		expect(Array.isArray(body.data.characters)).toBe(true);
		expect(body.data.characters.length).toBeGreaterThan(0);
		
		const char = body.data.characters[0];
		expect(char).toHaveProperty("id");
		expect(char).toHaveProperty("name");
		expect(char.name).toHaveProperty("fr");
	});
});
