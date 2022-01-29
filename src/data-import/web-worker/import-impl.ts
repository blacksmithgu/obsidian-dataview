/** Actual import implementation backend. This must remain separate from `import-entry` since it is used without web workers. */
import { ParsedMarkdown, parseMarkdown } from "data-import/markdown-file";
import { CachedMetadata } from "obsidian";

export function runImport(path: string, contents: string, metadata: CachedMetadata): ParsedMarkdown {
    return parseMarkdown(
        path,
        metadata,
        contents,
        /[_\*~`]*([0-9\w\p{Letter}][-0-9\w\p{Letter}\p{Extended_Pictographic}\s/]*)[_\*~`]*\s*::\s*(.+)/u
    );
}
