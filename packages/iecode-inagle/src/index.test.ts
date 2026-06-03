import { expect, test } from "bun:test";
import { getInagle } from "./index";

test("getInagle charge le vrai service inagle (données jeu réelles)", async () => {
	const inagle = await getInagle();
	expect(inagle.characters.all().length).toBeGreaterThan(1000);
	expect(inagle.skills.all().length).toBeGreaterThan(1000);
	expect(inagle.items.allItems().length).toBeGreaterThan(1000);
});

test("getInagle est mémoïsé (même instance)", async () => {
	expect(await getInagle()).toBe(await getInagle());
});
