import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import {
  appendJournal,
  readJournal,
  resolveFileState,
  createEntry,
} from '../../../src/core/journal';
import { JOURNAL_FILE } from '../../../src/types/constants';

const TEST_DIR = '/tmp/ghost-test-journal-vitest';

// Valid chunk hashes are 64-hex strings (enforced by createEntry)
const H1 = 'a'.repeat(64);
const H2 = 'b'.repeat(64);

describe('journal module', () => {
  beforeEach(async () => {
    await fsp.rm(TEST_DIR, { recursive: true, force: true });
    await fsp.mkdir(TEST_DIR, { recursive: true });
    process.chdir(TEST_DIR);
    await fsp.mkdir('.ghost', { recursive: true });
    await fsp.writeFile(JOURNAL_FILE, '');
  });

  afterEach(async () => {
    await fsp.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('appendJournal', () => {
    it('appends entry to journal file', () => {
      const entry = createEntry({
        filepath: 'test.txt',
        chunks: [H1],
        size: 100,
        isDeleted: false,
      });
      appendJournal(entry);
      const content = fs.readFileSync(JOURNAL_FILE, 'utf-8');
      expect(content).toContain('test.txt');
      expect(content).toContain(H1);
    });

    it('throws if journal file does not exist', () => {
      fs.rmSync(JOURNAL_FILE);
      const entry = createEntry({ filepath: 'test.txt', chunks: [], size: 0, isDeleted: false });
      expect(() => appendJournal(entry)).toThrow('Journal file does not exist');
    });

    it('each entry on new line', () => {
      appendJournal(createEntry({ filepath: 'a.txt', chunks: [H1], size: 1, isDeleted: false }));
      appendJournal(createEntry({ filepath: 'b.txt', chunks: [H2], size: 2, isDeleted: false }));
      const lines = fs.readFileSync(JOURNAL_FILE, 'utf-8').trim().split('\n');
      expect(lines.length).toBe(2);
    });
  });

  describe('readJournal', () => {
    it('returns empty array for empty journal', () => {
      expect(readJournal()).toEqual([]);
    });

    it('returns empty array when journal file is missing', () => {
      fs.rmSync(JOURNAL_FILE);
      expect(readJournal()).toEqual([]);
    });

    it('parses all entries', () => {
      appendJournal(createEntry({ filepath: 'a.txt', chunks: [H1], size: 1, isDeleted: false }));
      appendJournal(createEntry({ filepath: 'b.txt', chunks: [H2], size: 2, isDeleted: true }));
      const entries = readJournal();
      expect(entries.length).toBe(2);
      expect(entries[0]!.filepath.toString()).toBe('a.txt');
      expect(entries[1]!.isDeleted).toBe(true);
    });

    it('preserves branded types', () => {
      appendJournal(
        createEntry({ filepath: 'test.txt', chunks: [H1], size: 10, isDeleted: false })
      );
      expect(readJournal()[0]).toHaveProperty('__brand', 'JournalEntry');
    });
  });

  describe('resolveFileState', () => {
    beforeEach(async () => {
      appendJournal(
        createEntry({ filepath: 'file.txt', chunks: [H1], size: 10, isDeleted: false })
      );
      await new Promise(r => setTimeout(r, 3));
      appendJournal(
        createEntry({ filepath: 'file.txt', chunks: [H2], size: 20, isDeleted: false })
      );
      await new Promise(r => setTimeout(r, 3));
      appendJournal(createEntry({ filepath: 'file.txt', chunks: [], size: 0, isDeleted: true }));
    });

    it('returns latest entry by default', () => {
      const entry = resolveFileState('file.txt');
      expect(entry).not.toBeNull();
      expect(entry!.isDeleted).toBe(true);
    });

    it('returns entry at specific timestamp', () => {
      const second = readJournal()[1]!;
      const entry = resolveFileState('file.txt', Number(second.timestamp));
      expect(entry).not.toBeNull();
      expect(entry!.chunks.map(String)).toEqual([H2]);
    });

    it('returns null for non-existent file', () => {
      expect(resolveFileState('nonexistent.txt')).toBeNull();
    });

    it('ignores entries after target time', () => {
      const first = readJournal()[0]!;
      expect(resolveFileState('file.txt', Number(first.timestamp) - 1)).toBeNull();
    });
  });

  describe('createEntry', () => {
    it('creates valid JournalEntry', () => {
      const entry = createEntry({
        filepath: 'test.txt',
        chunks: [H1, H2],
        size: 8192,
        isDeleted: false,
      });
      expect(entry.__brand).toBe('JournalEntry');
      expect(entry.filepath.toString()).toBe('test.txt');
      expect(entry.chunks.map(String)).toEqual([H1, H2]);
      expect(Number(entry.size)).toBe(8192);
      expect(entry.isDeleted).toBe(false);
    });

    it('creates deleted entry', () => {
      const entry = createEntry({ filepath: 'deleted.txt', chunks: [], size: 0, isDeleted: true });
      expect(entry.isDeleted).toBe(true);
      expect(entry.chunks.length).toBe(0);
    });

    it('rejects invalid chunk hashes', () => {
      expect(() =>
        createEntry({ filepath: 'bad.txt', chunks: ['not-a-hash'], size: 1, isDeleted: false })
      ).toThrow(/Invalid ChunkHash/);
    });
  });
});
