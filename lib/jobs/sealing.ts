import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

import type { JobPayload } from "./queue";

/**
 * Email bodies can contain magic-link and invitation tokens. They must never
 * be stored in PostgreSQL in plaintext while a job waits for delivery or a
 * manual retry. This module seals the sensitive part of an `email.send`
 * payload with AES-256-GCM and keeps only non-secret routing metadata visible
 * for filtering and the Owner retry UI.
 *
 * Invitation tokens themselves are already persisted only as hashes; this
 * protects the copy that necessarily travels through the email job queue.
 */

const KEY_SALT = "summercup:email-job-payload";
const KEY_INFO = "summercup:email-job-payload:v1";
const AAD = "summercup:email-job-payload:v1";
const SEAL_ALGORITHM = "aes-256-gcm";
const SEAL_VERSION = 1;

/**
 * Local development fallback only. Production deployments must provide
 * AUTH_SECRET; without it sealing fails closed before a job can be queued.
 */
const LOCAL_DEVELOPMENT_FALLBACK_SECRET =
  "summercup-local-development-only-secret";

const PUBLIC_EMAIL_PAYLOAD_KEYS = new Set([
  "to",
  "eventId",
  "invitationId",
  "purpose",
  "subject",
]);

export const GENERIC_EMAIL_JOB_ERROR =
  "Email delivery failed. Check the local SMTP server and retry.";

type SealedEnvelope = {
  v: typeof SEAL_VERSION;
  alg: typeof SEAL_ALGORITHM;
  iv: string;
  tag: string;
  ciphertext: string;
};

function sealingSecret() {
  const configured = process.env.AUTH_SECRET?.trim();
  if (configured) {
    return configured;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required to seal email job payloads.");
  }

  return LOCAL_DEVELOPMENT_FALLBACK_SECRET;
}

function sealingKey() {
  const derived = hkdfSync(
    "sha256",
    Buffer.from(sealingSecret(), "utf8"),
    Buffer.from(KEY_SALT, "utf8"),
    Buffer.from(KEY_INFO, "utf8"),
    32,
  );

  return Buffer.from(derived);
}

function isSealedEnvelope(value: unknown): value is SealedEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    candidate.v === SEAL_VERSION &&
    candidate.alg === SEAL_ALGORITHM &&
    typeof candidate.iv === "string" &&
    typeof candidate.tag === "string" &&
    typeof candidate.ciphertext === "string"
  );
}

function encryptSensitivePayload(payload: JobPayload): SealedEnvelope {
  const iv = randomBytes(12);
  const cipher = createCipheriv(SEAL_ALGORITHM, sealingKey(), iv);
  cipher.setAAD(Buffer.from(AAD, "utf8"));

  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);

  return {
    v: SEAL_VERSION,
    alg: SEAL_ALGORITHM,
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
  };
}

function decryptSensitivePayload(envelope: SealedEnvelope): JobPayload {
  const decipher = createDecipheriv(
    SEAL_ALGORITHM,
    sealingKey(),
    Buffer.from(envelope.iv, "base64url"),
  );
  decipher.setAAD(Buffer.from(AAD, "utf8"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");

  const parsed: unknown = JSON.parse(plaintext);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid sealed email payload.");
  }

  return parsed as JobPayload;
}

/**
 * Splits an email payload into plaintext routing metadata and a sealed
 * envelope containing the body and any URL-bearing fields.
 */
export function sealEmailPayload(payload: JobPayload): JobPayload {
  if (isSealedEnvelope(payload.sealed)) {
    return payload;
  }

  const publicPayload: JobPayload = {};
  const sensitivePayload: JobPayload = {};

  for (const [key, value] of Object.entries(payload)) {
    if (PUBLIC_EMAIL_PAYLOAD_KEYS.has(key)) {
      publicPayload[key] = value;
    } else {
      sensitivePayload[key] = value;
    }
  }

  if (!Object.keys(sensitivePayload).length) {
    return publicPayload;
  }

  return {
    ...publicPayload,
    sealed: encryptSensitivePayload(sensitivePayload),
  };
}

/**
 * Returns a processable payload. Legacy jobs created before sealing (plain
 * `text`/`html`) pass through unchanged. A malformed or tampered envelope
 * fails with a generic error so ciphertext or crypto details never reach logs.
 */
export function hydrateEmailPayload(payload: JobPayload): JobPayload {
  if (!("sealed" in payload)) {
    return payload;
  }

  const envelope = payload.sealed;
  if (!isSealedEnvelope(envelope)) {
    throw new Error(GENERIC_EMAIL_JOB_ERROR);
  }

  try {
    const { sealed: _sealed, ...metadata } = payload;
    return {
      ...metadata,
      ...decryptSensitivePayload(envelope),
    };
  } catch {
    throw new Error(GENERIC_EMAIL_JOB_ERROR);
  }
}

export function hydrateEmailJob<T extends { type: string; payload: JobPayload }>(
  job: T,
): T {
  if (job.type !== "email.send") {
    return job;
  }

  return {
    ...job,
    payload: hydrateEmailPayload(job.payload),
  };
}
