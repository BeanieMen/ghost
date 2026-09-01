import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

import { OBJECTS_DIR, CHUNK_SIZE } from '../types/constants';
import type { ChunkHash } from '../types';

export function hashChunk(data: Buffer): ChunkHash {
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  return hash as ChunkHash;
}

export function storeChunk(data: Buffer): ChunkHash {
  const hash = hashChunk(data);
  const subDir = path.join(OBJECTS_DIR, hash.slice(0, 2));
  const filePath = path.join(subDir, hash.slice(2));

  fs.mkdirSync(subDir, { recursive: true });
  fs.writeFileSync(filePath, data);
  return hash;
}

export function chunkBuffer(buffer: Buffer): ChunkHash[] {
  const chunks: ChunkHash[] = [];
  for (let i = 0; i < buffer.length; i += CHUNK_SIZE) {
    chunks.push(storeChunk(buffer.subarray(i, i + CHUNK_SIZE)));
  }
  return chunks;
}

export function snapshotHash(params: { chunks: readonly ChunkHash[]; isDeleted: boolean }): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({ chunks: params.chunks, isDeleted: params.isDeleted }))
    .digest('hex');
}

export function readChunks(chunkHashes: readonly ChunkHash[]): Buffer {
  const buffers = chunkHashes.map(hash => {
    const chunkPath = path.join(OBJECTS_DIR, hash.slice(0, 2), hash.slice(2));
    return fs.readFileSync(chunkPath);
  });
  return Buffer.concat(buffers);
}
