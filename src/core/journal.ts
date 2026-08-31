import { JOURNAL_FILE } from '../types/constants';
import type { JournalEntry } from '../types';
import * as fs from 'fs';

export function appendJournal(entry: JournalEntry) {
  if (!fs.existsSync(JOURNAL_FILE)) {
    throw new Error(
      'Journal file does not exist. Please initialize the repository first.',
    );
  }

  fs.appendFileSync(JOURNAL_FILE, JSON.stringify(entry) + '\n');
}
export function readJournal(): JournalEntry[] {
  if (!fs.existsSync(JOURNAL_FILE)) return [];
  return fs
    .readFileSync(JOURNAL_FILE, 'utf-8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as JournalEntry);
}

export function resolveFileState(
  filepath: string,
  target: number = Date.now(),
): JournalEntry | null {
  const entires = readJournal();
  let latestMatch: JournalEntry | null = null;

  for (const entry of entires) {
    if (entry.filepath === filepath && entry.timestamp <= target) {
      latestMatch = entry;
    }
  }
  return latestMatch;
}
