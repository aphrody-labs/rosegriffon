import fs from "node:fs";

import type { EntityName, Options } from "@mikro-orm/postgresql";
import { MikroORM } from "@mikro-orm/postgresql";
import fastFolderSizeSync from "fast-folder-size/sync";
import { backup, restore } from "saveqlite";
import { delay, inject } from "tsyringe";

import { databaseConfig, mikroORMConfig } from "@/configs";
import { Schedule, Service } from "@/decorators";
import * as entities from "@/entities";
import { env } from "@/env";
import { Logger } from "./Logger";
import { PluginsManager } from "./PluginsManager";
import { Store } from "./Store";
import { resolveDependency } from "../utils/functions/dependency";
import { AuditLogSubscriber } from "./AuditLogSubscriber";

@Service()
export class Database {
	// InstanceType<typeof MikroORM> = PostgreSqlMikroORM avec ses paramètres par défaut
	private _orm!: InstanceType<typeof MikroORM>;

	constructor(
		@inject(delay(() => Store)) private store: any,
		@inject(delay(() => Logger)) private logger: any
	) {}

	async initialize() {
		const pluginsManager = await resolveDependency(PluginsManager);

		// get config
		const config = mikroORMConfig[env.NODE_ENV || "development"] as Options;

		// defines entities into the config
		config.entities = [...Object.values(entities), ...pluginsManager.getEntities()];

		// Register audit log subscriber for automatic event tracking
		const existingSubs = config.subscribers ? Array.from(config.subscribers) : [];
		config.subscribers = [...existingSubs, new AuditLogSubscriber()];

		// initialize the ORM using the configuration exported in `mikro-orm.config.ts`
		// Double instance de @mikro-orm/sql dans la résolution bun : cast de config nécessaire
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		this._orm = (await MikroORM.init(config as any)) as unknown as InstanceType<typeof MikroORM>;

		// Le schéma n'est jamais modifié au démarrage. Les migrations sont exécutées
		// explicitement via `migration:up:prod` pendant la procédure de déploiement.
	}

	async refreshConnection() {
		await this._orm.close();
		// Recharger la config courante pour réinitialiser la connexion
		const config = mikroORMConfig[env.NODE_ENV || "development"] as Options;
		// Double instance de @mikro-orm/sql dans la résolution bun : cast de config nécessaire
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		this._orm = (await MikroORM.init(config as any)) as unknown as InstanceType<typeof MikroORM>;
	}

	get orm(): typeof this._orm {
		return this._orm;
	}

	get em(): DatabaseEntityManager {
		// cast : deux instances de @mikro-orm/sql dans la résolution bun (artefact structurel)
		return this._orm.em as unknown as DatabaseEntityManager;
	}

	async close(): Promise<void> {
		if (this._orm) await this._orm.close();
	}

	/**
	 * Shorthand to get custom and natives repositories
	 * @param entity Entity of the custom repository to get
	 */
	get<T extends object>(entity: EntityName<T>) {
		return this._orm.em.getRepository(entity);
	}

	/**
	 * Create a snapshot of the database each day at 00:00
	 */
	@Schedule("0 0 * * *")
	async backup(snapshotName?: string): Promise<boolean> {
		const { formatDate } = await import("@/utils/functions");

		if (!databaseConfig.backup.enabled && !snapshotName) return false;
		if (!this.isSQLiteDatabase()) {
			this.logger.log("Database is not SQLite, couldn't backup");

			return false;
		}

		const backupPath = databaseConfig.backup.path;
		if (!backupPath) {
			this.logger.log("Backup path not set, couldn't backup", "error", true);

			return false;
		}

		if (!snapshotName) snapshotName = `snapshot-${formatDate(new Date(), "onlyDateFileName")}`;
		const objectsPath = `${backupPath}objects/` as `${string}/`;

		try {
			await backup(mikroORMConfig[env.NODE_ENV]!.dbName!, `${snapshotName}.txt`, objectsPath);

			return true;
		} catch (e) {
			const errorMessage =
				typeof e === "string" ? e : e instanceof Error ? e.message : "Unknown error";

			this.logger.log(`Couldn't backup : ${errorMessage}`, "error", true);

			return false;
		}
	}

	/**
	 * Restore the SQLite database from a snapshot file.
	 * @param snapshotName name of the snapshot to restore
	 * @returns true if the snapshot has been restored, false otherwise
	 */
	async restore(snapshotName: string): Promise<boolean> {
		if (!this.isSQLiteDatabase()) {
			this.logger.log("Database is not SQLite, couldn't restore", "error");

			return false;
		}

		const backupPath = databaseConfig.backup.path;
		if (!backupPath) this.logger.log("Backup path not set, couldn't restore", "error", true);

		try {
			console.info(mikroORMConfig[env.NODE_ENV]!.dbName!);
			console.info(`${backupPath}${snapshotName}`);
			await restore(mikroORMConfig[env.NODE_ENV]!.dbName!, `${backupPath}${snapshotName}`);

			await this.refreshConnection();

			return true;
		} catch (error) {
			console.error(error);
			this.logger.log("Snapshot file not found, couldn't restore", "error", true);

			return false;
		}
	}

	getBackupList(): string[] | null {
		const backupPath = databaseConfig.backup.path;
		if (!backupPath) {
			this.logger.log("Backup path not set, couldn't get list of backups", "error");

			return null;
		}

		const files = fs.readdirSync(backupPath);
		const backupList = files.filter((file) => file.startsWith("snapshot"));

		return backupList;
	}

	getSize(): DatabaseSize {
		const size: DatabaseSize = {
			db: null,
			backups: null,
		};

		if (this.isSQLiteDatabase()) {
			const dbPath = mikroORMConfig[env.NODE_ENV]!.dbName!;
			const dbSize = fs.statSync(dbPath).size;

			size.db = dbSize;
		}

		const backupPath = databaseConfig.backup.path;
		if (backupPath) {
			const backupSize = fastFolderSizeSync(backupPath);

			size.backups = backupSize || null;
		}

		return size;
	}

	isSQLiteDatabase(): boolean {
		const config = mikroORMConfig[env.NODE_ENV];

		return !!config.dbName && !config.port;
	}
}
