/** Actual import implementation backend. This must remain separate from `import-entry` since it is used without web workers. */
import { parseCanvasCard } from "data-import/canvas-file";
import { parsePage } from "data-import/markdown-file";
import { CanvasCard, CanvasMetadata, CanvasMetadataIndex } from "data-model/canvas";
import { PageMetadata } from "data-model/markdown";
import { CachedMetadata, FileStats } from "obsidian";


// TODO: array.isArray()...
export function runImport(
    path: string,
    contents: string,
    stats: FileStats,
    metadata: CachedMetadata,
    mindex: CanvasMetadataIndex
): Partial<PageMetadata> | CanvasCard[] {
    if (path.endsWith(".canvas")) {
        const data = JSON.parse(contents);
        return (new CanvasMetadata(path, data,
                data.nodes.filter((a: any) => a.type === "text").map((a: any) => {
                    return parseCanvasCard(path, a.id, contents, stats, mindex)
                })
            )).cards
    }
    return parsePage(path, contents, stats, metadata);
}
