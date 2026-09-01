import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_DIR = '/tmp/ghost-test-cli-vitest';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const CMD = `bun ${path.join(ROOT, 'src', 'index.ts')}`;

const run = (args: string, opts: { cwd?: string } = {}): string => {
  try {
    return execSync(`${CMD} ${args}`, { encoding: 'utf-8', cwd: opts.cwd ?? TEST_DIR });
  } catch (e: unknown) {
    if (e instanceof Error && 'stdout' in e) {
      return String((e as { stdout: unknown }).stdout);
    }
    throw e;
  }
};

const runExit = (args: string): { status: number; stdout: string; stderr: string } => {
  const r = spawnSync('bun', [path.join(ROOT, 'src', 'index.ts'), ...args.split(' ')], {
    encoding: 'utf-8',
    cwd: TEST_DIR,
  });
  return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
};

describe('ghost CLI (vitest)', () => {
  beforeEach(async () => {
    await fsp.rm(TEST_DIR, { recursive: true, force: true });
    await fsp.mkdir(TEST_DIR, { recursive: true });
    run('init');
  });

  afterEach(async () => {
    await fsp.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('init', () => {
    it('creates .ghost directory structure', () => {
      expect(fs.existsSync(path.join(TEST_DIR, '.ghost'))).toBe(true);
      expect(fs.existsSync(path.join(TEST_DIR, '.ghost/objects'))).toBe(true);
      expect(fs.existsSync(path.join(TEST_DIR, '.ghost/journal.log'))).toBe(true);
    });
  });

  describe('write', () => {
    it('writes content without leaking a stray hash to stdout', () => {
      const output = run('write hello.txt "Hello Ghost"');
      expect(output).toContain('Content written to hello.txt');
      expect(output).not.toMatch(/[a-f0-9]{64}/); // no stray 64-hex hash line
    });

    it('creates object chunks', () => {
      const big = 'x'.repeat(10000);
      run(`write data.bin ${big}`);
      const objectsDir = path.join(TEST_DIR, '.ghost/objects');
      expect(fs.readdirSync(objectsDir).length).toBeGreaterThan(0);
    });
  });

  describe('read', () => {
    it('round-trips content', () => {
      run('write hello.txt "Hello Ghost"');
      expect(run('read hello.txt').trim()).toBe('Hello Ghost');
    });

    it('exits with error and a locale timestamp for missing file', () => {
      const r = runExit('read missing.txt');
      expect(r.status).toBe(1);
      // locale format like "9/1/2026, ..." rather than ISO "Z"
      expect(r.stderr).not.toMatch(/T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    });
  });

  describe('history with snapshot hashes', () => {
    it('prints a 64-hex snapshot hash per entry', () => {
      run('write h.txt "v1"');
      run('write h.txt "v2"');
      const output = run('history h.txt');
      expect(output).toContain('Timeline for h.txt');
      const hashes = output.match(/[a-f0-9]{64}/g) ?? [];
      expect(hashes.length).toBe(2);
    });
  });

  describe('rewind', () => {
    it('rewinds a file to an earlier snapshot by hash', () => {
      run('write r.txt "v1"');
      run('write r.txt "v2"');
      run('write r.txt "v3"');

      const history = run('history r.txt');
      const v1Hash = (history.match(/[a-f0-9]{64}/g) ?? [])[0]!;

      run(`rewind r.txt ${v1Hash}`);
      expect(run('read r.txt').trim()).toBe('v1');
    });

    it('rewinds using a short hash prefix', () => {
      run('write r.txt "v1"');
      run('write r.txt "v2"');
      const history = run('history r.txt');
      const v1Hash = (history.match(/[a-f0-9]{64}/g) ?? [])[0]!;
      const short = v1Hash.slice(0, 8);

      run(`rewind r.txt ${short}`);
      expect(run('read r.txt').trim()).toBe('v1');
    });

    it('refuses to rewind to a deleted snapshot', () => {
      run('write d.txt "hello"');
      run('rm d.txt');
      const history = run('history d.txt');
      const deletedHash = (history.match(/[a-f0-9]{64}/g) ?? []).pop()!;

      const r = runExit(`rewind d.txt ${deletedHash}`);
      expect(r.status).toBe(1);
    });

    it('errors on unknown hash', () => {
      run('write r.txt "v1"');
      const r = runExit(
        'rewind r.txt deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
      );
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('No snapshot found for r.txt');
    });
  });

  describe('rm / restore', () => {
    it('soft-deletes then restores', () => {
      run('write restore.txt "original"');
      run('rm restore.txt');
      expect(runExit('read restore.txt').status).toBe(1);
      run('restore restore.txt');
      expect(run('read restore.txt').trim()).toBe('original');
    });
  });

  describe('write/read roundtrip workflow', () => {
    it('write -> read -> history -> rm -> restore', () => {
      run('write rt.txt "v1"');
      expect(run('read rt.txt').trim()).toBe('v1');
      run('write rt.txt "v2"');
      expect(run('read rt.txt').trim()).toBe('v2');

      const history = run('history rt.txt');
      expect(history.match(/[a-f0-9]{64}/g) ?? []).toHaveLength(2);

      run('rm rt.txt');
      expect(runExit('read rt.txt').status).toBe(1);
      run('restore rt.txt');
      expect(run('read rt.txt').trim()).toBe('v2');
    });
  });

  describe('large multi-chunk content', () => {
    it('round-trips multi-chunk content', () => {
      const content = 'x'.repeat(50000);
      run(`write large.txt "${content}"`);
      expect(run('read large.txt').trim()).toBe(content);
    });
  });
});
