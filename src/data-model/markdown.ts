import { extractSubtags, getExtension, getFileTitle, getParentFolder, stripTime } from "util/normalize";
import { DateTime } from "luxon";
import type { FullIndex } from "data-index/index";
import { Literal, Link, Values } from "data-model/value";
import { DataObject } from "index";
import { SListItem, SMarkdownPage } from "data-model/serialized/markdown";
import { Pos } from "obsidian";

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
    public fields: Map<string, Literal>;
    /** All of the exact tags (prefixed with '#') in this file overall. */
    public tags: Set<string>;
    /** All of the aliases defined for this file. */
    public aliases: Set<string>;
    /** All OUTGOING links (including embeds, header + block links) in this file. */
    public links: Link[];
    /** All list items contained within this page. Filter for tasks to get just tasks. */
    public lists: ListItem[];
    /** The raw frontmatter for this document. */
    public frontmatter: Record<string, Literal>;

    public constructor(path: string, init?: Partial<PageMetadata>) {
        this.path = path;
        this.fields = new Map<string, Literal>();
        this.frontmatter = {};
        this.tags = new Set<string>();
        this.aliases = new Set<string>();
        this.links = [];

        Object.assign(this, init);

        this.lists = (this.lists || []).map(l => new ListItem(l));
    }

    /** Canonicalize raw links and other data in partial data with normalizers, returning a completed object. */
    public static canonicalize(data: Partial<PageMetadata>, linkNormalizer: (link: Link) => Link): PageMetadata {
        // Mutate the data for now, which is probably a bad idea but... all well.
        if (data.frontmatter) {
            data.frontmatter = Values.mapLeaves(data.frontmatter, t =>
                Values.isLink(t) ? linkNormalizer(t) : t
            ) as DataObject;
        }

        if (data.fields) {
            for (let [key, value] of data.fields.entries()) {
                data.fields.set(
                    key,
                    Values.mapLeaves(value, t => (Values.isLink(t) ? linkNormalizer(t) : t))
                );
            }
        }

        if (data.lists) {
            for (let item of data.lists) {
                for (let [key, value] of item.fields.entries()) {
                    item.fields.set(
                        key,
                        value.map(x => Values.mapLeaves(x, t => (Values.isLink(t) ? linkNormalizer(t) : t)))
                    );
                }
            }
        }

        if (data.links) {
            data.links = data.links.map(l => linkNormalizer(l));
        }

        // This is pretty ugly, but it's not possible to normalize on the worker thread that does parsing.
        // The best way to improve this is to instead just canonicalize the entire data object; I can try to
        // optimize `Values.mapLeaves` to only mutate if it actually changes things.
        return new PageMetadata(data.path!!, data);
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
        let result = new Set<string>();
        for (let tag of this.tags) {
            for (let subtag of extractSubtags(tag)) result.add(subtag);
        }

        return result;
    }

    /** Convert all links in this file to file links. */
    public fileLinks(): Link[] {
        let distinctPaths = new Set<string>(this.links.map(l => l.path));
        return Array.from(distinctPaths).map(l => Link.file(l));
    }

    /** Map this metadata to a full object; uses the index for additional data lookups.  */
    public serialize(index: FullIndex, cache?: ListSerializationCache): SMarkdownPage {
        // Convert list items via the canonicalization cache.
        let realCache = cache ?? new ListSerializationCache(this.lists);

        let result: any = {
            file: {
                path: this.path,
                folder: this.folder(),
                name: this.name(),
                link: Link.file(this.path),
                outlinks: this.fileLinks(),
                inlinks: Array.from(index.links.getInverse(this.path)).map(l => Link.file(l)),
                etags: Array.from(this.tags),
                tags: Array.from(this.fullTags()),
                aliases: Array.from(this.aliases),
                lists: this.lists.map(l => realCache.get(l.line)),
                tasks: this.lists.filter(l => !!l.task).map(l => realCache.get(l.line)),
                ctime: this.ctime,
                cday: stripTime(this.ctime),
                mtime: this.mtime,
                mday: stripTime(this.mtime),
                size: this.size,
                starred: index.starred.starred(this.path),
                frontmatter: Values.deepCopy(this.frontmatter),
                ext: this.extension(),
            },
        };

        // Add the current day if present.
        if (this.day) result.file.day = this.day;

        // Then append the computed fields.
        for (let [key, value] of this.fields.entries()) {
            if (key in result) continue; // Don't allow fields to override existing keys.
            result[key] = value;
        }

        return result;
    }
}

/** A list item inside of a list. */
export class ListItem {
    /** The symbol ('*', '-', '1.') used to define this list item. */
    symbol: string;
    /** A link which points to this task, or to the closest block that this task is contained in. */
    link: Link;
    /** A link to the section that contains this list element; could be a file if this is not in a section. */
    section: Link;
    /** The text of this list item. This may be multiple lines of markdown. */
    text: string;
    /** The line that this list item starts on in the file. */
    line: number;
    /** The number of lines that define this list item. */
    lineCount: number;
    /** The line number for the first list item in the list this item belongs to. */
    list: number;
    /** Any links contained within this list item. */
    links: Link[];
    /** The tags contained within this list item. */
    tags: Set<string>;
    /** The raw Obsidian-provided position for where this task is. */
    position: Pos;
    /** The line number of the parent list item, if present; if this is undefined, this is a root item. */
    parent?: number;
    /** The line numbers of children of this list item. */
    children: number[];
    /** The block ID for this item, if one is present. */
    blockId?: string;
    /** Any fields defined in this list item. For tasks, this includes fields underneath the task. */
    fields: Map<string, Literal[]>;

    task?: {
        /** The text in between the brackets of the '[ ]' task indicator ('[X]' would yield 'X', for example.) */
        status: string;
        /** Whether or not this task has been checked in any way (it's status is not empty/space). */
        checked: boolean;
        /** Whether or not this task was completed; derived from 'status' by checking if the field 'X' or 'x'. */
        completed: boolean;
        /** Whether or not this task and all of it's subtasks are completed. */
        fullyCompleted: boolean;
    };

    public constructor(init?: Partial<ListItem>) {
        Object.assign(this, init);

        this.fields = this.fields || new Map();
        this.tags = this.tags || new Set();
        this.children = this.children || [];
        this.links = this.links || [];
    }

    public id(): string {
        return `${this.file().path}-${this.line}`;
    }

    public file(): Link {
        return this.link.toFile();
    }

    public markdown(): string {
        if (this.task) return `${this.symbol} [${this.task.completed ? "x" : " "}] ${this.text}`;
        else return `${this.symbol} ${this.text}`;
    }

    public created(): Literal | undefined {
        return (this.fields.get("created") ?? this.fields.get("ctime") ?? this.fields.get("cday"))?.[0];
    }

    public due(): Literal | undefined {
        return (this.fields.get("due") ?? this.fields.get("duetime") ?? this.fields.get("dueday"))?.[0];
    }

    public completed(): Literal | undefined {
        return (this.fields.get("completed") ??
            this.fields.get("completion") ??
            this.fields.get("comptime") ??
            this.fields.get("compday"))?.[0];
    }

    public start(): Literal | undefined {
        return this.fields.get("start")?.[0];
    }

    public scheduled(): Literal | undefined {
        return this.fields.get("scheduled")?.[0];
    }

    /** Create an API-friendly copy of this list item. De-duplication is done via the provided cache. */
    public serialize(cache: ListSerializationCache): SListItem {
        // Map children to their serialized/de-duplicated equivalents right away.
        let children = this.children.map(l => cache.get(l)).filter((l): l is SListItem => l !== undefined);

        let result: DataObject = {
            symbol: this.symbol,
            link: this.link,
            section: this.section,
            text: this.text,
            tags: Array.from(this.tags),
            line: this.line,
            lineCount: this.lineCount,
            list: this.list,
            outlinks: Array.from(this.links),
            path: this.link.path,
            children: children,
            task: !!this.task,
            annotated: this.fields.size > 0,
            position: Values.deepCopy(this.position as any),

            subtasks: children, // @deprecated, use 'item.children' instead.
            real: !!this.task, // @deprecated, use 'item.task' instead.
            header: this.section, // @deprecated, use 'item.section' instead.
        };

        if (this.parent) result.parent = this.parent;
        if (this.blockId) result.blockId = this.blockId;

        addFields(this.fields, result);

        if (this.task) {
            result.status = this.task.status;
            result.checked = this.task.checked;
            result.completed = this.task.completed;
            result.fullyCompleted = this.task.fullyCompleted;

            let created = this.created(),
                due = this.due(),
                completed = this.completed(),
                start = this.start(),
                scheduled = this.scheduled();

            if (created) result.created = Values.deepCopy(created);
            if (due) result.due = Values.deepCopy(due);
            if (completed) result.completion = Values.deepCopy(completed);
            if (start) result.start = Values.deepCopy(start);
            if (scheduled) result.scheduled = Values.deepCopy(scheduled);
        }

        return result as SListItem;
    }
}

//////////////////////////////////////////
// Conversion / Serialization Utilities //
//////////////////////////////////////////

/** De-duplicates list items across section metadata and page metadata. */
export class ListSerializationCache {
    public listItems: Record<number, ListItem>;
    public cache: Record<number, SListItem>;
    public seen: Set<number>;

    public constructor(listItems: ListItem[]) {
        this.listItems = {};
        this.cache = {};
        this.seen = new Set();

        for (let item of listItems) this.listItems[item.line] = item;
    }

    public get(lineno: number): SListItem | undefined {
        if (lineno in this.cache) return this.cache[lineno];
        else if (this.seen.has(lineno)) {
            console.log(
                `Dataview: Encountered a circular list (line number ${lineno}; children ${this.listItems[
                    lineno
                ].children.join(", ")})`
            );
            return undefined;
        }

        this.seen.add(lineno);
        let result = this.listItems[lineno].serialize(this);
        this.cache[lineno] = result;
        return result;
    }
}

export function addFields(fields: Map<string, Literal[]>, target: DataObject): DataObject {
    for (let [key, values] of fields.entries()) {
        if (key in target) continue;
        target[key] = values.length == 1 ? values[0] : values;
    }

    return target;
}
