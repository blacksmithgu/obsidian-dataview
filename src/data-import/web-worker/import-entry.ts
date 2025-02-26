/** Entry-point script used by the index as a web worker. */
import { runImport } from "data-import/web-worker/import-impl";
import { Transferable } from "data-model/transferable";
import { CachedMetadata, FileStats } from "obsidian";

/** An import which can fail and raise an exception, which will be caught by the handler. */
function failableImport(path: string, contents: string, stat: FileStats, metadata?: CachedMetadata) {
    if (metadata === undefined || metadata === null) {
        throw Error(`Cannot index file, since it has no Obsidian file metadata.`);
    }

    return runImport(path, contents, stat, metadata);
}

const workerCode = `
// 导入必要的函数和类型
const { runImport } = require("data-import/web-worker/import-impl");
const { Transferable } = require("data-model/transferable");

function failableImport(path, contents, stat, metadata) {
    if (metadata === undefined || metadata === null) {
        throw Error("Cannot index file, since it has no Obsidian file metadata.");
    }
    return runImport(path, contents, stat, metadata);
}

onmessage = async evt => {
    try {
        let { path, contents, stat, metadata } = evt.data;
        let result = await runImport(path, contents, stat, metadata);
        postMessage({ path, result: Transferable.wrap(result) });
    } catch (error) {
        postMessage({ path: evt.data.path, result: Transferable.wrap({ $error: error.message }) });
    }
};
`;

export default workerCode;
