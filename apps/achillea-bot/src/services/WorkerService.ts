import type { Job } from "bullmq";
import { Queue, Worker } from "bullmq";
import { Client } from "@aphrody/discordx";

import { redisConnection } from "@/configs";
import { Service } from "@/decorators";

import { ClanJobs } from "../jobs/ClanJobs";
import { SanctionJobs } from "../jobs/SanctionJobs";
import { runInRequestContext } from "../utils/functions/dependency";
import { Database } from "./Database";

@Service()
export class WorkerService {
	private queues = new Map<string, Queue>();
	private workers: Worker[] = [];

	constructor(
		private db: Database,
		private client: Client
	) {}

	async init() {
		// 🧱 Initialize queues
		this.queues.set("main", new Queue("main", { connection: redisConnection }));
		this.queues.set("clan", new Queue("clan", { connection: redisConnection }));
		this.queues.set("sanctions", new Queue("sanctions", { connection: redisConnection }));

		// 🧩 Register job processors
		const clanJobs = new ClanJobs(this.db, this.client);
		const sanctionJobs = new SanctionJobs(this.db, this.client);

		// Les processeurs BullMQ se déclenchent sur un pull Redis, HORS du pipeline
		// discordx → aucun RequestContext actif. On enrobe chaque job dans un fork de
		// contexte (sinon `db.em`/`db.get()` des jobs retombent sur l'EM global, refusé
		// par MikroORM v7 — cf. ClanJobs → disbandClan).
		// MAIN QUEUE worker
		const mainWorker = new Worker(
			"main",
			(job: Job) =>
				runInRequestContext(this.db, async () => {
					switch (job.name) {
						case "checkClanMemberCount":
							return clanJobs.checkClanMemberCount(job);

						default:
							console.warn(`⚠️ Unknown job on main queue: ${job.name}`);
					}
				}),
			{ connection: redisConnection }
		);

		// CLAN QUEUE worker
		const clanWorker = new Worker(
			"clan",
			(job: Job) =>
				runInRequestContext(this.db, async () => {
					if (job.name === "checkClanMemberCount") {
						return clanJobs.checkClanMemberCount(job);
					} else {
						console.warn(`⚠️ Unknown job on clan queue: ${job.name}`);
					}
				}),
			{ connection: redisConnection }
		);

		// SANCTIONS QUEUE worker
		const sanctionsWorker = new Worker(
			"sanctions",
			(job: Job) =>
				runInRequestContext(this.db, async () => {
					if (job.name === "revoke") {
						return sanctionJobs.revoke(job);
					} else {
						console.warn(`⚠️ Unknown job on sanctions queue: ${job.name}`);
					}
				}),
			{ connection: redisConnection }
		);

		// Event listeners (optional but strongly recommended)
		const logWorkerEvents = (workerName: string, worker: Worker) => {
			worker.on("ready", () => console.info(`🧱 ${workerName} ready`));
			worker.on("active", (job) =>
				console.info(`⚙️ ${workerName}: Job ${job.id} (${job.name}) started`)
			);
			worker.on("completed", (job) => console.info(`✅ ${workerName}: Job ${job.id} completed`));
			worker.on("failed", (job, err) =>
				console.error(`❌ ${workerName}: Job ${job?.id} failed`, err)
			);
		};

		logWorkerEvents("MainWorker", mainWorker);
		logWorkerEvents("ClanWorker", clanWorker);
		logWorkerEvents("SanctionsWorker", sanctionsWorker);

		this.workers.push(mainWorker, clanWorker, sanctionsWorker);

		console.info("🧱 WorkerService ready");
	}

	// ✨ Helper for adding jobs (so you don’t touch BullMQ directly elsewhere)
	async addJob(queueName: string, name: string, data: any, opts: any = {}) {
		const queue = this.queues.get(queueName);
		if (!queue) throw new Error(`Queue ${queueName} not initialized`);
		await queue.add(name, data, opts);
	}

	async close(): Promise<void> {
		await Promise.allSettled(this.workers.map((worker) => worker.close()));
		await Promise.allSettled([...this.queues.values()].map((queue) => queue.close()));
		this.workers = [];
		this.queues.clear();
	}
}
