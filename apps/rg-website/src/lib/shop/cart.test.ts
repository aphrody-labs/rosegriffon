import { describe, expect, it, vi, beforeEach } from "vitest";
import { getCart, addToCart, updateQty, removeFromCart, clearCart } from "./cart";
import { cookies } from "next/headers";
import { cache as redisCache } from "@rose-griffon/db/redis";
import { getServerUser } from "@/lib/auth-helpers";

// Mock products
vi.mock("./products", () => {
	const mockProduct = {
		category: "textile",
		image: "/shop/tshirt.png",
		name: "T-shirt Rose Griffon 2026",
		priceCents: 2000,
		slug: "tee-shirt-rose-griffon-2026",
		tags: ["new"],
	};
	const mockPack = {
		category: "pack-patreon",
		image: "/patreon/destin.webp",
		name: "Pack Personnage — Édition Destin Billows",
		priceCents: 2490,
		slug: "pack-personnage-destin-billows",
		tags: ["limited"],
		variants: [
			{ id: "solstice", label: "Illustration · Solstice" },
		],
	};
	return {
		getProduct: vi.fn((slug) => {
			if (slug === "tee-shirt-rose-griffon-2026") return mockProduct;
			if (slug === "pack-personnage-destin-billows") return mockPack;
			return undefined;
		}),
		getVariantPrice: vi.fn((product, variantId) => {
			return product.priceCents;
		}),
	};
});

// Mock next/headers
vi.mock("next/headers", () => {
	const mockStore = {
		delete: vi.fn(),
		get: vi.fn(),
		set: vi.fn(),
	};
	return {
		cookies: vi.fn(() => mockStore),
	};
});

// Mock next/cache
vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

// Mock @rose-griffon/db/redis
vi.mock("@rose-griffon/db/redis", () => ({
	cache: {
		del: vi.fn(),
		get: vi.fn(),
		set: vi.fn(),
	},
}));

// Mock @/lib/auth-helpers
vi.mock("@/lib/auth-helpers", () => ({
	getServerUser: vi.fn(),
}));

describe("Cart persistence & merging", () => {
	const mockCookies = cookies() as any;

	beforeEach(() => {
		vi.clearAllMocks();
		mockCookies.get.mockReturnValue(undefined);
		mockCookies.set.mockReturnValue(undefined);
		mockCookies.delete.mockReturnValue(undefined);
		vi.mocked(redisCache.get).mockResolvedValue(null);
		vi.mocked(redisCache.set).mockResolvedValue(true);
		vi.mocked(redisCache.del).mockResolvedValue(true);
		vi.mocked(getServerUser).mockResolvedValue(null);
	});

	describe("Anonymous user (Cookie-based cart)", () => {
		it("should return empty cart snapshot when no cookie is present", async () => {
			const cart = await getCart();
			expect(cart.items).toEqual([]);
			expect(cart.itemCount).toBe(0);
			expect(cart.subtotalCents).toBe(0);
		});

		it("should retrieve items from cookie when cookie is present", async () => {
			const initialItems = [
				{ id: "tee-shirt-rose-griffon-2026::default", qty: 2, slug: "tee-shirt-rose-griffon-2026" }
			];
			mockCookies.get.mockReturnValue({ value: encodeURIComponent(JSON.stringify(initialItems)) });

			const cart = await getCart();
			expect(cart.items.length).toBe(1);
			const firstItem = cart.items[0]!;
			expect(firstItem.slug).toBe("tee-shirt-rose-griffon-2026");
			expect(firstItem.qty).toBe(2);
			expect(cart.itemCount).toBe(2);
		});

		it("should add a product to cookie cart", async () => {
			await addToCart("tee-shirt-rose-griffon-2026", undefined, 1);
			expect(mockCookies.set).toHaveBeenCalled();
			const [, value] = mockCookies.set.mock.calls[0];
			const saved = JSON.parse(decodeURIComponent(value));
			expect(saved[0].slug).toBe("tee-shirt-rose-griffon-2026");
			expect(saved[0].qty).toBe(1);
		});

		it("should update product quantity in cookie cart", async () => {
			const initialItems = [
				{ id: "tee-shirt-rose-griffon-2026::default", qty: 2, slug: "tee-shirt-rose-griffon-2026" }
			];
			mockCookies.get.mockReturnValue({ value: encodeURIComponent(JSON.stringify(initialItems)) });

			await updateQty("tee-shirt-rose-griffon-2026::default", 5);
			expect(mockCookies.set).toHaveBeenCalled();
			const [, value] = mockCookies.set.mock.calls[0];
			const saved = JSON.parse(decodeURIComponent(value));
			expect(saved[0].qty).toBe(5);
		});

		it("should remove product from cookie cart", async () => {
			const initialItems = [
				{ id: "tee-shirt-rose-griffon-2026::default", qty: 2, slug: "tee-shirt-rose-griffon-2026" }
			];
			mockCookies.get.mockReturnValue({ value: encodeURIComponent(JSON.stringify(initialItems)) });

			await removeFromCart("tee-shirt-rose-griffon-2026::default");
			expect(mockCookies.delete).toHaveBeenCalledWith("rg_cart");
		});

		it("should clear cookie cart", async () => {
			await clearCart();
			expect(mockCookies.delete).toHaveBeenCalled();
		});
	});

	describe("Authenticated user (Redis-based cart & merging)", () => {
		const mockUser = { id: "user_123", email: "test@rosegriffon.fr" } as any;

		beforeEach(() => {
			vi.mocked(getServerUser).mockResolvedValue(mockUser);
		});

		it("should return empty cart when Redis cache is empty", async () => {
			const cart = await getCart();
			expect(cart.items).toEqual([]);
			expect(vi.mocked(redisCache.get)).toHaveBeenCalledWith("cart:user_123");
		});

		it("should retrieve items from Redis cache when authenticated", async () => {
			const redisItems = [
				{ id: "tee-shirt-rose-griffon-2026::default", qty: 3, slug: "tee-shirt-rose-griffon-2026" }
			];
			vi.mocked(redisCache.get).mockResolvedValue(redisItems);

			const cart = await getCart();
			expect(cart.items.length).toBe(1);
			expect(cart.items[0]!.qty).toBe(3);
		});

		it("should merge cookie cart items into Redis cart when logging in", async () => {
			// Simule des items existants dans le cache Redis
			const redisItems = [
				{ id: "tee-shirt-rose-griffon-2026::default", qty: 1, slug: "tee-shirt-rose-griffon-2026" }
			];
			vi.mocked(redisCache.get).mockResolvedValue(redisItems);

			// Simule des items dans le cookie (avant authentification complète)
			const cookieItems = [
				{ id: "tee-shirt-rose-griffon-2026::default", qty: 2, slug: "tee-shirt-rose-griffon-2026" },
				{ id: "pack-personnage-destin-billows::solstice", qty: 1, slug: "pack-personnage-destin-billows", variantId: "solstice" }
			];
			mockCookies.get.mockReturnValue({ value: encodeURIComponent(JSON.stringify(cookieItems)) });

			// Appeler getCart() devrait déclencher la fusion
			const cart = await getCart();

			// Vérifie que les paniers ont été fusionnés
			// 1 tee-shirt (Redis) + 2 tee-shirts (Cookie) = 3 tee-shirts
			const teeShirt = cart.items.find(i => i.slug === "tee-shirt-rose-griffon-2026");
			expect(teeShirt?.qty).toBe(3);

			// Le pack personnage a également été ajouté
			const pack = cart.items.find(i => i.slug === "pack-personnage-destin-billows");
			expect(pack?.qty).toBe(1);

			// Le cache Redis doit être mis à jour avec le panier fusionné
			expect(redisCache.set).toHaveBeenCalled();

			// Le cookie doit être nettoyé
			expect(mockCookies.delete).toHaveBeenCalled();
		});

		it("should add a product directly to Redis when authenticated", async () => {
			await addToCart("tee-shirt-rose-griffon-2026", undefined, 2);
			expect(redisCache.set).toHaveBeenCalled();
			const calls = vi.mocked(redisCache.set).mock.calls;
			expect(calls.length).toBeGreaterThan(0);
			const call = calls[0]!;
			const key = call[0];
			const savedItems = call[1];
			expect(key).toBe("cart:user_123");
			expect((savedItems as any)[0].slug).toBe("tee-shirt-rose-griffon-2026");
			expect((savedItems as any)[0].qty).toBe(2);
		});

		it("should clear Redis cart on clearCart", async () => {
			await clearCart();
			expect(redisCache.del).toHaveBeenCalledWith("cart:user_123");
		});
	});
});
