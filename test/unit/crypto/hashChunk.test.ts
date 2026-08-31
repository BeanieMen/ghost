import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { hashChunk, storeChunk, chunkBuffer, readChunks } from "../../../src/helpers/crypto";
import { OBJECTS_DIR } from "../../../src/types/constants";

const TEST_DIR = "/tmp/ghost-test-crypto";

describe("crypto module", () => {
  beforeEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_DIR, { recursive: true });
    // Override OBJECTS_DIR for testing
    process.env.OBJECTS_DIR_OVERRIDE = path.join(TEST_DIR, "objects");
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe("hashChunk", () => {
    it("produces consistent hash for same input", () => {
      const data = Buffer.from("hello world");
      const hash1 = hashChunk(data);
      const hash2 = hashChunk(data);
      expect(hash1).toBe(hash2);
    });

    it("produces different hashes for different input", () => {
      const hash1 = hashChunk(Buffer.from("hello"));
      const hash2 = hashChunk(Buffer.from("world"));
      expect(hash1).not.toBe(hash2);
    });

    it("produces 64-character hex string", () => {
      const hash = hashChunk(Buffer.from("test"));
      expect(hash).toMatch(/^[a-f0-9]{64}$/i);
    });

    it("handles empty buffer", () => {
      const hash = hashChunk(Buffer.from(""));
      expect(hash).toMatch(/^[a-f0-9]{64}$/i);
    });

    it("handles large buffer", () => {
      const largeData = Buffer.alloc(100000, "x");
      const hash = hashChunk(largeData);
      expect(hash).toMatch(/^[a-f0-9]{64}$/i);
    });
  });

  describe("storeChunk", () => {
    it("stores chunk and returns hash", () => {
      const data = Buffer.from("test content");
      const hash = storeChunk(data);
      expect(hash).toMatch(/^[a-f0-9]{64}$/i);
    });

    it("creates file in object store", () => {
      const data = Buffer.from("stored content");
      const hash = storeChunk(data);
      const expectedPath = path.join(OBJECTS_DIR, hash.slice(0, 2), hash.slice(2));
      const exists = fs.existsSync(expectedPath);
      expect(exists).toBe(true);
    });

    it("deduplicates identical content", () => {
      const data = Buffer.from("duplicate test");
      const hash1 = storeChunk(data);
      const hash2 = storeChunk(data);
      expect(hash1).toBe(hash2);
    });
  });

  describe("chunkBuffer", () => {
    it("splits buffer into 4KB chunks", () => {
      const data = Buffer.alloc(10000, "a"); // ~10KB = 3 chunks
      const chunks = chunkBuffer(data);
      expect(chunks.length).toBe(3);
      expect(chunks[0]).toMatch(/^[a-f0-9]{64}$/i);
    });

    it("handles exact chunk size", () => {
      const data = Buffer.alloc(4096, "b");
      const chunks = chunkBuffer(data);
      expect(chunks.length).toBe(1);
    });

    it("handles small buffer", () => {
      const data = Buffer.from("small");
      const chunks = chunkBuffer(data);
      expect(chunks.length).toBe(1);
    });

    it("handles empty buffer", () => {
      const data = Buffer.from("");
      const chunks = chunkBuffer(data);
      expect(chunks.length).toBe(0);
    });
  });

  describe("readChunks", () => {
    it("reconstructs content from chunk hashes", () => {
      const original = Buffer.from("reconstruct test content");
      const hashes = chunkBuffer(original);
      const reconstructed = readChunks(hashes);
      expect(reconstructed.equals(original)).toBe(true);
    });

    it("handles multiple chunks", () => {
      const original = Buffer.alloc(10000, "z");
      const hashes = chunkBuffer(original);
      const reconstructed = readChunks(hashes);
      expect(reconstructed.equals(original)).toBe(true);
    });
  });
});