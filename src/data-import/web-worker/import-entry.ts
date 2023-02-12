/** Entry-point script used by the index as a web worker. */
import { runImport } from "data-import/web-worker/import-impl";
import { CanvasMetadataIndex } from "data-model/canvas";
import { Transferable } from "data-model/transferable";
import { CachedMetadata, FileStats } from "obsidian";

/** An import which can fail and raise an exception, which will be caught by the handler. */
function failableImport(path: string, contents: string, stat: FileStats, mindex: CanvasMetadataIndex, metadata?: CachedMetadata) {
    if (metadata === undefined || metadata === null) {
        throw Error(`Cannot index file, since it has no Obsidian file metadata.`);
    }

    return runImport(path, contents, stat, metadata, mindex);
}

onmessage = async evt => {
    try {
        let { path, contents, stat, metadata, mindex } = evt.data;
        let result = failableImport(path, contents, stat, mindex, metadata);
        (postMessage as any)({ path: evt.data.path, result: Transferable.transferable(result) });
    } catch (error) {
        console.log(error);
        (postMessage as any)({
            path: evt.data.path,
            result: {
                $error: `Failed to index file: ${evt.data.path}: ${error}`,
            },
        });
    }
};
