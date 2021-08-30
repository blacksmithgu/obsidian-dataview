import { canonicalizeVarName, getExtension, getFileTitle, getParentFolder } from "util/normalize";
import { getAllTags, MetadataCache, parseFrontMatterAliases, parseFrontMatterTags, TFile } from "obsidian";
import { EXPRESSION } from "expression/parse";
import { DateTime } from "luxon";
import { FullIndex } from "data/index";
import { DataObject, Link, LiteralValue, TransferableValue, TransferableValues, Values, Task } from "./value";

interface BaseLinkMetadata {
    path: string;
    /** The display string for this link. */
    display?: string;
    /** If true, this is an *embed* link. */
    embed: boolean;
}

export interface HeaderLinkMetadata extends BaseLinkMetadata {
    type: "header";
    header: string;
}

export interface BlockLinkMetadata extends BaseLinkMetadata {
    type: "block";
    blockId: string;
}

export interface FileLinkMetadata extends BaseLinkMetadata {
    type: "file";
}

/** A link inside a markdown file. */
export type LinkMetadata = HeaderLinkMetadata | BlockLinkMetadata | FileLinkMetadata;

/** All extracted markdown file metadata obtained from a file. */
export class PageMetadata {
    /** The path this file exists at. */
    public path: string;
    /** Obsidian-provided date this page was created. */
    public ctime: DateTime;
    /** Obsidian-provided date this page was modified. */
    public mtime: DateTime;
    /** Obsidian-provided size of this page in bytes. */
    public size: number;
    /** The day associated with this page, if relevant. */
    public day?: DateTime;
    /** The first H1/H2 header in the file. May not exist. */
    public title?: string;
    /** All of the fields contained in this markdown file - both frontmatter AND in-file links. */
    public fields: Map<string, LiteralValue>;
    /** All of the exact tags (prefixed with '#') in this file overall. */
    public tags: Set<string>;
    /** All of the aliases defined for this file. */
    public aliases: Set<string>;
    /** All OUTGOING links (including embeds, header + block links) in this file. */
    public links: LinkMetadata[];
    /** All tasks contained within this file. */
    public tasks: Task[];

    public constructor(path: string, init?: Partial<PageMetadata>) {
        this.path = path;
        this.fields = new Map<string, LiteralValue>();
        this.tags = new Set<string>();
        this.aliases = new Set<string>();
        this.links = [];
        Object.assign(this, init);

        this.tasks = (init?.tasks || []).map(t => new Task(t));
    }

    /** Parse all subtags out of the given tag. I.e., #hello/i/am would yield [#hello/i/am, #hello/i, #hello]. */
    public static parseSubtags(tag: string): string[] {
        let result = [tag];
        while (tag.includes("/")) {
            tag = tag.substring(0, tag.lastIndexOf("/"));
            result.push(tag);
        }

        return result;
    }

    /** The name (based on path) of this file. */
    public name(): string {
        return getFileTitle(this.path);
    }

    /** The containing folder (based on path) of this file. */
    public folder(): string {
        return getParentFolder(this.path);
    }

    /** The extension of this file (likely 'md'). */
    public extension(): string {
        return getExtension(this.path);
    }

    /** Return a set of tags AND all of their parent tags (so #hello/yes would become #hello, #hello/yes). */
    public fullTags(): Set<string> {
        // TODO: Memoize this, probably.
        let result = new Set<string>();
        for (let tag of this.tags) {
            for (let subtag of PageMetadata.parseSubtags(tag)) result.add(subtag);
        }

        return result;
    }

    /** Convert all links in this file to file links. */
    public fileLinks(): FileLinkMetadata[] {
        return this.links.map(link => {
            switch (link.type) {
                case "file":
                    return link;
                case "block":
                    return {
                        type: "file",
                        path: link.path,
                        display: link.display,
                        embed: link.embed,
                    } as FileLinkMetadata;
                case "header":
                    return {
                        type: "file",
                        path: link.path,
                        display: link.display,
                        embed: link.embed,
                    } as FileLinkMetadata;
            }
        });
    }

    /** Map this metadata to a full object; uses the index for additional data lookups.  */
    public toObject(index: FullIndex): Record<string, LiteralValue> {
        // Static fields first. Note this object should not have any pointers to the original object (so that the
        // index cannot accidentally be mutated).
        let result: Record<string, LiteralValue> = {
            file: {
                path: this.path,
                folder: this.folder(),
                name: this.name(),
                link: Link.file(this.path, false),
                outlinks: this.fileLinks().map(l => Link.file(l.path, false)),
                inlinks: Array.from(index.links.getInverse(this.path)).map(l => Link.file(l, false)),
                etags: Array.from(this.tags),
                tags: Array.from(this.fullTags()),
                aliases: Array.from(this.aliases),
                tasks: this.tasks.map(t => t.toObject()),
                ctime: this.ctime,
                cday: DateTime.fromObject({ year: this.ctime.year, month: this.ctime.month, day: this.ctime.day }),
                mtime: this.mtime,
                mday: DateTime.fromObject({ year: this.mtime.year, month: this.mtime.month, day: this.mtime.day }),
                size: this.size,
                ext: this.extension(),
            },
        };

        // Add the current day if present.
        if (this.day) (result["file"] as Record<string, LiteralValue>)["day"] = this.day;

        // Then append the computed fields.
        for (let [key, value] of this.fields) {
            if (key === "file") continue; // Don't allow fields to override 'file'.
            result[key] = value;
        }

        return result;
    }
}

/**
 * Partial metadata object which contains all the information extracted from raw markdown. This is combined with the
 * metadata cache to generate the final PageMetadata object.
 */
export interface ParsedMarkdown {
    tasks: Task[];
    fields: Map<string, LiteralValue[]>;
}

/** Encoded parsed markdown which can be transfered over the JavaScript web worker. */
export interface TransferableMarkdown {
    tasks: TransferableValue[];
    fields: Map<string, TransferableValue[]>;
}

/** Convert parsed markdown to a transfer-friendly result. */
export function markdownToTransferable(parsed: ParsedMarkdown): TransferableMarkdown {
    let newFields = new Map<string, TransferableValue[]>();
    for (let [key, values] of parsed.fields.entries()) {
        newFields.set(
            key,
            values.map(t => TransferableValues.transferable(t))
        );
    }

    return {
        tasks: TransferableValues.transferable(parsed.tasks) as TransferableValue[],
        fields: newFields,
    };
}

/** Convert transfer-friendly markdown to a result we can actually index and use. */
export function markdownFromTransferable(parsed: TransferableMarkdown): ParsedMarkdown {
    let newFields = new Map<string, LiteralValue[]>();
    for (let [key, values] of parsed.fields.entries()) {
        newFields.set(
            key,
            values.map(t => TransferableValues.value(t))
        );
    }

    return {
        tasks: TransferableValues.value(parsed.tasks) as Task[],
        fields: newFields,
    };
}

/** Convert any importable metadata to something that can be transferred. */
export function toTransferable(value: ParsedMarkdown | DataObject[]): TransferableMarkdown | TransferableValue {
    if ("tasks" in value) return markdownToTransferable(value);
    else return TransferableValues.transferable(value);
}

/** Convert any transferable metadata back to Dataview API friendly data. */
export function fromTransferable(value: TransferableValue | TransferableMarkdown): ParsedMarkdown | DataObject[] {
    if (value != null && typeof value == "object" && "tasks" in value)
        return markdownFromTransferable(value as TransferableMarkdown);
    else return TransferableValues.value(value) as DataObject[];
}

/** Try to extract a YYYYMMDD date from a string. */
function extractDate(str: string): DateTime | undefined {
    let dateMatch = /(\d{4})-(\d{2})-(\d{2})/.exec(str);
    if (!dateMatch) dateMatch = /(\d{4})(\d{2})(\d{2})/.exec(str);
    if (dateMatch) {
        let year = Number.parseInt(dateMatch[1]);
        let month = Number.parseInt(dateMatch[2]);
        let day = Number.parseInt(dateMatch[3]);
        return DateTime.fromObject({ year, month, day });
    }

    return undefined;
}

/** Attempt to find a date associated with the given page from metadata or filenames. */
function findDate(file: string, fields: Map<string, LiteralValue>): DateTime | undefined {
    for (let key of fields.keys()) {
        if (!(key.toLocaleLowerCase() == "date" || key.toLocaleLowerCase() == "day")) continue;

        let value = fields.get(key) as LiteralValue;
        if (Values.isDate(value)) return value;
        else if (Values.isLink(value)) {
            let date = extractDate(value.path);
            if (date) return date;

            date = extractDate(value.subpath ?? "");
            if (date) return date;

            date = extractDate(value.display ?? "");
            if (date) return date;
        }
    }

    return extractDate(getFileTitle(file));
}

/** Recursively convert frontmatter into fields. We have to dance around YAML structure. */
export function parseFrontmatter(value: any): LiteralValue {
    if (value == null) {
        return null;
    } else if (typeof value === "object") {
        if (Array.isArray(value)) {
            let result = [];
            for (let child of value as Array<any>) {
                result.push(parseFrontmatter(child));
            }

            return result;
        } else {
            let object = value as Record<string, any>;
            let result: Record<string, LiteralValue> = {};
            for (let key in object) {
                result[key] = parseFrontmatter(object[key]);
            }

            return result;
        }
    } else if (typeof value === "number") {
        return value;
    } else if (typeof value === "boolean") {
        return value;
    } else if (typeof value === "string") {
        let dateParse = EXPRESSION.date.parse(value);
        if (dateParse.status) return dateParse.value;

        let durationParse = EXPRESSION.duration.parse(value);
        if (durationParse.status) return durationParse.value;

        let linkParse = EXPRESSION.embedLink.parse(value);
        if (linkParse.status) return linkParse.value;

        return value;
    }

    // Backup if we don't understand the type.
    return null;
}

/** Parse a textual inline field value into something we can work with. */
export function parseInlineField(value: string): LiteralValue {
    // The stripped literal field parser understands all of the non-array/non-object fields and can parse them for us.
    // Inline field objects are not currently supported; inline array objects have to be handled by the parser
    // separately.
    let inline = EXPRESSION.inlineField.parse(value);
    if (inline.status) return inline.value;
    else return value;
}

/** Add an inline field to a nexisting field array, converting a single value into an array if it is present multiple times. */
export function addInlineField(fields: Map<string, LiteralValue>, name: string, value: LiteralValue) {
    if (fields.has(name)) {
        let existing = fields.get(name) as LiteralValue;
        if (Values.isArray(existing)) fields.set(name, existing.concat([value]));
        else fields.set(name, [existing, value]);
    } else {
        fields.set(name, value);
    }
}

/** Matches lines of the form "- [ ] <task thing>". */
export const TASK_REGEX = /^(\s*)[-*]\s*(\[[ Xx\.]?\])?\s*([^-*].*)$/iu;

/** Return true if the given predicate is true for the task or any subtasks. */
export function taskAny(t: Task, f: (t: Task) => boolean): boolean {
    if (f(t)) return true;
    for (let sub of t.subtasks) if (taskAny(sub, f)) return true;

    return false;
}

export function alast<T>(arr: Array<T>): T | undefined {
    if (arr.length > 0) return arr[arr.length - 1];
    else return undefined;
}

export const CREATED_DATE_REGEX = /\u{2795}\s*(\d{4}-\d{2}-\d{2})/u;
export const DUE_DATE_REGEX = /[\u{1F4C5}\u{1F4C6}\u{1F5D3}]\s*(\d{4}-\d{2}-\d{2})/u;
export const DONE_DATE_REGEX = /\u{2705}\s*(\d{4}-\d{2}-\d{2})/u;

/**
 * A hacky approach to scanning for all tasks using regex. Does not support multiline
 * tasks yet (though can probably be retro-fitted to do so).
 */
export function findTasksInFile(path: string, file: string): Task[] {
    // Dummy top of the stack that we'll just never get rid of.
    let stack: [Task, number][] = [];
    stack.push([
        new Task({ text: "Root", line: -1, path, completed: false, fullyCompleted: false, real: false, subtasks: [] }),
        -4,
    ]);

    let lineno = 0;
    for (let line of file.replace("\r", "").split("\n")) {
        lineno += 1;

        // Check that we are actually a list element, to skip lines which obviously won't match.
        if (!line.includes("*") && !line.includes("-")) {
            while (stack.length > 1) stack.pop();
            continue;
        }

        let match = TASK_REGEX.exec(line);
        if (!match) {
            if (line.trim().length == 0) continue;

            // Non-empty line that is not a task, reset.
            while (stack.length > 1) stack.pop();
            continue;
        }

        let createdMatch = CREATED_DATE_REGEX.exec(line);
        let createdDate;
        if (createdMatch) {
            createdDate = DateTime.fromISO(createdMatch[1]);
        }

        let dueMatch = DUE_DATE_REGEX.exec(line);
        let dueDate;
        if (dueMatch) {
            dueDate = DateTime.fromISO(dueMatch[1]);
        }

        let completedMatch = DONE_DATE_REGEX.exec(line);
        let completedDate;
        if (completedMatch) {
            completedDate = DateTime.fromISO(completedMatch[1]);
        }

        let indent = match[1].replace("\t", "    ").length;
        let isReal = !!match[2] && match[2].trim().length > 0;
        let isCompleted = !isReal || match[2] == "[X]" || match[2] == "[x]";
        let task = new Task({
            text: match[3],
            completed: isCompleted,
            completedDate: completedDate,
            createdDate: createdDate,
            dueDate: dueDate,
            fullyCompleted: isCompleted,
            real: isReal,
            path,
            line: lineno,
            subtasks: [],
        });

        while (indent <= (alast(stack)?.[1] ?? -4)) stack.pop();

        for (let [elem, _] of stack) elem.fullyCompleted = elem.fullyCompleted && task.fullyCompleted;
        alast(stack)?.[0].subtasks.push(task);
        stack.push([task, indent]);
    }

    // Return everything under the root, which should be all tasks.
    // Strip trees of tasks which are purely not real (lol?).
    return stack[0][0].subtasks.filter(t => taskAny(t, st => st.real));
}

export function parseMarkdown(path: string, contents: string, inlineRegex: RegExp): ParsedMarkdown {
    let fields: Map<string, LiteralValue[]> = new Map();

    // Trawl through file contents to locate custom inline file content...
    for (let line of contents.split("\n")) {
        // Fast bail-out for lines that are too long.
        if (!line.includes("::")) continue;
        line = line.trim();

        let match = inlineRegex.exec(line);
        if (!match) continue;

        let name = match[1].trim();
        let inlineField = parseInlineField(match[2]);

        fields.set(name, (fields.get(name) ?? []).concat([inlineField]));
        let simpleName = canonicalizeVarName(match[1].trim());
        if (simpleName.length > 0 && simpleName != match[1].trim()) {
            fields.set(simpleName, (fields.get(simpleName) ?? []).concat([inlineField]));
        }
    }

    // And extract tasks...
    let tasks = findTasksInFile(path, contents);

    return { fields, tasks };
}

/** Extract markdown metadata from the given Obsidian markdown file. */
export function parsePage(file: TFile, cache: MetadataCache, markdownData: ParsedMarkdown): PageMetadata {
    let tags = new Set<string>();
    let aliases = new Set<string>();
    let fields = new Map<string, LiteralValue>();

    // Pull out the easy-to-extract information from the cache first...
    let fileCache = cache.getFileCache(file);
    if (fileCache) {
        // File tags, including front-matter and in-file tags.
        getAllTags(fileCache)?.forEach(t => tags.add(t));

        // Front-matter file tags, aliases, AND frontmatter properties.
        if (fileCache.frontmatter) {
            let frontTags = parseFrontMatterTags(fileCache.frontmatter);
            if (frontTags) {
                for (let tag of frontTags) {
                    if (!tag.startsWith("#")) tag = "#" + tag;
                    tags.add(tag);
                }
            }

            let frontAliases = parseFrontMatterAliases(fileCache.frontmatter);
            if (frontAliases) {
                for (let alias of frontAliases) aliases.add(alias);
            }

            let frontFields = parseFrontmatter(fileCache.frontmatter) as Record<string, LiteralValue>;
            for (let [key, value] of Object.entries(frontFields)) fields.set(key, value);
        }
    }

    // Grab links from the frontmatter cache.
    let links: LinkMetadata[] = [];
    if (file.path in cache.resolvedLinks) {
        for (let resolved in cache.resolvedLinks[file.path]) {
            links.push({
                type: "file",
                path: resolved,
                display: resolved,
                embed: false,
            });
        }
    }

    // Merge frontmatter fields with parsed fields.
    for (let [name, values] of markdownData.fields.entries()) {
        for (let value of values) addInlineField(fields, name, value);
    }

    return new PageMetadata(file.path, {
        fields,
        tags,
        aliases,
        links,
        tasks: markdownData.tasks,
        ctime: DateTime.fromMillis(file.stat.ctime),
        mtime: DateTime.fromMillis(file.stat.mtime),
        size: file.stat.size,
        day: findDate(file.path, fields),
    });
}
