import { expect, test } from "bun:test";
import { pathToFileURL } from "node:url";

test("Postgres dialect defers configuration until a real query and retains the required URL guard", async () => {
	const child = Bun.spawn({
		cmd: [
			process.execPath,
			"-e",
			`
			import { Kysely } from "kysely";
			import { createPgDialect } from ${JSON.stringify(pathToFileURL(`${import.meta.dir}/pg.ts`).href)};
			delete process.env.DATABASE_URL;
			const db = new Kysely({ dialect: createPgDialect() });
			const query = db.selectFrom("profiles").select("id");
			console.log(query.compile().sql);
			try {
				await query.execute();
				throw new Error("query unexpectedly succeeded without configuration");
			} catch (error) {
				console.log(error.message);
			} finally {
				await db.destroy();
			}
		`,
		],
		cwd: import.meta.dir,
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	expect(stdout.trim()).toBe(
		'select "id" from "profiles"\nDATABASE_URL absent ou corrompu : une chaîne Postgres valide est requise.',
	);
	expect(stderr).toBe("");
	expect(exitCode).toBe(0);
});
