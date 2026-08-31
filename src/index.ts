import { Command } from 'commander';
import { createDirectoryIfNotExists, createFile } from './helper';
import { chunkBuffer } from './helpers/crypto';
import { appendJournal, readJournal, resolveFileState } from './core/journal';
import * as path from 'node:path';
import { OBJECTS_DIR } from './types/constants';
import type { JournalEntry } from './types';
import { readFileSync, existsSync, statSync, watch } from 'node:fs';

const program = new Command();

program
  .name('ghost')
  .description('filesystem that treats time as part of the data')
  .version('1.0.0');

program
  .command('init')
  .description('initialize the ghost managing directory')
  .action(async () => {
    console.log(process.cwd());
    await createDirectoryIfNotExists('./.ghost');

    await createDirectoryIfNotExists('./.ghost/objects');
    await createFile('./.ghost/journal.log');
  });

program
  .command('write <filepath> <content>')
  .description('write content to a file')
  .action((filepath: string, content: string) => {
    const buffer = Buffer.from(content, 'utf-8');
    const chunks = chunkBuffer(buffer);

    appendJournal({
      timestamp: Date.now(),
      filepath,
      chunks,
      size: buffer.length,
      isDeleted: false,
    });
    console.log(`Content written to ${filepath} and journal updated.`);
  });

program
  .command('read <filepath>')
  .description('read content from a file')
  .option('-t, --time <time>', 'read content at a specific time')
  .action((filepath: string, options: { time?: string }) => {
    const time = options.time ? parseInt(options.time) : Date.now();
    const entry = resolveFileState(filepath, time);
    if (!entry || entry.chunks.length === 0) {
      console.log(
        `No content found for ${filepath} at time ${new Date(time).toLocaleDateString()}.`,
      );
      process.exit(1);
    }
    const chunkBuffers = entry.chunks.map((hash: string) => {
      const chunkPath = path.join(OBJECTS_DIR, hash.slice(0, 2), hash.slice(2));
      return readFileSync(chunkPath);
    });
    process.stdout.write(Buffer.concat(chunkBuffers).toString('utf-8'));
  });

program
  .command('history <filepath>')
  .description('show the history of changes for a file')
  .action((filepath: string) => {
    const entries = readJournal();
    const fileHistory = entries.filter(
      (e: JournalEntry) => e.filepath === filepath,
    );

    if (fileHistory.length === 0) {
      console.log(`No history found for ${filepath}.`);
      return;
    }
    console.log(`Timeline for ${filepath}:`);
    for (const h of fileHistory) {
      const status = h.isDeleted ? 'deleted' : 'written';
      console.log(
        `- Time: ${new Date(h.timestamp).toLocaleDateString()} | Size: ${String(h.size)} bytes | Status: ${status}`,
      );
    }
  });

program
  .command('rm <filepath>')
  .description(
    'remove a file from the current filesystem while preserving history',
  )
  .action((filepath: string) => {
    appendJournal({
      timestamp: Date.now(),
      filepath,
      chunks: [],
      size: 0,
      isDeleted: true,
    });
    console.log(`File ${filepath} marked as deleted in the journal.`);
  });

program
  .command('ressurect <filepath>')
  .description('restore a soft-deleted file from its history')
  .action((filepath: string) => {
    const entries = readJournal();
    let lastActive: JournalEntry | null = null;

    for (const entry of entries) {
      if (entry.filepath === filepath) {
        if (!entry.isDeleted) {
          lastActive = entry;
        }
      }
    }

    if (!lastActive) {
      console.log(`No active version found for ${filepath}.`);
      process.exit(1);
    }
    appendJournal({
      timestamp: Date.now(),
      filepath,
      chunks: lastActive.chunks,
      size: lastActive.size,
      isDeleted: false,
    });
  });

program
  .command('watch')
  .description('watch for changes in the filesystem')
  .action(() => {
    console.log('Ghost daemon watching directory for changes...');
    const activeTimeouts = new Map<string, NodeJS.Timeout>();

    watch('.', { recursive: true }, (_eventType, filename) => {
      // filename can be null in some cases
      if (
        filename == null ||
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
              appendJournal({
                timestamp: Date.now(),
                filepath: filename,
                chunks,
                size: content.length,
                isDeleted: false,
              });
              console.log(`[Watch] Auto-commited update for ${filename}`);
            }
          }
        }, 300),
      );
    });
  });

program.parse();
