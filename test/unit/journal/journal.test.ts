import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import {
  appendJournal,
  readJournal,
  resolveFileState,
  createEntry,
} from '../../../src/core/journal';
import { JOURNAL_FILE } from '../../../src/types/constants';

const TEST_DIR = '/tmp/ghost-test-journal';

describe('journal module', () => {
  beforeEach(async () => {
    await fsp.rm(TEST_DIR, { recursive: true, force: true });
    await fsp.mkdir(TEST_DIR, { recursive: true });
    process.chdir(TEST_DIR);
    // Create journal file
    await fsp.writeFile(JOURNAL_FILE, '');
  });

  afterEach(async () => {
    await fsp.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('appendJournal', () => {
    it('appends entry to journal file', () => {
      const entry = createEntry({
        filepath: 'test.txt',
        chunks: ['abc123'],
        size: 100,
        isDeleted: false,
      });
      appendJournal(entry);
      const content = fs.readFileSync(JOURNAL_FILE, 'utf-8');
      expect(content).toContain('test.txt');
      expect(content).toContain('abc123');
    });

    it('throws if journal file does not exist', () => {
      fs.rmSync(JOURNAL_FILE);
      const entry = createEntry({
        filepath: 'test.txt',
        chunks: [],
        size: 0,
        isDeleted: false,
      });
      expect(() => appendJournal(entry)).toThrow('Journal file does not exist');
    });

    it('each entry on new line', () => {
      const entry1 = createEntry({ filepath: 'a.txt', chunks: ['1'], size: 1, isDeleted: false });
      const entry2 = createEntry({ filepath: 'b.txt', chunks: ['2'], size: 2, isDeleted: false });
      appendJournal(entry1);
      appendJournal(entry2);
      const lines = fs.readFileSync(JOURNAL_FILE, 'utf-8').trim().split('\n');
      expect(lines.length).toBe(2);
    });
  });

  describe('readJournal', () => {
    it('returns empty array for empty journal', () => {
      const entries = readJournal();
      expect(entries).toEqual([]);
    });

    it('parses all entries', () => {
      const entry1 = createEntry({ filepath: 'a.txt', chunks: ['1'], size: 1, isDeleted: false });
      const entry2 = createEntry({ filepath: 'b.txt', chunks: ['2'], size: 2, isDeleted: true });
      appendJournal(entry1);
      appendJournal(entry2);
      const entries = readJournal();
      expect(entries.length).toBe(2);
      const first = entries[0];
      const second = entries[1];
      expect(first).toBeDefined();
      expect(second).toBeDefined();
      expect(first!.filepath.toString()).toBe('a.txt');
      expect(second!.isDeleted).toBe(true);
    });

    it('preserves branded types', () => {
      const entry = createEntry({
        filepath: 'test.txt',
        chunks: ['abc'],
        size: 10,
        isDeleted: false,
      });
      appendJournal(entry);
      const entries = readJournal();
      expect(entries[0]).toHaveProperty('__brand', 'JournalEntry');
    });
  });

  describe('resolveFileState', () => {
    beforeEach(() => {
      // Write entries at different times
      const entry1 = createEntry({
        filepath: 'file.txt',
        chunks: ['v1'],
        size: 10,
        isDeleted: false,
      });
      appendJournal(entry1);
      const entry2 = createEntry({
        filepath: 'file.txt',
        chunks: ['v2'],
        size: 20,
        isDeleted: false,
      });
      appendJournal(entry2);
      const entry3 = createEntry({ filepath: 'file.txt', chunks: [], size: 0, isDeleted: true });
      appendJournal(entry3);
    });

    it('returns latest entry by default', () => {
      const entry = resolveFileState('file.txt');
      expect(entry).not.toBeNull();
      expect(entry!.isDeleted).toBe(true);
    });

    it('returns entry at specific timestamp', () => {
      const entries = readJournal();
      const second = entries[1];
      expect(second).toBeDefined();
      const midTime = Number(second!.timestamp);
      const entry = resolveFileState('file.txt', midTime);
      expect(entry).not.toBeNull();
      expect(entry!.chunks.map(String)).toEqual(['v2']);
    });

    it('returns null for non-existent file', () => {
      const entry = resolveFileState('nonexistent.txt');
      expect(entry).toBeNull();
    });

    it('ignores entries after target time', () => {
      const entries = readJournal();
      const first = entries[0];
      expect(first).toBeDefined();
      const earlyTime = Number(first!.timestamp) - 1;
      const entry = resolveFileState('file.txt', earlyTime);
      expect(entry).toBeNull();
    });
  });

  describe('createEntry', () => {
    it('creates valid JournalEntry with satisfies', () => {
      const entry = createEntry({
        filepath: 'test.txt',
        chunks: ['hash1', 'hash2'],
        size: 8192,
        isDeleted: false,
      });
      expect(entry.__brand).toBe('JournalEntry');
      expect(entry.filepath.toString()).toBe('test.txt');
      expect(entry.chunks.map(String)).toEqual(['hash1', 'hash2']);
      expect(Number(entry.size)).toBe(8192);
      expect(entry.isDeleted).toBe(false);
    });

    it('creates deleted entry', () => {
      const entry = createEntry({
        filepath: 'deleted.txt',
        chunks: [],
        size: 0,
        isDeleted: true,
      });
      expect(entry.isDeleted).toBe(true);
      expect(entry.chunks.length).toBe(0);
    });
  });
});
