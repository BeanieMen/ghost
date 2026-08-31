/**
 * Ghost Filesystem - Type Definitions
 *
 * Branded types prevent accidental mixing of domain identifiers.
 * Discriminated unions enable exhaustive state handling.
 * satisfies operator provides compile-time validation.
 */

// ============================================================================
// Branded Types - Domain Modeling
// ============================================================================

/** Branded type utility - creates nominal types from structural types */
type Brand<T, B extends string> = T & { readonly __brand: B };

/** Unique identifier for files in the ghost filesystem */
export type FileId = Brand<string, 'FileId'>;

/** SHA-256 hash identifier for content chunks */
export type ChunkHash = Brand<string, 'ChunkHash'>;

/** Timestamp in milliseconds since epoch */
export type Timestamp = Brand<number, 'Timestamp'>;

/** File size in bytes */
export type ByteSize = Brand<number, 'ByteSize'>;

// ============================================================================
// Type Guards & Assertions
// ============================================================================

/** Type predicate for FileId */
export function isFileId(value: string): value is FileId {
  return typeof value === 'string' && value.length > 0;
}

/** Type predicate for ChunkHash (64-char hex) */
export function isChunkHash(value: string): value is ChunkHash {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

/** Create a FileId from string (with validation) */
export function toFileId(value: string): FileId {
  if (!isFileId(value)) {
    throw new Error(`Invalid FileId: ${value}`);
  }
  return value;
}

/** Create a ChunkHash from string (with validation) */
export function toChunkHash(value: string): ChunkHash {
  if (!isChunkHash(value)) {
    throw new Error(`Invalid ChunkHash: ${value}`);
  }
  return value;
}

// ============================================================================
// Discriminated Unions - State Machines
// ============================================================================

/** Operation result states for exhaustive handling */
export type OperationState<T = unknown> =
  | { status: 'pending' }
  | { status: 'loading'; startedAt: Timestamp }
  | { status: 'success'; data: T; completedAt: Timestamp }
  | { status: 'error'; error: Error; failedAt: Timestamp };

/** Type guard for success state */
export function isSuccess<T>(
  state: OperationState<T>
): state is OperationState<T> & { status: 'success' } {
  return state.status === 'success';
}

/** Type guard for error state */
export function isError<T>(
  state: OperationState<T>
): state is OperationState<T> & { status: 'error' } {
  return state.status === 'error';
}

/** Type guard for loading state */
export function isLoading<T>(
  state: OperationState<T>
): state is OperationState<T> & { status: 'loading' } {
  return state.status === 'loading';
}

/** Exhaustive state handler - TypeScript enforces all cases handled */
export function handleState<T, R>(
  state: OperationState<T>,
  handlers: {
    pending: () => R;
    loading: (startedAt: Timestamp) => R;
    success: (data: T, completedAt: Timestamp) => R;
    error: (error: Error, failedAt: Timestamp) => R;
  }
): R {
  switch (state.status) {
    case 'pending':
      return handlers.pending();
    case 'loading':
      return handlers.loading(state.startedAt);
    case 'success':
      return handlers.success(state.data, state.completedAt);
    case 'error':
      return handlers.error(state.error, state.failedAt);
    default: {
      const _exhaustive: never = state;
      throw new Error(`Unhandled state: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

// ============================================================================
// Journal Entry - Core Domain Type
// ============================================================================

/** Journal entry with branded identifiers for type safety */
export interface JournalEntry {
  readonly __brand: 'JournalEntry';
  timestamp: Timestamp;
  filepath: FileId;
  chunks: readonly ChunkHash[];
  size: ByteSize;
  isDeleted: boolean;
}

/** Create a validated JournalEntry using satisfies for compile-time checking */
export function createJournalEntry(params: {
  timestamp: number;
  filepath: string;
  chunks: string[];
  size: number;
  isDeleted: boolean;
}): JournalEntry {
  const entry = {
    __brand: 'JournalEntry' as const,
    timestamp: params.timestamp as Timestamp,
    filepath: toFileId(params.filepath),
    chunks: params.chunks.map(toChunkHash),
    size: params.size as ByteSize,
    isDeleted: params.isDeleted,
  } satisfies JournalEntry;

  return entry;
}

// ============================================================================
// CLI Types
// ============================================================================

/** Supported CLI subcommands */
export type Subcommand = 'init' | 'write' | 'read' | 'history' | 'rm' | 'restore' | 'watch';

/** CLI command options */
export interface CLIOptions {
  time?: Timestamp;
  force?: boolean;
  verbose?: boolean;
}

// ============================================================================
// Configuration Constants
// ============================================================================

export { REPO_DIR, OBJECTS_DIR, JOURNAL_FILE, CHUNK_SIZE } from './constants';
