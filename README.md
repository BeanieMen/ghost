<div align="right">
  <a href="https://www.typescriptlang.org/">
    <img src="https://img.shields.io/badge/TypeScript-5.5+-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  </a>
  <a href="https://bun.sh/">
    <img src="https://img.shields.io/badge/Bun-1.1+-000000?logo=bun&logoColor=white" alt="Bun">
  </a>
  <a href="https://opensource.org/licenses/MIT">
    <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="MIT License">
  </a>
</div>
<p align="center">
<img width="256" height="310" alt="image" src="assets/logo.png" />

<h1 align="center">Ghost</h1>



<p align="center"> A temporal filesystem that treats time as part of the data. </p>


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
- **Atomic operations**: ENOENT race conditions eliminated with `mkdirSync(recursive)` (i faced this while using sync file ops. had to debug and fix)

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


## How to run

```bash
bun install
bun run build
```

run binary
```bash
./dist/ghost
```


## How It Works
first write, parses content into 4kb chunks and hashes each chunk to store and then appends to a general
read then looks into the jounral from files and regenrates it from chunk hashes

history just lays out the timeline of a certain file

delete doesnt really delete anything just removes it from being shown like how modern filesystem dont really delete files but remove the file from showing up in the file system. the file is still there just hidden
restore undoes what delete did 
and you can run `ghost watch` to automatically journal a folder and the files being edited in it to the journal

## Ai Disclosure
ai was used to only template readme (i rewrote it by hand now with lapse)
and to refactor project and files 

## LICENSE
MIT
