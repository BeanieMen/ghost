import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

import { OBJECTS_DIR } from '../types/constants';

export function hashChunk(data: Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function storeChunk(data: Buffer): string {
  const hash = hashChunk(data);
  console.log(hash);
  const subDir = path.join(OBJECTS_DIR, hash.slice(0, 2));
  const filePath = path.join(subDir, hash.slice(2));

  // Fix ENOENT race condition: use mkdirSync {recursive: true} atomically
  if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, data);
  return hash;
}

export function chunkBuffer(buffer: Buffer): string[] {
  const chunks: string[] = [];
  const CHUNK_SIZE = 4096; // 4KB
  for (let i = 0; i < buffer.length; i += CHUNK_SIZE) {
    chunks.push(storeChunk(buffer.subarray(i, i + CHUNK_SIZE)));
  }
  return chunks;
}
