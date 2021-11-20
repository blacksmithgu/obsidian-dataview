/** Number of spaces that a tab is equal to. */
const TAB_TO_SPACES = 4;
/** Threshold at which a line is considered indented for making code blocks. */
const SPACE_THRESHOLD = TAB_TO_SPACES;

/**
 * A list element inside of a markdown list. These are a little complex, but are split up into the following components,
 * for which there is a little bit of overlap:
 * - text: The text content immediately at the start of this list element.
 * - content: ALL subblocks under this list.
 * - children: ALL list elements under this list element; this trims out markdown blocks in between child list elements.
 */
export type MarkdownListElement = {
    symbol: string;
    task?: string;
    contents: MarkdownBlock[];
    children: MarkdownListElement[];
    text: MarkdownBlock[];
    line: number;
};

/** A markdown block inside of a markdown document. */
export type MarkdownBlock =
    | { type: "paragraph"; contents: string[]; line: number }
    | { type: "codeblock"; delimiter: string; contents: string[]; languages: string[]; line: number; indented: boolean }
    | { type: "list"; elements: MarkdownListElement[]; line: number }
    | { type: "rule"; symbol: string; count: number }
    | { type: "blockquote"; contents: string[]; line: number }
    | { type: "heading"; level: number; text: string; line: number; ruling: boolean };

/**
 * Semantically significant markdown lines; lines are first parsed into this before being combined into blocks
 * to ease awkward context-dependent parts of Markdown.
 */
export type MarkdownLine =
    | { type: "empty"; indent: number }
    | { type: "text"; text: string; indent: number }
    | { type: "list-element"; symbol: string; task?: string; text: string; indent: number }
    | { type: "blockquote"; text: string; indent: number }
    | { type: "heading"; level: number; text: string; indent: number }
    | { type: "ruling"; symbol: string; count: number; indent: number }
    | { type: "heading-ruling"; symbol: string; count: number; indent: number }
    | { type: "codeblock"; symbol: string; count: number; languages: string[]; indent: number };

const HORIZONTAL_RULE = /^(\*{3,}|_{3,})$/u;
const HORIZONTAL_HEADING_RULE = /^(={3,}|-{3,})$/u;
const HEADING = /^(#{1,6})\s+(.*)$/u;
const CODEBLOCK = /^(~{3,}|`{3,})\s*(.*)$/u;
const LIST_ELEMENT = /^([-+*])\s*(\[.?\])?\s*(.*)$/u;

/** Count the amount of indentation at the start of line in spaces, returning [number of spaces, rest of line]. */
export function splitIndent(line: string): [number, string] {
    let count = 0,
        index = 0;

    while (index < line.length) {
        let ch = line.charAt(index);
        if (ch == "\t") count += TAB_TO_SPACES;
        else if (ch == " ") count += 1;
        else break;

        index++;
    }

    return [count, line.substring(index).trim()];
}

/** Reduce the indent (in spaces) on a string by the given amount. */
export function reduceIndent(line: string, amount: number): string {
    let index = 0,
        count = 0;
    while (index < line.length && count < amount) {
        let ch = line.charAt(index);
        if (ch == "\t") count += 4;
        else if (ch == " ") count += 1;

        index++;
    }

    return line.substring(index);
}

/** Classify any line as a markdown line type which is passed on to a renderer. */
export function classifyLine(fullLine: string): MarkdownLine {
    let [indent, line] = splitIndent(fullLine);

    // Empty line.
    if (line === "") return { type: "empty", indent };

    // Blockquotes.
    if (line.startsWith(">")) {
        return { type: "blockquote", text: line.substring(1).trim(), indent };
    }

    // Simple heading via regex matching.
    let headingMatch = HEADING.exec(line);
    if (headingMatch) return { type: "heading", level: headingMatch[1].length, text: headingMatch[2].trim(), indent };

    // Regular horizonal rules.
    let horMatch = HORIZONTAL_RULE.exec(line);
    if (horMatch) return { type: "ruling", symbol: horMatch[1][0], count: horMatch[1].length, indent };

    // (Potentially) heading-creating horizontal rules.
    // Special note: the '---' heading type can also be a normal horizontal rule for some reason; trhis is special-cased
    // when handling headers.
    let horHeaderMatch = HORIZONTAL_HEADING_RULE.exec(line);
    if (horHeaderMatch)
        return { type: "heading-ruling", symbol: horHeaderMatch[1][0], count: horHeaderMatch[1].length, indent };

    // Codeblock starts or ends. Ends with have 'languages' as an empty array.
    let codeblockMatch = CODEBLOCK.exec(line);
    if (codeblockMatch) {
        let languages = codeblockMatch[2]
            .trim()
            .split(/[\s,]+/)
            .filter(l => !!l);
        return { type: "codeblock", symbol: codeblockMatch[1][0], count: codeblockMatch[1].length, indent, languages };
    }

    // List elements.
    let listMatch = LIST_ELEMENT.exec(line);
    if (listMatch)
        return {
            type: "list-element",
            symbol: listMatch[1],
            task: listMatch[2] ? listMatch[2].substring(1, listMatch[2].length - 1).trim() : undefined,
            text: listMatch[3],
            indent,
        };

    // Default to "text".
    return { type: "text", text: line, indent };
}

/** Determines if a given line is empty OR has at least the required indent. */
function emptyLineOrIndented(line: string, requiredIndent: number): boolean {
    if (line.trim() === "") return true;
    return splitIndent(line)[0] >= requiredIndent;
}

/** Parse a markdown file into a collection of markdown blocks. */
export function markdownFile(contents: string): MarkdownBlock[] {
    return markdownBlocks(new LineTokenizer(contents), 0);
}

/** Parse markdown blocks from the given tokenizer that are at atleast the given indent. */
export function markdownBlocks(tokenizer: LineTokenizer, requiredIndent: number): MarkdownBlock[] {
    let blocks: MarkdownBlock[] = [];

    // Continually read blocks from the tokenizer until there is nothing more to parse.
    while (tokenizer.peek() !== undefined && emptyLineOrIndented(tokenizer.peek()!, requiredIndent)) {
        let rawLine = tokenizer.next()!;
        let lineno = tokenizer.lineno();
        let line = classifyLine(rawLine);

        // Highest priority: codeblocks formed via indentation.
        if (line.indent >= requiredIndent + SPACE_THRESHOLD) {
            let contents = tokenizer.takeMap(
                fullLine => {
                    let indent = splitIndent(fullLine)[0];
                    if (indent < requiredIndent + SPACE_THRESHOLD) return undefined;

                    return reduceIndent(fullLine, requiredIndent + SPACE_THRESHOLD);
                },
                [reduceIndent(rawLine, requiredIndent + SPACE_THRESHOLD)]
            );

            blocks.push({
                type: "codeblock",
                languages: [],
                delimiter: "<indented>",
                line: lineno,
                indented: true,
                contents,
            });
            continue;
        }

        // Simple single-line headings.
        if (line.type == "heading") {
            blocks.push({ type: "heading", level: line.level, text: line.text, line: lineno, ruling: false });
            continue;
        }
        // Blockquotes of the form '>'.
        else if (line.type == "blockquote") {
            let contents = tokenizer.takeMap(
                fullLine => {
                    let line = classifyLine(fullLine);
                    return line.type == "blockquote" && line.indent >= requiredIndent ? line.text : undefined;
                },
                [line.text]
            );

            blocks.push({ type: "blockquote", line: lineno, contents });
        }
        // Any of the valid rulings; if we encounter them here, they are not following arbitrary text.
        // The '===' case is handled by the general text handler.
        else if (line.type == "ruling" || (line.type == "heading-ruling" && line.symbol == "-")) {
            blocks.push({ type: "rule", symbol: line.symbol, count: line.count });
            continue;
        }
        // Normal codeblocks wrapped by '```' or '~~~`.
        else if (line.type == "codeblock") {
            // This is implemented via a manual loop so we can properly consume the closing '```' if needed.
            let contents: string[] = [];
            while (tokenizer.peek() !== undefined) {
                let rawCline = tokenizer.peek()!;
                let cline = classifyLine(rawCline);

                // Early terminate on any lines that have a lesser indent. There is no terminator to consume.
                if (cline.indent < line.indent) break;

                // Terminate (consuming the line) on a codeblock end.
                if (
                    cline.type == "codeblock" &&
                    cline.indent == line.indent &&
                    cline.count >= line.count &&
                    cline.symbol == line.symbol &&
                    cline.languages.length == 0
                ) {
                    tokenizer.next();
                    break;
                } else {
                    // Otherwise, this is contents inside of the codeblock.
                    contents.push(reduceIndent(rawCline, line.indent));
                    tokenizer.next();
                }
            }

            blocks.push({
                type: "codeblock",
                delimiter: line.symbol.repeat(line.count),
                languages: line.languages,
                line: lineno,
                indented: false,
                contents,
            });
        }
        // Lists.
        else if (line.type == "list-element") {
            let first = markdownListElement(tokenizer, line.symbol, line.text, lineno, line.indent, line.task);
            blocks.push(markdownList(tokenizer, first));
        }
        // Arbitrary text. This also handles the annoying alternative header type.
        else if (line.type == "text" || (line.type == "heading-ruling" && line.symbol == "=")) {
            markdownTextContinuation(tokenizer, [rawLine], lineno).forEach(b => blocks.push(b));
        }

        // Default case: empty. Just skip the line.
    }

    return blocks;
}

/**
 * Continually parse text lines regardless of indent until another line type is encountered; this
 * will also handle h1 '===' headers, producing an optional terminating 'header' object.
 */
export function markdownTextContinuation(tokenizer: LineTokenizer, initial: string[], lineno: number): MarkdownBlock[] {
    // Take textual lines first...
    let contents = tokenizer.takeMap(
        l => {
            let line = classifyLine(l);
            return line.type == "text" ? line.text : undefined;
        },
        initial.map(t => t.trim())
    );

    // If the terminating line is a header line, then make a header.
    if (tokenizer.peek() !== undefined && classifyLine(tokenizer.peek()!).type == "heading-ruling") {
        tokenizer.next();

        let result: MarkdownBlock[] = [];
        if (contents.length > 1) result.push({ type: "paragraph", contents: contents.slice(0, -2), line: lineno });
        result.push({
            type: "heading",
            level: 1,
            text: contents[contents.length - 1],
            line: lineno + contents.length - 1,
            ruling: true,
        });
        return result;
    } else {
        return [{ type: "paragraph", contents, line: lineno }];
    }
}

export function markdownListElement(
    tokenizer: LineTokenizer,
    symbol: string,
    text: string,
    lineno: number,
    indent: number,
    task?: string
): MarkdownListElement {
    // Fetch any following text lines and combine them into the same text element.
    let followingText = tokenizer.takeMap(
        l => {
            let line = classifyLine(l);
            return line.type == "text" ? line.text : undefined;
        },
        [text.trim()]
    );

    let initialParagraph = { type: "paragraph", contents: followingText, line: lineno } as MarkdownBlock;

    // Then look for any / all markdown blocks that are at least the given indent + 4.
    let subblocks = markdownBlocks(tokenizer, indent + SPACE_THRESHOLD);

    // For the subblocks, concatenate non-list blocks into the base list item, and then discard any non-list elements
    // after that.
    let index = 0;
    let prefix: MarkdownBlock[] = [];
    for (; index < subblocks.length && subblocks[index].type != "list"; index++) prefix.push(subblocks[index]);

    // index is now at the first list element or at the end.
    let children: MarkdownListElement[] = [];
    for (; index < subblocks.length; index++) {
        let item = subblocks[index];
        if (item.type == "list") item.elements.forEach(i => children.push(i));
    }

    return { symbol, contents: subblocks, children, task, text: [initialParagraph].concat(prefix), line: lineno };
}

export function markdownList(tokenizer: LineTokenizer, first: MarkdownListElement): MarkdownBlock {
    let elements = [first];

    while (tokenizer.peek() !== undefined) {
        let line = classifyLine(tokenizer.peek()!);
        if (line.type != "list-element" && line.type != "empty") break;

        tokenizer.next();
        if (line.type == "empty") continue;

        elements.push(
            markdownListElement(tokenizer, line.symbol, line.text, tokenizer.lineno(), line.indent, line.task)
        );
    }

    return { type: "list", elements, line: first.line };
}

//////////////////////////////
// Line Tokenizer Utilities //
//////////////////////////////

/** Simple utility for splitting file contents efficiently into lines, tracking line numbers, and allowing iteration. */
class LineTokenizer {
    private index: number;
    private lineNumber: number;
    private rn: boolean;

    private nextLine: string | undefined;

    public constructor(public contents: string) {
        this.index = 0;
        this.lineNumber = -1;
        this.rn = contents.includes("\r\n");
        this.nextLine = this.rawNext();
    }

    /** Peek at the next line in the input. */
    public peek(): string | undefined {
        return this.nextLine;
    }

    /** Advance the tokenizer to the next line and return the parsed line. */
    public next(): string | undefined {
        let result = this.nextLine;
        this.nextLine = this.rawNext();
        this.lineNumber += 1;

        return result;
    }

    /** Obtain the line number for the last-fetched line. */
    public lineno(): number {
        return this.lineNumber;
    }

    /** Obtain the position that the tokenizer is in the input. */
    public position(): number {
        return this.index;
    }

    /** Seek the tokenize to the given location. */
    public seek(location: number) {
        this.index = Math.max(0, Math.min(location, this.contents.length));
    }

    /** Take consecutive lines until the tokenizer runs out or the predicate returns false. */
    public takeWhile(predicate: (line: string) => boolean, output?: string[]): string[] {
        let result: string[] = output !== undefined ? output : [];
        while (this.peek() !== undefined && predicate(this.peek()!)) result.push(this.next()!);
        return result;
    }

    /**
     * Take elements while the given mapping on them returns non-undefined values; the output results will be the
     * result of the mapping.
     */
    public takeMap(mapping: (line: string) => string | undefined, output?: string[]): string[] {
        let result: string[] = output !== undefined ? output : [];
        while (this.peek() !== undefined) {
            let mapped = mapping(this.peek()!);
            if (mapped === undefined) return result;
            this.next();

            result.push(mapped);
        }

        return result;
    }

    /** Return the next line in the input. */
    private rawNext(): string | undefined {
        if (this.index >= this.contents.length) return undefined;

        let nextBreak = this.contents.indexOf(this.rn ? "\r\n" : "\n", this.index);
        if (nextBreak == -1) nextBreak = this.contents.length;

        let oldPosition = this.index;
        this.index = nextBreak + (this.rn ? 2 : 1);
        return this.contents.substring(oldPosition, nextBreak);
    }
}
