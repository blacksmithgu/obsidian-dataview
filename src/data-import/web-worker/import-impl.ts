/** Actual import implementation backend. This must remain separate from `import-entry` since it is used without web workers. */
import { parsePage } from "data-import/markdown-file";
import { PageMetadata } from "data-model/markdown";
import { CachedMetadata, FileStats } from "obsidian";

export function runImport(
    path: string,
    contents: string,
    stats: FileStats,
    metadata: CachedMetadata
): Partial<PageMetadata> {
    return parsePage(path, contents, stats, metadata);
}
