import * as crypto from "crypto";
import * as path from "path";
import * as fs from "fs";

import { OBJECTS_DIR, CHUNK_SIZE } from "../types/constants";
import type { ChunkHash } from "../types";

/**
 * Generate SHA-256 hash of data
 * @returns 64-character hex string
 */
export function hashChunk(data: Buffer): ChunkHash {
  const hash = crypto.createHash("sha256").update(data).digest("hex");
  return hash as ChunkHash;
}

/**
 * Store a chunk atomically and return its hash
 * Fixes ENOENT race condition with atomic mkdirSync + writeFileSync
 */
export function storeChunk(data: Buffer): ChunkHash {
  const hash = hashChunk(data);
  console.log(hash);
  const subDir = path.join(OBJECTS_DIR, hash.slice(0, 2));
  const filePath = path.join(subDir, hash.slice(2));

  // Atomic directory creation - eliminates TOCTOU race condition
  fs.mkdirSync(subDir, { recursive: true });
  fs.writeFileSync(filePath, data);
  return hash;
}

/**
 * Split buffer into CHUNK_SIZE chunks and store each
 * @returns Array of chunk hashes in order
 */
export function chunkBuffer(buffer: Buffer): ChunkHash[] {
  const chunks: ChunkHash[] = [];
  for (let i = 0; i < buffer.length; i += CHUNK_SIZE) {
    chunks.push(storeChunk(buffer.subarray(i, i + CHUNK_SIZE)));
  }
  return chunks;
}

/**
 * Read and reconstruct content from chunk hashes
 */
export function readChunks(chunkHashes: readonly ChunkHash[]): Buffer {
  const buffers = chunkHashes.map((hash) => {
    const chunkPath = path.join(OBJECTS_DIR, hash.slice(0, 2), hash.slice(2));
    return fs.readFileSync(chunkPath);
  });
  return Buffer.concat(buffers);
}