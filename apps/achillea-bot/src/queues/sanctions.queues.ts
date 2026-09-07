import { Queue } from "bullmq";

import { redisConnection } from "@/configs";

export const sanctionsQueue = new Queue("sanctions", { connection: redisConnection });
