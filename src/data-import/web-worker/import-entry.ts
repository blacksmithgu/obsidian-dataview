/** Entry-point script used by the index as a web worker. */
import { parsePage } from "data-import/markdown-file";
import { PageMetadata } from "data-model/markdown";
import { Transferable } from "data-model/transferable";
import { CachedMetadata, FileStats } from "obsidian";

/** An import which can fail and raise an exception, which will be caught by the handler. */
function failableImport(path: string, contents: string, stat: FileStats, metadata?: CachedMetadata): PageMetadata {
    if (metadata === undefined || metadata === null) {
        throw Error(`Cannot index file, since it has no Obsidian file metadata.`);
    }

    return parsePage(path, contents, stat, metadata);
}

onmessage = async evt => {
    let start = Date.now();
    try {
        let { path, contents, stat, metadata } = evt.data;
        let result = failableImport(path, contents, stat, metadata);
        (postMessage as any)({
            path: evt.data.path,
            result: Transferable.transferable(result),
            duration: (Date.now() - start) / 1000.0
        });
    } catch (error) {
        console.log(error);
        (postMessage as any)({
            path: evt.data.path,
            result: {
                $error: `Failed to index file: ${evt.data.path}: ${error}`,
                duration: (Date.now() - start) / 1000.0
            },
        });
    }
};
