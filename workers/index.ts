import "dotenv/config";

import { hostname } from "node:os";

import { sqlClient } from "../lib/db/client";
import { processJob } from "../lib/jobs/handlers";
import { claimNextJob, completeJob, failJob } from "../lib/jobs/queue";

const workerId = `summercup-${hostname()}-${process.pid}`;
const POLL_INTERVAL_MS = 1_000;

let running = true;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log(`[worker] ${workerId} waiting for Summer Cup jobs.`);

  while (running) {
    let job = null;

    try {
      job = await claimNextJob(workerId);
    } catch (error) {
      console.error(
        "[worker] could not claim a job:",
        error instanceof Error ? error.message : error,
      );
      await sleep(5_000);
      continue;
    }

    if (!job) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    try {
      await processJob(job);
      await completeJob(job.id);
      console.log(`[worker] completed ${job.type} (${job.id}).`);
    } catch (error) {
      await failJob(job, error);
      console.error(
        `[worker] failed ${job.type} (${job.id}):`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  console.log("[worker] stopping.");
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    running = false;
  });
}

main()
  .catch((error) => {
    console.error(
      "[worker] fatal error:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await sqlClient.end({ timeout: 5 });
  });
