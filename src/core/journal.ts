import * as fs from "fs";
import { JOURNAL_FILE } from "../types/constants";
import type { JournalEntry, FileId, Timestamp, ChunkHash, ByteSize } from "../types";
import { createJournalEntry, isFileId } from "../types";

/**
 * Append a journal entry to the log file
 */
export function appendJournal(entry: JournalEntry): void {
  if (!fs.existsSync(JOURNAL_FILE)) {
    throw new Error(
      "Journal file does not exist. Please initialize the repository first."
    );
  }
  fs.appendFileSync(JOURNAL_FILE, JSON.stringify(entry) + "\n");
}

/**
 * Read all journal entries from the log file
 */
export function readJournal(): JournalEntry[] {
  if (!fs.existsSync(JOURNAL_FILE)) return [];
  return fs
    .readFileSync(JOURNAL_FILE, "utf-8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const parsed = JSON.parse(line);
      // Ensure branded types are preserved
      return {
        ...parsed,
        filepath: parsed.filepath as FileId,
        chunks: parsed.chunks as readonly ChunkHash[],
        timestamp: parsed.timestamp as Timestamp,
        size: parsed.size as ByteSize,
      } satisfies JournalEntry;
    });
}

/**
 * Resolve the file state at a specific point in time
 * @param filepath - File identifier
 * @param target - Target timestamp (defaults to now)
 * @returns Latest matching entry or null
 */
export function resolveFileState(
  filepath: string,
  target: number = Date.now(),
): JournalEntry | null {
  const entries = readJournal();
  let latestMatch: JournalEntry | null = null;

  for (const entry of entries) {
    if (entry.filepath === filepath && entry.timestamp <= target) {
      latestMatch = entry;
    }
  }
  return latestMatch;
}

/**
 * Create a new journal entry with type validation
 */
export function createEntry(params: {
  filepath: string;
  chunks: string[];
  size: number;
  isDeleted: boolean;
}): JournalEntry {
  return createJournalEntry({
    timestamp: Date.now(),
    ...params,
  });
}