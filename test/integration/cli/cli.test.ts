import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';

const TEST_DIR = '/tmp/ghost-test-cli';
const GHOST_CMD = 'bun run --cwd /home/beanie/ghost src/index.ts';

describe('CLI integration', () => {
  beforeEach(async () => {
    await fsp.rm(TEST_DIR, { recursive: true, force: true });
    await fsp.mkdir(TEST_DIR, { recursive: true });
    process.chdir(TEST_DIR);
    // Run init
    execSync(`${GHOST_CMD} init`, { stdio: 'ignore' });
  });

  afterEach(async () => {
    await fsp.rm(TEST_DIR, { recursive: true, force: true });
  });

  const run = (args: string) => {
    try {
      return execSync(`${GHOST_CMD} ${args}`, { encoding: 'utf-8', cwd: TEST_DIR });
    } catch (e: unknown) {
      if (e instanceof Error && 'stdout' in e) {
        return (e as { stdout: string }).stdout;
      }
      throw e;
    }
  };

  describe('init', () => {
    it('creates .ghost directory structure', () => {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
      fs.mkdirSync(TEST_DIR, { recursive: true });
      process.chdir(TEST_DIR);

      run('init');

      expect(fs.existsSync('.ghost')).toBe(true);
      expect(fs.existsSync('.ghost/objects')).toBe(true);
      expect(fs.existsSync('.ghost/journal.log')).toBe(true);
    });
  });

  describe('write', () => {
    it('writes content and updates journal', () => {
      const output = run('write test.txt "Hello World"');
      expect(output).toContain('Content written to test.txt');
    });

    it('creates chunks in object store', () => {
      run('write data.bin "x".repeat(10000)');
      const objectsDir = '.ghost/objects';
      const subdirs = fs.readdirSync(objectsDir);
      expect(subdirs.length).toBeGreaterThan(0);
    });
  });

  describe('read', () => {
    it('reads written content', () => {
      run('write hello.txt "Hello Ghost"');
      const output = run('read hello.txt');
      expect(output).toBe('Hello Ghost');
    });

    it('exits with error for non-existent file', () => {
      expect(() => run('read missing.txt')).toThrow();
    });
  });

  describe('history', () => {
    it('shows timeline for file', () => {
      run('write history.txt "version 1"');
      run('write history.txt "version 2"');
      const output = run('history history.txt');
      expect(output).toContain('Timeline for history.txt');
      expect(output).toContain('written');
      expect(output).toContain('version');
    });

    it('shows no history for non-existent file', () => {
      const output = run('history missing.txt');
      expect(output).toContain('No history found');
    });
  });

  describe('rm', () => {
    it('marks file as deleted', () => {
      run('write todelete.txt "to delete"');
      const output = run('rm todelete.txt');
      expect(output).toContain('marked as deleted');
    });

    it('read fails after delete', () => {
      run('write todelete.txt "to delete"');
      run('rm todelete.txt');
      expect(() => run('read todelete.txt')).toThrow();
    });
  });

  describe('restore', () => {
    it('restores soft-deleted file', () => {
      run('write restore.txt "original"');
      run('rm restore.txt');
      const output = run('restore restore.txt');
      expect(output).toContain('restored');

      const content = run('read restore.txt');
      expect(content).toBe('original');
    });
  });

  describe('roundtrip', () => {
    it('write -> read -> history -> rm -> restore', () => {
      run('write roundtrip.txt "v1"');
      expect(run('read roundtrip.txt')).toBe('v1');

      run('write roundtrip.txt "v2"');
      expect(run('read roundtrip.txt')).toBe('v2');

      const history = run('history roundtrip.txt');
      expect(history.split('\n').filter(l => l.includes('written')).length).toBe(2);

      run('rm roundtrip.txt');
      expect(() => run('read roundtrip.txt')).toThrow();

      run('restore roundtrip.txt');
      expect(run('read roundtrip.txt')).toBe('v2');
    });
  });

  describe('large content', () => {
    it('handles multi-chunk content', () => {
      const largeContent = 'x'.repeat(50000); // ~50KB = 13 chunks
      run(`write large.txt "${largeContent}"`);
      const output = run('read large.txt');
      expect(output).toBe(largeContent);
    });
  });
});
