# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-09-01

### Added

- Core temporal filesystem implementation
- Content-addressable storage with SHA-256 chunking (4KB)
- Journal-based version history with temporal queries
- Atomic file operations (ENOENT race condition fixed)
- CLI with commands: init, write, read, history, rm, restore, watch

### Type System

- Branded types for domain modeling (`FileId`, `ChunkHash`, `Timestamp`, `ByteSize`)
- Discriminated unions for exhaustive state handling (`OperationState`)
- Type guards and assertion functions
- `satisfies` operator for compile-time shape validation

### TypeScript Configuration

- Strict mode with all safety flags enabled
- No `any`, no unchecked indexed access, exact optional properties
- Declaration file generation enabled
- Incremental compilation

### Developer Experience

- ESLint + TypeScript-ESLint configuration
- Prettier formatting
- Comprehensive npm scripts (typecheck, lint, format, test, build)
- Type-safe CLI with Commander.js
- Detailed help text with examples

### Fixed

- `ressurect` → `restore` command name typo
- Atomic directory creation with `mkdirSync({ recursive: true })`
- Type import organization (type-only vs value imports)
- Watch callback typing for null filename

---

## [Unreleased]

### Planned

- Unit tests for crypto and journal modules
- Integration tests for CLI commands
- Performance benchmarks
- Configuration file support (`.ghostrc`)
- Multiple repository support
- Remote sync capability
