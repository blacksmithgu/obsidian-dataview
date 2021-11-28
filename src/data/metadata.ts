import { getExtension, getFileTitle, getParentFolder, stripTime } from "util/normalize";
import { DateTime } from "luxon";
import type { FullIndex } from "data/index";
import { Link, LiteralValue, Task } from "data/value";

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
    public links: Link[];
    /** All tasks contained within this file. */
    public tasks: Task[];

    public constructor(path: string, init?: Partial<PageMetadata>) {
        this.path = path;
        this.fields = new Map<string, LiteralValue>();
        this.tags = new Set<string>();
        this.aliases = new Set<string>();
        this.links = [];
        this.tasks = [];

        Object.assign(this, init);
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
    public fileLinks(): Link[] {
        return this.links.map(link => Link.file(link.path));
    }

    /** Map this metadata to a full object; uses the index for additional data lookups.  */
    public toObject(index: FullIndex): Record<string, LiteralValue> {
        // Static fields first. Note this object should not have any pointers to the original object (so that the
        // index cannot accidentally be mutated).
        let result: any = {
            file: {
                path: this.path,
                folder: this.folder(),
                name: this.name(),
                link: Link.file(this.path),
                outlinks: this.fileLinks(),
                inlinks: Array.from(index.links.getInverse(this.path)).map(l => Link.file(l, false)),
                etags: Array.from(this.tags),
                tags: Array.from(this.fullTags()),
                aliases: Array.from(this.aliases),
                tasks: this.tasks.map(t => t.toObject()),
                ctime: this.ctime,
                cday: stripTime(this.ctime),
                mtime: this.mtime,
                mday: stripTime(this.mtime),
                size: this.size,
                ext: this.extension(),
            },
        };

        // Add the current day if present.
        if (this.day) result.file.day = this.day;

        // Then append the computed fields.
        for (let [key, value] of this.fields) {
            if (key === "file") continue; // Don't allow fields to override 'file'.
            result[key] = value;
        }

        return result;
    }
}
