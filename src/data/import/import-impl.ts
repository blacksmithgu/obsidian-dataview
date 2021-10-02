import { ParsedMarkdown, parseMarkdown } from "data/parse/markdown";

export function runImport(path: string, contents: string): ParsedMarkdown {
    return parseMarkdown(
        path,
        contents,
        /[_\*~`]*([0-9\w\p{Letter}][-0-9\w\p{Letter}\p{Extended_Pictographic}\s/]*)[_\*~`]*\s*::\s*(.+)/u
    );
}
