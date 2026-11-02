import { completeJob, enqueueJob, failJob, type JobPayload } from "./queue";
import { processJob } from "./handlers";

const EMAIL_FAILURE_MESSAGE =
  "Email delivery failed. Check the local SMTP server and retry.";

/**
 * Sends an email through the same persisted job model as extraction. The
 * synchronous fallback keeps the demo independent of a running worker, but a
 * delivery failure is still recorded as a visible, manually retryable job.
 */
export async function runEmailJob(
  payload: JobPayload,
  options: { throwOnError?: boolean } = {},
) {
  const job = await enqueueJob({
    type: "email.send",
    payload,
    maxAttempts: 1,
  });

  try {
    await processJob(job);
    await completeJob(job.id);
    return { ok: true as const, jobId: job.id };
  } catch {
    // Never persist or surface the raw payload: email bodies contain magic
    // links and invitation tokens.
    await failJob(job, new Error(EMAIL_FAILURE_MESSAGE), {
      forceFailed: true,
      recordAttempt: true,
    });
    if (options.throwOnError) {
      throw new Error(EMAIL_FAILURE_MESSAGE);
    }
    return { ok: false as const, jobId: job.id };
  }
}
