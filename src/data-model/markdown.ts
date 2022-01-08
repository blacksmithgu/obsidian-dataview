import { getExtension, getFileTitle, getParentFolder, stripTime } from "util/normalize";
import { DateTime } from "luxon";
import type { FullIndex } from "data-index/index";
import { DataObject } from "index";
import { MarkdownBlock } from "data-source/parsers/markdown";
import { LiteralValue, Values } from "data-model/value";
import { Link } from "data-model/link";

/** The source of a specific markdown field; useful for editing markdown fields inline. */
export type MarkdownFieldContext =
    | { type: "frontmatter" }
    | { type: "line"; block: MarkdownBlock; line: number; count: number }
    | { type: "inline"; block: MarkdownBlock; line: number; col: number; length: number };

/** A single markdown metadata field in a file. */
export interface MarkdownField {
    /** The normalized key for this field. */
    key: string;
    /** The raw key for this field before any post-processing or normalization. */
    rawKey: string;
    /** The raw value for this field before any parsing. This will be empty for complex types like lists. */
    rawValue: string;
    /** The parsed and normalized value for this field. */
    value: LiteralValue;
    /** Where this markdown field came from. */
    context: MarkdownFieldContext;
}

/** A link inside of a markdown document. */
export interface MarkdownLink {
    /** The actual raw link. */
    value: Link;
    /** The immediate context for this link - generally the paragraph or list element it appears in. */
    context: { type: "markdown"; block: MarkdownBlock; line: number; col: number; length: number };
    /** The style of this link; either [[Obsidian]] or [Markdown](). */
    style: "obsidian" | "markdown";
}

/** Context for where a tag is found. */
export type MarkdownTagContext =
    | { type: "frontmatter" }
    | { type: "markdown"; block: MarkdownBlock; line: number; col: number; length: number };

/** A tag inside of a markdown document. */
export interface MarkdownTag {
    /** The raw tag (including the starting '#'.) */
    value: string;
    /**
     * The immediate context for this tag - generally the paragraph or list element it appears in. For tags, could also
     * come from frontmatter.
     */
    context: MarkdownTagContext;
}

/**
 * A list item; list items are tracked specially and have custom rendering in other views, so they are included as a
 * value type.
 */
export class ListItem {
    /** The symbol used to define this list item ('*', '-' or '+'). */
    symbol: string;
    /** The line this list element shows up on. */
    line: number;
    /** A link to the file that this task is contained in. */
    file: Link;
    /** A link to the section that contains this list element; could be a file if this is not in a section. */
    section: Link;
    /** A link which points to this task, or to the closest block that this task is contained in. */
    link: Link;
    /** The line number for the first list item in the list this item belongs to. */
    list: number;
    /** The line number of the parent list item, if present; if this is undefined, this is a root item. */
    parent?: number;
    /**
     * The line numbers of list items underneath of this list item. This is not an actual reference to reduce
     *
     */
    children: number[];
    /** The block ID for this item, if one is present. */
    blockId?: string;
    /**
     * The raw contents of this item - this can contain newlines if there are multiple lines to the list element,
     * as well as raw markdown (codeblocks, blockquotes, and so on).
     */
    text: string;

    /** If present, then contains various task metadata about the task for this list item. */
    task?: {
        /** The status character inside the brackets ('-'). */
        status: string;
        /** Whether or not this task was completed. */
        completed: boolean;
        /** Whether or not this task and all of it's subtasks are completed. */
        fullyCompleted: boolean;

        /** Additional metadata like inline annotations. */
        fields: MarkdownField[];
        /** Any tags inside of this tag. */
        tags: MarkdownTag[];
        /** Any links inside of this task. */
        links: MarkdownLink[];
    };

    constructor(init: Partial<ListItem>) {
        Object.assign(this, init);
    }

    /** Convert this list element to markdown. */
    public markdown(): string {
        return `${this.symbol} ${this.text}`;
    }

    /** Return an object copy of this which is safe for API usage. */
    public toObject(inlineAnnotations: boolean = true): Record<string, LiteralValue> {
        let base: Record<string, LiteralValue> = {
            symbol: this.symbol,
            line: this.line,
            file: this.file,
            section: this.section,
            link: this.link,
            listId: this.list,
            children: this.children,
            text: this.text,
            parent: this.parent as any,
            blockId: this.blockId as any,
        };

        if (this.task) {
            base.task = true;
            base.fields = Values.unsafeCopy(this.task.fields) as any;
            base.tags = Array.from(new Set(this.task.tags.map(t => t.value)));
            addMarkdownFields(this.task.fields, base, [
                "symbol",
                "line",
                "file",
                "section",
                "link",
                "listId",
                "children",
                "text",
                "parent",
                "blockId",
            ]);
        } else {
            base.task = false;
        }

        return base;
    }

    /** Convert a raw object to a ListElement; this will automatically detect if the object is a task. */
    public static fromObject(data: ListItem | Record<string, LiteralValue>): ListItem {
        return new ListItem(data);
    }
}

/** All extracted section metadata obtained from a file. */
export class SectionMetadata {
    /** The name of this section. */
    public title: string;
    /** The level of the heading for this section. */
    public level: number;
    /** The (inclusive) line that this section starts on. */
    public start: number;
    /** The (inclusive) line that this section ends on. */
    public end: number;
    /** A link to the file that this section is in. */
    public file: Link;
    /** All of the fields inside of this section. */
    public fields: MarkdownField[];
    /** All of the links - resolved and unresolved - in this section. */
    public links: MarkdownLink[];
    /** Tasks contained in this specific section. */
    public lists: ListItem[];
    /** All of the tags contained in this specific section. */
    public tags: MarkdownTag[];

    public constructor(title: string, level: number, init?: Partial<SectionMetadata>) {
        Object.assign(this, init);

        this.title = title;
        this.level = level;
        this.fields = this.fields ?? [];
        this.links = this.links ?? [];
        this.lists = this.lists ?? [];
        this.tags = this.tags ?? [];
    }

    /** Return a set of tags AND all of their parent tags (so #hello/yes would become #hello, #hello/yes). */
    public fullTags(): Set<string> {
        let result = new Set<string>();
        for (let tag of this.tags) {
            for (let subtag of PageMetadata.parseSubtags(tag.value)) result.add(subtag);
        }

        return result;
    }

    public toObject(index: FullIndex): Record<string, LiteralValue> {
        let result: any = {
            meta: {
                file: this.file,
                link: Link.header(this.file.path, this.title),
                title: this.title,
                level: this.level,
                start: this.start,
                end: this.end,
                fields: Values.unsafeCopy(this.fields),
                links: Values.unsafeCopy(this.links),
                outlinks: this.links.map(l => l.value),
                lists: this.lists.map(l => l.toObject(true)),
                tags: Array.from(this.fullTags()),
                etags: Array.from(new Set(this.tags.map(t => t.value))),
            },
        };

        return addMarkdownFields(this.fields, result, ["meta"]);
    }
}

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
    public fields: MarkdownField[];
    /** All of the exact tags (prefixed with '#') in this file overall. */
    public tags: MarkdownTag[];
    /** All of the aliases defined for this file. */
    public aliases: Set<string>;
    /** All OUTGOING links (including embeds, header + block links) in this file. */
    public links: MarkdownLink[];
    /** All list items contained within this file. */
    public lists: ListItem[];
    /** The raw frontmatter for this document. */
    public frontmatter: Record<string, LiteralValue>;
    /** Full metadata for all of the sections contained in this page. */
    public sections: SectionMetadata[];

    public constructor(path: string, init?: Partial<PageMetadata>) {
        Object.assign(this, init);
        this.path = path;

        this.fields = this.fields ?? [];
        this.tags = this.tags ?? [];
        this.aliases = this.aliases ?? new Set<string>();
        this.links = this.links ?? [];
        this.lists = this.lists ?? [];
        this.frontmatter = this.frontmatter ?? {};
        this.sections = this.sections ?? [];
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

    /** Return a set of the exact tags referenced in this page. */
    public exactTags(): Set<string> {
        return new Set(this.tags.map(l => l.value));
    }

    /** Return a set of tags AND all of their parent tags (so #hello/yes would become #hello, #hello/yes). */
    public fullTags(): Set<string> {
        let result = new Set<string>();
        for (let tag of this.exactTags()) {
            for (let subtag of PageMetadata.parseSubtags(tag)) result.add(subtag);
        }

        return result;
    }

    /** Map this metadata to a full object; uses the index for additional data lookups.  */
    public toObject(index: FullIndex): Record<string, LiteralValue> {
        let rawLists = this.lists.map(t => t.toObject(true));

        let result: any = {
            file: {
                path: this.path,
                folder: this.folder(),
                name: this.name(),
                link: Link.file(this.path),
                ctime: this.ctime,
                cday: stripTime(this.ctime),
                mtime: this.mtime,
                mday: stripTime(this.mtime),
                size: this.size,
                ext: this.extension(),
                etags: Array.from(this.exactTags()),
                tags: Array.from(this.fullTags()),
                aliases: Array.from(this.aliases),
                lists: rawLists,
                tasks: rawLists.filter(t => t.task),
                frontmatter: Values.deepCopy(this.frontmatter),

                outlinks: this.fileLinks(),
                inlinks: Array.from(index.links.getInverse(this.path)).map(l => Link.file(l, false)),
            },
        };

        // Add the current day if present.
        if (this.day) result.file.day = this.day;

        return addMarkdownFields(this.fields, result, ["file"]);
    }
}

/** Append markdown fields to the given target object. This will group together duplicate field names. */
export function addMarkdownFields(fields: MarkdownField[], target: DataObject, ignored?: string[]): DataObject {
    let groups: Map<string, LiteralValue[]> = new Map();
    for (let field of fields) {
        if (!groups.has(field.key)) groups.set(field.key, [field.value]);
        else groups.get(field.key)!.push(field.value);

        if (field.rawKey != field.key) {
            if (!groups.has(field.rawKey)) groups.set(field.rawKey, [field.value]);
            else groups.get(field.rawKey)!.push(field.rawKey);
        }
    }

    for (let [key, values] of groups) {
        if (ignored && ignored.contains(key)) continue;

        target[key] = values.length == 1 ? values[0] : values;
    }

    return target;
}
