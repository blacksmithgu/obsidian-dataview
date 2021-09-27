/** Entry-point script used by the index as a web worker. */

import { Transferable } from "data/transferable";
import { parseMarkdown } from "data/import/markdown";

onmessage = async evt => {
    let parsed = parseMarkdown(
        evt.data.path,
        evt.data.contents,
        /[_\*~`]*([0-9\w\p{Letter}][-0-9\w\p{Letter}\p{Extended_Pictographic}\s/]*)[_\*~`]*\s*::\s*(.+)/u
    );

    (postMessage as any)({ path: evt.data.path, result: Transferable.transferable(parsed) });
};
