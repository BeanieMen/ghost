import * as path from 'path';

/** Root directory for ghost repository */
export const REPO_DIR = '.ghost';

/** Directory for storing content chunks */
export const OBJECTS_DIR = path.join(REPO_DIR, 'objects');

/** Journal file for tracking operations */
export const JOURNAL_FILE = path.join(REPO_DIR, 'journal.log');

/** Chunk size for content splitting (4KB) */
export const CHUNK_SIZE = 4096;

/** Default file permissions */
export const DEFAULT_FILE_MODE = 0o644;

/** Default directory permissions */
export const DEFAULT_DIR_MODE = 0o755;
