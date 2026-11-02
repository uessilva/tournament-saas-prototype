import { createHash } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export type StoredObject = {
  key: string;
  sizeBytes: number;
  checksum: string;
};

export type FileStorage = {
  put: (
    key: string,
    data: Buffer | Uint8Array | string,
  ) => Promise<StoredObject>;
  read: (key: string) => Promise<Buffer>;
  exists: (key: string) => Promise<boolean>;
  delete: (key: string) => Promise<void>;
};

function storageRoot() {
  return path.resolve(process.env.STORAGE_DIR ?? ".storage");
}

function safeKey(key: string) {
  if (!key || key.includes("\0")) {
    throw new Error("A storage key is required.");
  }

  const normalized = key.replaceAll("\\", "/").replace(/^\/+/, "");
  const absolute = path.resolve(storageRoot(), normalized);

  if (
    absolute !== storageRoot() &&
    !absolute.startsWith(`${storageRoot()}${path.sep}`)
  ) {
    throw new Error("Storage key escapes the configured storage directory.");
  }

  return { absolute, normalized };
}

export const localFileStorage: FileStorage = {
  async put(key, data) {
    const { absolute, normalized } = safeKey(key);
    const buffer =
      typeof data === "string" ? Buffer.from(data) : Buffer.from(data);

    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, buffer);

    return {
      key: normalized,
      sizeBytes: buffer.byteLength,
      checksum: createHash("sha256").update(buffer).digest("hex"),
    };
  },

  async read(key) {
    const { absolute } = safeKey(key);
    return readFile(absolute);
  },

  async exists(key) {
    const { absolute } = safeKey(key);
    try {
      await stat(absolute);
      return true;
    } catch {
      return false;
    }
  },

  async delete(key) {
    const { absolute } = safeKey(key);
    await rm(absolute, { force: true });
  },
};

export function scoresheetStorageKey(
  eventId: string,
  matchId: string,
  scoresheetId: string,
  filename = "scoresheet.pdf",
) {
  return path.posix.join(
    "events",
    eventId,
    "matches",
    matchId,
    "scoresheets",
    scoresheetId,
    path.basename(filename),
  );
}
