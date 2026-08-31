# Ghost Filesystem

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.1+-000000?logo=bun&logoColor=white)](https://bun.sh/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **A temporal filesystem that treats time as part of the data.**

Ghost is a content-addressable filesystem where every write creates an immutable snapshot. Content is chunked (4KB), hashed with SHA-256, and stored with full version history. Read any file at any point in time.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│   Write     │────▶│  Chunking    │────▶│  SHA-256 Hash    │
│  "file.txt" │     │  4KB chunks  │     │  (content addr)  │
└─────────────┘     └──────────────┘     └────────┬─────────┘
                                                   │
                    ┌──────────────┐              │
                    │   Journal    │◀─────────────┤
                    │  (.ghost/    │              │
                    │  journal.log)│              ▼
                    └──────────────┘     ┌──────────────────┐
                                         │  Object Store    │
                                         │  (.ghost/objects/│
                                         │   {hash[:2]}/     │
                                         │   {hash[2:]})    │
                                         └──────────────────┘
```

- **Content-addressable storage**: Deduplicates identical content automatically
- **Immutable snapshots**: Every write creates a new version
- **Temporal queries**: Read files at any historical timestamp
- **Atomic operations**: ENOENT race conditions eliminated with `mkdirSync(recursive)`

## Quick Start

```bash
# Initialize repository
bun run ghost init

# Write content (creates snapshot)
bun run ghost write notes.md "# My Notes\n\nContent here"

# Read latest version
bun run ghost read notes.md

# Read at specific timestamp
bun run ghost read notes.md -t 1700000000000

# View change history
bun run ghost history notes.md

# Soft delete (preserves history)
bun run ghost rm notes.md

# Restore from delete
bun run ghost restore notes.md

# Watch for changes (auto-commits)
bun run ghost watch
```

## Commands

| Command                  | Alias    | Description                          |
| ------------------------ | -------- | ------------------------------------ |
| `init`                   | `setup`  | Initialize `.ghost/` repository      |
| `write <path> <content>` | `w`      | Write content, create snapshot       |
| `read <path>`            | `r`      | Read latest (or at `-t` time)        |
| `history <path>`         | `h`      | Show version timeline                |
| `rm <path>`              | `delete` | Soft delete (marks deleted)          |
| `restore <path>`         | `undel`  | Restore last active version          |
| `watch`                  | `daemon` | Watch directory, auto-commit changes |

## Type Safety

Ghost uses **branded types** for domain modeling:

```typescript
type FileId = Brand<string, 'FileId'>;
type ChunkHash = Brand<string, 'ChunkHash'>;
type Timestamp = Brand<number, 'Timestamp'>;
```

This prevents accidental mixing of identifiers at compile time.

**Discriminated unions** enable exhaustive state handling:

```typescript
type OperationState<T> =
  | { status: 'pending' }
  | { status: 'loading'; startedAt: Timestamp }
  | { status: 'success'; data: T; completedAt: Timestamp }
  | { status: 'error'; error: Error; failedAt: Timestamp };
```

**`satisfies` operator** validates object shapes at compile time:

```typescript
const entry = createEntry({ filepath, chunks, size, isDeleted: false });
// TypeScript validates shape matches JournalEntry exactly
```

## Development

```bash
# Install dependencies
bun install

# Type checking
bun run typecheck

# Linting
bun run lint

# Formatting
bun run format

# Run all checks
bun run check

# Run tests
bun run test

# Build binary
bun run build
```

## Project Structure

```
src/
├── index.ts              # CLI entry point
├── helper.ts             # Async file operations
├── types/                # Type definitions
│   ├── index.ts          # Branded types, discriminated unions
│   └── constants.ts      # Configuration constants
├── helpers/              # Pure utility functions
│   └── crypto.ts         # Chunking, hashing, storage
├── core/                 # Business logic
│   └── journal.ts        # Journal operations
└── store/                # Persistence layer (reserved)
```

## How It Works

1. **Write**: Content → 4KB chunks → SHA-256 hash each → store in `.ghost/objects/{aa}/{bb...}` → append journal entry
2. **Read**: Lookup latest journal entry for file → get chunk hashes → reconstruct from object store
3. **History**: Filter journal by filepath → display timeline
4. **Delete**: Append journal entry with `isDeleted: true` (content preserved)
5. **Restore**: Find last non-deleted entry → re-append as active
6. **Watch**: `fs.watch` with 300ms debounce → auto-commit on change

## License

MIT
