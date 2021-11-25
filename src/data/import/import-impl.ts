/** Actual raw implementation for the background importer. Mainly handles message passing. */

import { ParsedMarkdown, parseMarkdown } from "data/parse/markdown-file";
import { CachedMetadata } from "obsidian";

export function runImport(path: string, contents: string, metadata: CachedMetadata): ParsedMarkdown {
    return parseMarkdown(
        path,
        metadata,
        contents,
        /[_\*~`]*([0-9\w\p{Letter}][-0-9\w\p{Letter}\p{Extended_Pictographic}\s/]*)[_\*~`]*\s*::\s*(.+)/u
    );
}
