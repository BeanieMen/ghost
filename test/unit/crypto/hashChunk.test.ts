import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import {
  hashChunk,
  storeChunk,
  chunkBuffer,
  readChunks,
  snapshotHash,
} from '../../../src/helpers/crypto';
import type { ChunkHash } from '../../../src/types';

const TEST_DIR = '/tmp/ghost-test-crypto-vitest';

const toChunkHash = (v: string): ChunkHash => v as ChunkHash;

describe('crypto module', () => {
  beforeEach(async () => {
    await fsp.rm(TEST_DIR, { recursive: true, force: true });
    await fsp.mkdir(TEST_DIR, { recursive: true });
    process.chdir(TEST_DIR);
    // The object store lives at ./.ghost/objects relative to cwd
    await fsp.mkdir('.ghost/objects', { recursive: true });
  });

  afterEach(async () => {
    await fsp.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('hashChunk', () => {
    it('produces consistent hash for same input', () => {
      const data = Buffer.from('hello world');
      expect(hashChunk(data)).toBe(hashChunk(data));
    });

    it('produces different hashes for different input', () => {
      expect(hashChunk(Buffer.from('hello'))).not.toBe(hashChunk(Buffer.from('world')));
    });

    it('produces 64-character hex string', () => {
      expect(hashChunk(Buffer.from('test'))).toMatch(/^[a-f0-9]{64}$/i);
    });

    it('handles empty buffer', () => {
      expect(hashChunk(Buffer.from(''))).toMatch(/^[a-f0-9]{64}$/i);
    });
  });

  describe('storeChunk', () => {
    it('stores chunk and returns hash', () => {
      const hash = storeChunk(Buffer.from('test content'));
      expect(hash).toMatch(/^[a-f0-9]{64}$/i);
    });

    it('creates object file under .ghost/objects', () => {
      const hash = storeChunk(Buffer.from('stored content'));
      const expectedPath = `.ghost/objects/${hash.slice(0, 2)}/${hash.slice(2)}`;
      expect(fs.existsSync(expectedPath)).toBe(true);
    });

    it('deduplicates identical content', () => {
      const h1 = storeChunk(Buffer.from('duplicate test'));
      const h2 = storeChunk(Buffer.from('duplicate test'));
      expect(h1).toBe(h2);
    });
  });

  describe('chunkBuffer', () => {
    it('splits buffer into 4KB chunks', () => {
      const chunks = chunkBuffer(Buffer.alloc(10000, 'a'));
      expect(chunks.length).toBe(3);
      expect(chunks[0]).toMatch(/^[a-f0-9]{64}$/i);
    });

    it('handles exact chunk size', () => {
      expect(chunkBuffer(Buffer.alloc(4096, 'b')).length).toBe(1);
    });

    it('handles small buffer', () => {
      expect(chunkBuffer(Buffer.from('small')).length).toBe(1);
    });

    it('handles empty buffer', () => {
      expect(chunkBuffer(Buffer.from('')).length).toBe(0);
    });
  });

  describe('readChunks', () => {
    it('reconstructs content from chunk hashes', () => {
      const original = Buffer.from('reconstruct test content');
      const hashes = chunkBuffer(original);
      expect(readChunks(hashes).equals(original)).toBe(true);
    });

    it('handles multiple chunks', () => {
      const original = Buffer.alloc(10000, 'z');
      const hashes = chunkBuffer(original);
      expect(readChunks(hashes).equals(original)).toBe(true);
    });
  });

  describe('snapshotHash', () => {
    it('is deterministic for identical snapshot', () => {
      const a = snapshotHash({ chunks: [toChunkHash('abc123')], isDeleted: false });
      const b = snapshotHash({ chunks: [toChunkHash('abc123')], isDeleted: false });
      expect(a).toBe(b);
      expect(a).toMatch(/^[a-f0-9]{64}$/i);
    });

    it('differs when content changes', () => {
      const a = snapshotHash({ chunks: [toChunkHash('abc123')], isDeleted: false });
      const b = snapshotHash({ chunks: [toChunkHash('abcd23')], isDeleted: false });
      expect(a).not.toBe(b);
    });

    it('differs between deleted and active states', () => {
      const active = snapshotHash({ chunks: [toChunkHash('abc123')], isDeleted: false });
      const deleted = snapshotHash({ chunks: [toChunkHash('abc123')], isDeleted: true });
      expect(active).not.toBe(deleted);
    });
  });
});
