import { describe, it, expect } from 'vitest';
import {
  isFileId,
  isChunkHash,
  toFileId,
  toChunkHash,
  isSuccess,
  isError,
  isLoading,
  handleState,
  createJournalEntry,
  type Timestamp,
} from '../../../src/types';

describe('type guards & conversion', () => {
  const toTime = (n: number): Timestamp => n as Timestamp;

  describe('isFileId / toFileId', () => {
    it('accepts non-empty strings', () => {
      expect(isFileId('foo.txt')).toBe(true);
    });

    it('rejects empty strings', () => {
      expect(isFileId('')).toBe(false);
    });

    it('toFileId returns the value for a valid id', () => {
      expect(toFileId('foo.txt')).toBe('foo.txt');
    });

    it('toFileId throws for an empty id', () => {
      expect(() => toFileId('')).toThrow(/Invalid FileId/);
    });
  });

  describe('isChunkHash / toChunkHash', () => {
    const valid = 'a'.repeat(64);

    it('accepts a 64-char lowercase hex hash', () => {
      expect(isChunkHash(valid)).toBe(true);
    });

    it('accepts a 64-char uppercase hex hash', () => {
      expect(isChunkHash('A'.repeat(64))).toBe(true);
    });

    it('rejects short hashes', () => {
      expect(isChunkHash(valid.slice(0, 16))).toBe(false);
    });

    it('rejects non-hex characters', () => {
      expect(isChunkHash('g' + 'a'.repeat(63))).toBe(false);
    });

    it('toChunkHash returns the value for a valid hash', () => {
      expect(toChunkHash(valid)).toBe(valid);
    });

    it('toChunkHash throws for an invalid hash', () => {
      expect(() => toChunkHash('zz')).toThrow(/Invalid ChunkHash/);
    });
  });

  describe('state guards', () => {
    it('isSuccess only matches success states', () => {
      expect(isSuccess({ status: 'success', data: 1, completedAt: toTime(1) })).toBe(true);
      expect(isSuccess({ status: 'pending' })).toBe(false);
      expect(
        isSuccess({ status: 'error', error: new Error('x'), failedAt: toTime(1) })
      ).toBe(false);
    });

    it('isError only matches error states', () => {
      expect(
        isError({ status: 'error', error: new Error('x'), failedAt: toTime(1) })
      ).toBe(true);
      expect(isError({ status: 'pending' })).toBe(false);
      expect(isError({ status: 'loading', startedAt: toTime(1) })).toBe(false);
    });

    it('isLoading only matches loading states', () => {
      expect(isLoading({ status: 'loading', startedAt: toTime(1) })).toBe(true);
      expect(isLoading({ status: 'pending' })).toBe(false);
    });
  });

  describe('handleState', () => {
    const mkHandlers = () => ({
      pending: () => 'pending',
      loading: (startedAt: Timestamp) => `loading:${startedAt}`,
      success: (data: number, completedAt: Timestamp) => `ok:${data}:${completedAt}`,
      error: (error: Error, failedAt: Timestamp) => `err:${error.message}:${failedAt}`,
    });

    it('dispatches pending', () => {
      expect(handleState({ status: 'pending' }, mkHandlers())).toBe('pending');
    });

    it('dispatches loading with startedAt', () => {
      expect(handleState({ status: 'loading', startedAt: toTime(5) }, mkHandlers())).toBe(
        'loading:5'
      );
    });

    it('dispatches success with data and completedAt', () => {
      expect(
        handleState({ status: 'success', data: 42, completedAt: toTime(7) }, mkHandlers())
      ).toBe('ok:42:7');
    });

    it('dispatches error with error and failedAt', () => {
      expect(
        handleState(
          { status: 'error', error: new Error('boom'), failedAt: toTime(9) },
          mkHandlers()
        )
      ).toBe('err:boom:9');
    });

    it('throws on an unknown status (exhaustive default)', () => {
      expect(() =>
        handleState({ status: 'nope' } as never, mkHandlers())
      ).toThrow(/Unhandled state/);
    });
  });

  describe('createJournalEntry', () => {
    it('builds a valid entry with branded fields', () => {
      const chunk = 'b'.repeat(64);
      const entry = createJournalEntry({
        timestamp: 123,
        filepath: 'a.txt',
        chunks: [chunk],
        size: 42,
        isDeleted: false,
      });
      expect(entry.timestamp).toBe(123);
      expect(entry.filepath).toBe('a.txt');
      expect(entry.chunks).toEqual([chunk]);
      expect(entry.size).toBe(42);
      expect(entry.isDeleted).toBe(false);
      expect(entry.__brand).toBe('JournalEntry');
    });

    it('throws when given an invalid chunk hash', () => {
      expect(() =>
        createJournalEntry({
          timestamp: 1,
          filepath: 'a.txt',
          chunks: ['nope'],
          size: 1,
          isDeleted: false,
        })
      ).toThrow(/Invalid ChunkHash/);
    });

    it('throws when given an empty filepath', () => {
      expect(() =>
        createJournalEntry({
          timestamp: 1,
          filepath: '',
          chunks: [],
          size: 0,
          isDeleted: false,
        })
      ).toThrow(/Invalid FileId/);
    });
  });
});
