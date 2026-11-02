import { createTransport } from "nodemailer";

import type { Job } from "../db/schema";
import type { JobPayload } from "./queue";

export type ProcessableJob = Pick<Job, "id" | "type" | "payload">;

async function sendEmail(payload: JobPayload) {
  const to = typeof payload.to === "string" ? payload.to.trim() : "";
  if (!to || !to.includes("@")) {
    throw new Error("email.send requires a valid recipient.");
  }

  const subject =
    typeof payload.subject === "string"
      ? payload.subject
      : "Summer Cup 2026";
  const text =
    typeof payload.text === "string"
      ? payload.text
      : "Summer Cup 2026 — local demonstration message.";
  const html = typeof payload.html === "string" ? payload.html : undefined;

  const transport = createTransport({
    host: process.env.SMTP_HOST ?? "127.0.0.1",
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: false,
    ignoreTLS: true,
  });

  await transport.sendMail({
    to,
    from: process.env.EMAIL_FROM ?? "Summer Cup <summercup@example.com>",
    subject,
    text,
    html,
  });
}

async function ping() {
  // Intentionally does not log the payload: jobs must never echo secrets.
  return { ok: true };
}

export async function processJob(job: ProcessableJob) {
  switch (job.type) {
    case "email.send":
      return sendEmail(job.payload);
    case "demo.ping":
      return ping();
    case "scoresheet.extract":
      throw new Error(
        "Scoresheet extraction adapter is not connected yet. Use the synchronous seeded fallback in the review flow.",
      );
    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}
