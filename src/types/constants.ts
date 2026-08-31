import * as path from 'path';

export const REPO_DIR = '.ghost';
export const OBJECTS_DIR = path.join(REPO_DIR, 'objects');
export const JOURNAL_FILE = path.join(REPO_DIR, 'journal.log');
export const CHUNK_SIZE = 4096;
export const DEFAULT_FILE_MODE = 0o644;
export const DEFAULT_DIR_MODE = 0o755;
