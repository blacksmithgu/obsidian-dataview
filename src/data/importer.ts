/** Entry-point script used by the index as a web worker. */

import { parseCsv } from "./csv";
import { parseMarkdown, markdownToTransferable } from "./file";
import { TransferableValues } from "./value";

onmessage = async (evt) => {
    if (evt.data.path.endsWith("csv")) {
        let parsed = await parseCsv(evt.data.contents);

        (postMessage as any)({ path: evt.data.path, result: TransferableValues.transferable(parsed) });
    } else {
        let parsed = parseMarkdown(evt.data.path, evt.data.contents,
            /[_\*~`]*([0-9\w\p{Letter}][-0-9\w\p{Letter}\p{Emoji_Presentation}\s/]*)[_\*~`]*\s*::\s*([^\/\/\n]+)/u);

        (postMessage as any)({ path: evt.data.path, result: markdownToTransferable(parsed) });
    }
};
