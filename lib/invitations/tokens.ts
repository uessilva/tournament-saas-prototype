import { createHash, randomBytes } from "node:crypto";

export const INVITATION_TTL_DAYS = 7;
export const INVITATION_TTL_MS = INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000;
export const INVITATION_COOKIE = "summercup-invitation";
export const INVITATION_COOKIE_MAX_AGE_SECONDS = 30 * 60;

/**
 * Creates an opaque URL token. Only the SHA-256 hash is persisted; the raw
 * value is returned exactly once to the caller that creates the invitation.
 */
export function createInvitationToken() {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: hashInvitationToken(token),
  };
}

export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function invitationExpiryFrom(
  date = new Date(),
  ttlMs = INVITATION_TTL_MS,
) {
  return new Date(date.getTime() + ttlMs);
}

export function looksLikeInvitationToken(value: string) {
  return /^[A-Za-z0-9_-]{32,128}$/.test(value);
}
