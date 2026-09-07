import type { RedisOptions } from "ioredis";

import { env } from "@/env";

// Host/port surchargeables via env (REDIS_HOST/REDIS_PORT) — ex. "redis" en Docker.
const REDIS_HOST = process.env.REDIS_HOST ?? "127.0.0.1";
const REDIS_PORT = Number(process.env.REDIS_PORT ?? 6379);

const redisConnectionTest: RedisOptions = {
	host: REDIS_HOST,
	port: REDIS_PORT,
	maxRetriesPerRequest: null,
	db: 1,
};

const redisConnectionProd: RedisOptions = {
	host: REDIS_HOST,
	port: REDIS_PORT,
	maxRetriesPerRequest: null,
	db: 0,
};

export const redisConnection = env.isDev ? redisConnectionTest : redisConnectionProd;
