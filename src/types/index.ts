export type SUBCOMMANDS = "write" | "read" | "history" | "rm" | "ressurect" | "watch";

export interface JournalEntry {
    timestamp: number;
    filepath: string;
    chunks: string[];
    size: number;
    isDeleted: boolean;
}

export { REPO_DIR, OBJECTS_DIR, JOURNAL_FILE } from "./constants";