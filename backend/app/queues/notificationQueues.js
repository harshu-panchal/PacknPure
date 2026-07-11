import Bull from "bull";
import {
  createBullRedisClient,
  getRedisOptionsForBull,
  isRedisEnabled,
} from "../config/redis.js";

const redisOpts = getRedisOptionsForBull();

const notificationQueueSettings = {
  stalledInterval: 30000,
  maxStalledCount: 3,
  lockDuration: 30000,
};

function createNoopQueue() {
  return {
    add: async () => ({}),
    addBulk: async () => [],
    getJob: async () => null,
    process: () => {},
    on: () => {},
    close: async () => {},
  };
}

export const notificationQueue = isRedisEnabled()
  ? new Bull("notification-delivery", {
      redis: redisOpts,
      createClient: createBullRedisClient,
      settings: notificationQueueSettings,
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: 1000,
        removeOnFail: false,
      },
      limiter: {
        max: parseInt(process.env.NOTIFICATION_QUEUE_RATE_LIMIT || "100", 10),
        duration: 1000,
      },
    })
  : createNoopQueue();

export const enqueueNotificationJobs = async (jobs = []) => {
  if (!Array.isArray(jobs) || jobs.length === 0) return [];
  if (typeof notificationQueue.addBulk === "function") {
    const bulkJobs = jobs.map((job) => ({
      name: "deliver-notification",
      data: job,
      opts: {
        priority: Number(job.priority || 0),
        jobId: job.jobId || `${job.outboxId || job.eventId || Date.now()}-${job.recipient || "recipient"}`,
      },
    }));
    return notificationQueue.addBulk(bulkJobs);
  }

  const results = [];
  for (const job of jobs) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await notificationQueue.add("deliver-notification", job, {
      priority: Number(job.priority || 0),
      jobId: job.jobId || `${job.outboxId || job.eventId || Date.now()}-${job.recipient || "recipient"}`,
    }));
  }
  return results;
};

export const getNotificationJobById = async (jobId) => {
  if (!jobId) return null;
  return notificationQueue.getJob(jobId);
};

