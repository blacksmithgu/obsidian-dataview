/** Entry-point script used by the index as a web worker. */

import {parseMarkdown, toTransferable} from './file';

onmessage = async evt => {
    const parsed = await parseMarkdown(
        evt.data.path,
        evt.data.contents,
        /[_\*~`]*([0-9\w\p{Letter}][-0-9\w\p{Letter}\p{Emoji_Presentation}\s/]*)[_\*~`]*\s*::\s*(.+)/u
    );

    (postMessage as any)({path: evt.data.path, result: toTransferable(parsed)});
};
