#!/usr/bin/env bun
import { Command } from 'commander';
import { createDirectoryIfNotExists, createFile } from './helper';
import { chunkBuffer, readChunks } from './helpers/crypto';
import { appendJournal, readJournal, resolveFileState, createEntry } from './core/journal';
import * as path from 'node:path';
import type { JournalEntry } from './types';
import { readFileSync, existsSync, statSync, watch } from 'node:fs';

const program = new Command();

program
  .name('ghost')
  .description('temporal filesystem — time is part of the data')
  .version('1.0.0')
  .addHelpText(
    'after',
    `
Examples:
  $ ghost init                          # Initialize repository
  $ ghost write file.txt "content"      # Write content
  $ ghost read file.txt                 # Read latest version
  $ ghost read file.txt -t 1234567890   # Read at timestamp
  $ ghost history file.txt              # Show change history
  $ ghost rm file.txt                   # Soft delete
  $ ghost restore file.txt              # Restore from delete
  $ ghost watch                         # Watch for changes
`
  );

program
  .command('init')
  .description('initialize the ghost repository')
  .action(async () => {
    console.log(process.cwd());
    await createDirectoryIfNotExists('./.ghost');
    await createDirectoryIfNotExists('./.ghost/objects');
    await createFile('./.ghost/journal.log');
    console.log('Ghost repository initialized');
  });

program
  .command('write <filepath> <content>')
  .alias('w')
  .description('write content to a file')
  .action((filepath: string, content: string) => {
    const buffer = Buffer.from(content, 'utf-8');
    const chunks = chunkBuffer(buffer);

    const entry = createEntry({
      filepath,
      chunks: chunks,
      size: buffer.length,
      isDeleted: false,
    });

    appendJournal(entry);
    console.log(
      `Content written to ${filepath} (${chunks.length} chunk${chunks.length !== 1 ? 's' : ''})`
    );
  });

program
  .command('read <filepath>')
  .alias('r')
  .description('read content from a file')
  .option('-t, --time <time>', 'read content at a specific timestamp')
  .action((filepath: string, options: { time?: string }) => {
    const time = options.time ? parseInt(options.time, 10) : Date.now();

    if (Number.isNaN(time)) {
      console.error('Invalid timestamp');
      process.exit(1);
    }

    const entry = resolveFileState(filepath, time);

    if (!entry || entry.chunks.length === 0) {
      console.error(`No content found for ${filepath} at ${new Date(time).toISOString()}`);
      process.exit(1);
    }

    const content = readChunks(entry.chunks);
    process.stdout.write(content.toString('utf-8'));
  });

program
  .command('history <filepath>')
  .alias('h')
  .description('show the history of changes for a file')
  .action((filepath: string) => {
    const entries = readJournal();
    const fileHistory = entries.filter((e: JournalEntry) => e.filepath === filepath);

    if (fileHistory.length === 0) {
      console.log(`No history found for ${filepath}.`);
      return;
    }

    console.log(`Timeline for ${filepath}:`);
    for (const entry of fileHistory) {
      const status = entry.isDeleted ? 'deleted' : 'written';
      const time = new Date(Number(entry.timestamp)).toISOString();
      console.log(
        `- ${time} | ${entry.size} bytes | ${status} | ${entry.chunks.length} chunk${entry.chunks.length !== 1 ? 's' : ''}`
      );
    }
  });

program
  .command('rm <filepath>')
  .alias('delete')
  .description('remove a file from the current filesystem while preserving history')
  .action((filepath: string) => {
    const entry = createEntry({
      filepath,
      chunks: [],
      size: 0,
      isDeleted: true,
    });
    appendJournal(entry);
    console.log(`File ${filepath} marked as deleted in the journal.`);
  });

program
  .command('restore <filepath>')
  .alias('undel')
  .description('restore a soft-deleted file from its history')
  .action((filepath: string) => {
    const entries = readJournal();
    let lastActive: JournalEntry | null = null;

    for (const entry of entries) {
      if (entry.filepath === filepath && !entry.isDeleted) {
        lastActive = entry;
      }
    }

    if (!lastActive) {
      console.error(`No active version found for ${filepath}.`);
      process.exit(1);
    }

    const entry = createEntry({
      filepath,
      chunks: [...lastActive.chunks],
      size: Number(lastActive.size),
      isDeleted: false,
    });

    appendJournal(entry);
    console.log(
      `File ${filepath} restored from ${new Date(Number(lastActive.timestamp)).toISOString()}`
    );
  });

program
  .command('watch')
  .alias('daemon')
  .description('watch for changes in the filesystem')
  .action(() => {
    console.log('Ghost daemon watching directory for changes...');
    const activeTimeouts = new Map<string, NodeJS.Timeout>();

    watch('.', { recursive: true }, (_eventType, filename) => {
      if (
        filename === null ||
        filename === undefined ||
        filename.startsWith('ghost') ||
        filename.endsWith('~$*')
      ) {
        return;
      }

      if (activeTimeouts.has(filename)) {
        clearTimeout(activeTimeouts.get(filename));
      }

      activeTimeouts.set(
        filename,
        setTimeout(() => {
          const fullPath = path.resolve(filename);
          if (existsSync(fullPath) && statSync(fullPath).isFile()) {
            const content = readFileSync(fullPath);
            const chunks = chunkBuffer(content);

            const current = resolveFileState(filename);
            const latestHashStr = JSON.stringify(current?.chunks ?? []);
            const newHashStr = JSON.stringify(chunks);

            if (latestHashStr !== newHashStr) {
              const entry = createEntry({
                filepath: filename,
                chunks: chunks,
                size: content.length,
                isDeleted: false,
              });
              appendJournal(entry);
              console.log(`[Watch] Auto-committed update for ${filename}`);
            }
          }
        }, 300)
      );
    });
  });

program.parse();
