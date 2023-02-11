/** Actual import implementation backend. This must remain separate from `import-entry` since it is used without web workers. */
import { parseCanvasNode } from "data-import/canvas-file";
import { parsePage } from "data-import/markdown-file";
import { PageMetadata } from "data-model/markdown";
import { CachedMetadata, FileStats } from "obsidian";

export function runImport(
    path: string,
    contents: string,
    stats: FileStats,
    metadata: CachedMetadata
): Partial<PageMetadata> {
    if (path.endsWith(".canvas")) return parseCanvasNode(path, contents, stats);
    return parsePage(path, contents, stats, metadata);
}
