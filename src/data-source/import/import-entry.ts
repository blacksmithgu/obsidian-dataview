/** Entry-point script used by the index as a web worker. */

import { markdownToMetadata } from "data-source/markdown-file";
import { Transferable } from "data-model/transferable";

onmessage = async evt => {
    let result = markdownToMetadata(evt.data.path, evt.data.contents, evt.data.metadata.stats);
    (postMessage as any)({ path: evt.data.path, result: Transferable.transferable(result) });
};
