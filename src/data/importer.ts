/** Entry-point script used by the index as a web worker. */

import { parseMarkdown, markdownToTransferable } from "./file";

onmessage = async evt => {
    let parsed = parseMarkdown(
        evt.data.path,
        evt.data.contents,
        /[_\*~`]*([0-9\w\p{Letter}][-0-9\w\p{Letter}\p{Extended_Pictographic}\s/]*)[_\*~`]*\s*::\s*(.+)/u
    );

    (postMessage as any)({ path: evt.data.path, result: markdownToTransferable(parsed) });
};
