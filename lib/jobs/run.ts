import type { Job } from "../db/schema";
import { processJob } from "./handlers";
import { completeJob, enqueueJob, failJob, type JobPayload } from "./queue";
import { hydrateEmailJob } from "./sealing";

/**
 * Demo fallback: run a job immediately while still recording the same
 * PostgreSQL job row. If it fails, the row remains retryable by the worker.
 */
export async function runJobSynchronously(input: {
  type: string;
  payload: JobPayload;
}): Promise<Job> {
  const job = await enqueueJob(input);

  try {
    await processJob(hydrateEmailJob(job));
    await completeJob(job.id);
    return { ...job, status: "completed", completedAt: new Date() };
  } catch (error) {
    await failJob(job, error);
    throw error;
  }
}
