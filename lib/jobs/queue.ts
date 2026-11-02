import {
  and,
  asc,
  eq,
  lte,
  lt,
  or,
  sql,
} from "drizzle-orm";

import { db } from "../db/client";
import { jobs, type Job } from "../db/schema";

export const JOB_LEASE_MS = 2 * 60 * 1000;

export type JobPayload = Record<string, unknown>;

export async function enqueueJob(input: {
  type: string;
  payload: JobPayload;
  availableAt?: Date;
  maxAttempts?: number;
}): Promise<Job> {
  const [job] = await db
    .insert(jobs)
    .values({
      type: input.type,
      payload: input.payload,
      availableAt: input.availableAt ?? new Date(),
      maxAttempts: input.maxAttempts ?? 3,
    })
    .returning();

  if (!job) {
    throw new Error("The job could not be created.");
  }

  return job;
}

export async function claimNextJob(workerId: string): Promise<Job | null> {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - JOB_LEASE_MS);

  return db.transaction(async (tx) => {
    const [candidate] = await tx
      .select()
      .from(jobs)
      .where(
        or(
          and(eq(jobs.status, "pending"), lte(jobs.availableAt, now)),
          and(eq(jobs.status, "processing"), lt(jobs.lockedAt, staleBefore)),
        ),
      )
      .orderBy(asc(jobs.availableAt), asc(jobs.createdAt))
      .limit(1)
      .for("update", { skipLocked: true });

    if (!candidate) {
      return null;
    }

    const [claimed] = await tx
      .update(jobs)
      .set({
        status: "processing",
        attempts: sql`${jobs.attempts} + 1`,
        lockedAt: now,
        lockedBy: workerId,
        updatedAt: now,
      })
      .where(eq(jobs.id, candidate.id))
      .returning();

    return claimed ?? null;
  });
}

export async function completeJob(jobId: string) {
  await db
    .update(jobs)
    .set({
      status: "completed",
      completedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, jobId));
}

export async function failJob(job: Job, error: unknown) {
  const exhausted = job.attempts >= job.maxAttempts;
  const backoffMs = Math.min(job.attempts * 30_000, 5 * 60 * 1000);

  await db
    .update(jobs)
    .set({
      status: exhausted ? "failed" : "pending",
      availableAt: new Date(Date.now() + backoffMs),
      lockedAt: null,
      lockedBy: null,
      lastError:
        error instanceof Error ? error.message.slice(0, 2000) : String(error),
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, job.id));
}

export async function retryJob(jobId: string) {
  const [job] = await db
    .update(jobs)
    .set({
      status: "pending",
      attempts: 0,
      availableAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastError: null,
      completedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, jobId))
    .returning();

  return job ?? null;
}
