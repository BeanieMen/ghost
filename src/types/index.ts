type Brand<T, B extends string> = T & { readonly __brand: B };

export type FileId = Brand<string, 'FileId'>;
export type ChunkHash = Brand<string, 'ChunkHash'>;
export type Timestamp = Brand<number, 'Timestamp'>;
export type ByteSize = Brand<number, 'ByteSize'>;

export function isFileId(value: string): value is FileId {
  return typeof value === 'string' && value.length > 0;
}

export function isChunkHash(value: string): value is ChunkHash {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

export function toFileId(value: string): FileId {
  if (!isFileId(value)) {
    throw new Error(`Invalid FileId: ${value}`);
  }
  return value;
}

export function toChunkHash(value: string): ChunkHash {
  if (!isChunkHash(value)) {
    throw new Error(`Invalid ChunkHash: ${value}`);
  }
  return value;
}

export type OperationState<T = unknown> =
  | { status: 'pending' }
  | { status: 'loading'; startedAt: Timestamp }
  | { status: 'success'; data: T; completedAt: Timestamp }
  | { status: 'error'; error: Error; failedAt: Timestamp };

export function isSuccess<T>(
  state: OperationState<T>
): state is OperationState<T> & { status: 'success' } {
  return state.status === 'success';
}

export function isError<T>(
  state: OperationState<T>
): state is OperationState<T> & { status: 'error' } {
  return state.status === 'error';
}

export function isLoading<T>(
  state: OperationState<T>
): state is OperationState<T> & { status: 'loading' } {
  return state.status === 'loading';
}

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

export interface JournalEntry {
  readonly __brand: 'JournalEntry';
  timestamp: Timestamp;
  filepath: FileId;
  chunks: readonly ChunkHash[];
  size: ByteSize;
  isDeleted: boolean;
}

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

export type Subcommand = 'init' | 'write' | 'read' | 'history' | 'rm' | 'restore' | 'watch';

export interface CLIOptions {
  time?: Timestamp;
  force?: boolean;
  verbose?: boolean;
}

export { REPO_DIR, OBJECTS_DIR, JOURNAL_FILE, CHUNK_SIZE } from './constants';
