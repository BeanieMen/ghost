export type SUBCOMMANDS = 'write' | 'read' | 'history' | 'rm' | 'ressurect' | 'watch';

export interface JournalEntry {
  timestamp: number;
  filepath: string;
  chunks: string[];
  size: number;
  isDeleted: boolean;
}
