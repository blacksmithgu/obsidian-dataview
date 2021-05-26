import { canonicalizeVarName, getExtension, getFileName, getParentFolder } from 'src/util/normalize';
import { Fields, Link, LiteralField, LiteralFieldRepr } from 'src/query';
import { getAllTags, MetadataCache, parseFrontMatterAliases, parseFrontMatterTags, TFile, Vault } from 'obsidian';
import { EXPRESSION, parseInnerLink } from 'src/parse';
import { DateTime } from 'luxon';
import { FullIndex } from 'src/data/index';

interface BaseLinkMetadata {
    path: string;
    /** The display string for this link. */
    display?: string;
    /** If true, this is an *embed* link. */
    embed: boolean;
}

export interface HeaderLinkMetadata extends BaseLinkMetadata {
    type: 'header';
    header: string;
}

export interface BlockLinkMetadata extends BaseLinkMetadata {
    type: 'block';
    blockId: string;
}

export interface FileLinkMetadata extends BaseLinkMetadata {
    type: 'file';
}

/** A link inside a markdown file. */
export type LinkMetadata = HeaderLinkMetadata | BlockLinkMetadata | FileLinkMetadata;

/** A specific task. */
export interface Task {
	/** The text of this task. */
	text: string;
	/** The line this task shows up on. */
	line: number;
    /** The full path of the file. */
    path: string;
	/** Whether or not this task was completed. */
	completed: boolean;
    /** Whether or not this task and all of it's subtasks are completed. */
    fullyCompleted: boolean;
    /** If true, this is a real task; otherwise, it is a list element above/below a task. */
    real: boolean;
	/** Any subtasks of this task. */
	subtasks: Task[];
}

export namespace Task {
    /** Deep-copy a task. */
    export function copy(input: Task): Task {
        let partial = Object.assign({}, input) as Task;
        partial.subtasks = partial.subtasks.map(t => copy(t));
        return partial;
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
    public fields: Map<string, LiteralField>;
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
        this.fields = new Map<string, LiteralField>();
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
    public name(): string { return getFileName(this.path); }

    /** The containing folder (based on path) of this file. */
    public folder(): string { return getParentFolder(this.path); }

    /** The extension of this file (likely 'md'). */
    public extension(): string { return getExtension(this.path); }

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
                case "file": return link;
                case "block": return {
                    type: 'file',
                    path: link.path,
                    display: link.display,
                    embed: link.embed
                } as FileLinkMetadata;
                case "header": return {
                    type: 'file',
                    path: link.path,
                    display: link.display,
                    embed: link.embed
                } as FileLinkMetadata;
            }
        })
    }

    /** Map this metadata to a full object; uses the index for additional data lookups.  */
    public toObject(index: FullIndex): Record<string, any> {
        // Static fields first. Note this object should not have any pointers to the original object (so that the
        // index cannot accidentally be mutated).
        let result: Record<string, any> = {
            "file": {
                "path": this.path,
                "folder": this.folder(),
                "name": this.name(),
                "link": Link.file(this.path, false),
                "outlinks": this.fileLinks().map(l => Link.file(l.path, false)),
                "inlinks": Array.from(index.links.getInverse(this.path)).map(l => Link.file(l, false)),
                "etags": Array.from(this.tags),
                "tags": Array.from(this.fullTags()),
                "aliases": Array.from(this.aliases),
                "tasks": this.tasks.map(t => Task.copy(t)),
                "day": this.day ?? undefined,
                "ctime": this.ctime,
                "cday": DateTime.fromObject({ year: this.ctime.year, month: this.ctime.month, day: this.ctime.day }),
                "mtime": this.mtime,
                "mday": DateTime.fromObject({ year: this.mtime.year, month: this.mtime.month, day: this.mtime.day }),
                "size": this.size,
                "ext": this.extension()
            }
        };

        // Then append the computed fields.
        for (let [key, value] of this.fields) {
            if (key === "file") continue; // Don't allow fields to override 'file'.
            result[key] = Fields.fieldToValue(value);
        }

        return result;
    }
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
function findDate(file: string, fields: Map<string, LiteralField>): DateTime | undefined {
    for (let key of fields.keys()) {
        if (!(key.toLocaleLowerCase() == "date")) continue;

        let value = fields.get(key) as LiteralField;
        if (value.valueType == "date") return value.value;
        else if (value.valueType == "link") {
            let date = extractDate(value.value.path);
            if (date) return date;

            date = extractDate(value.value.subpath ?? "");
            if (date) return date;

            date = extractDate(value.value.display ?? "");
            if (date) return date;
        }
    }

    return extractDate(getFileName(file));
}

/** Recursively convert frontmatter into fields. We have to dance around YAML structure. */
export function parseFrontmatter(value: any): LiteralField {
    if (value == null) {
        return Fields.NULL;
    } else if (typeof value === 'object') {
        if (Array.isArray(value)) {
            let object = (value as Array<any>);
            // Special case for link syntax, which shows up as double-nested arrays.
            if (object.length == 1 && Array.isArray(object[0]) && object[0].every(v => typeof v === 'string')) {
                return Fields.link(parseInnerLink(object[0].join(", ")));
            }

            let result = [];
            for (let child of object) {
                result.push(parseFrontmatter(child));
            }

            return Fields.array(result);
        } else {
            let object = (value as Record<string, any>);
            let result = new Map<string, LiteralField>();
            for (let key in object) {
                result.set(key, parseFrontmatter(object[key]));
            }

            return Fields.object(result);
        }
    } else if (typeof value === 'number') {
        return Fields.number(value);
    } else if (typeof value === 'string') {
        let dateParse = EXPRESSION.date.parse(value);
        if (dateParse.status) {
            return Fields.literal('date', dateParse.value);
        }

        let durationParse = EXPRESSION.duration.parse(value);
        if (durationParse.status) {
            return Fields.literal('duration', durationParse.value);
        }

        let linkParse = EXPRESSION.embedLink.parse(value);
        if (linkParse.status) {
            return Fields.literal('link', linkParse.value);
        }

        return Fields.literal('string', value);
    }

    // Backup if we don't understand the type.
    return Fields.NULL;
}

/** Parse a textual inline field value into something we can work with. */
export function parseInlineField(value: string): LiteralField {
    // The stripped literal field parser understands all of the non-array/non-object fields and can parse them for us.
    // Inline field objects are not currently supported; inline array objects have to be handled by the parser
    // separately.
    let inline = EXPRESSION.inlineField.parse(value);
    if (inline.status) return inline.value;
    else return Fields.string(value);
}

export function addInlineField(fields: Map<string, LiteralField>, name: string, value: LiteralField) {
    if (fields.has(name)) {
        let existing = fields.get(name) as LiteralField;
        if (existing.valueType == "array") fields.set(name, Fields.array(existing.value.concat([value])));
        else fields.set(name, Fields.array([existing, value]));
    } else {
        fields.set(name, value);
    }
}

/** Matches lines of the form "- [ ] <task thing>". */
export const TASK_REGEX = /^(\s*)[-*]\s*(\[[ Xx\.]?\])?\s*([^-*].*)$/iu;
export const MAX_PARSED_LINE_LENGTH = 500;

/** Return true if the given predicate is true for the task or any subtasks. */
export function taskAny(t: Task, f: (t: Task) => boolean): boolean {
    if (f(t)) return true;
    for (let sub of t.subtasks) if (taskAny(sub, f)) return true;

    return false;
}

/**
 * A hacky approach to scanning for all tasks using regex. Does not support multiline
 * tasks yet (though can probably be retro-fitted to do so).
*/
export function findTasksInFile(path: string, file: string): Task[] {
	// Dummy top of the stack that we'll just never get rid of.
	let stack: [Task, number][] = [];
	stack.push([{ text: "Root", line: -1, path, completed: false, fullyCompleted: false, real: false, subtasks: [] }, -4]);

	let lineno = 0;
	for (let line of file.replace("\r", "").split("\n")) {
		lineno += 1;

        // Fast bail-out before running more expensive regex matching.
        if (line.length > MAX_PARSED_LINE_LENGTH || !line.includes("[") || !line.includes("]")) {
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

		let indent = match[1].replace("\t" , "    ").length;
        let isReal = !!match[2] && match[2].trim().length > 0;
        let isCompleted = !isReal || (match[2] == '[X]' || match[2] == '[x]');
		let task: Task = {
			text: match[3],
			completed: isCompleted,
            fullyCompleted: isCompleted,
            real: isReal,
            path,
			line: lineno,
			subtasks: []
		};

		while (indent <= (stack.last()?.[1] ?? -4)) stack.pop();

        for (let [elem, _] of stack) elem.fullyCompleted = elem.fullyCompleted && task.fullyCompleted;
        stack.last()?.[0].subtasks.push(task);
		stack.push([task, indent]);
	}

	// Return everything under the root, which should be all tasks.
    // Strip trees of tasks which are purely not real (lol?).
	return stack[0][0].subtasks.filter(t => taskAny(t, st => st.real));
}

/** Extract markdown metadata from the given Obsidian markdown file. */
export async function extractMarkdownMetadata(file: TFile, vault: Vault, cache: MetadataCache, inlineRegex: RegExp) {
    let tags = new Set<string>();
    let aliases = new Set<string>();
    let fields = new Map<string, LiteralField>();

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

            let frontFields = parseFrontmatter(fileCache.frontmatter) as LiteralFieldRepr<'object'>;
            for (let [key, value] of frontFields.value) fields.set(key, value);
        }
    }

    // Grab links from the frontmatter cache.
    let links: LinkMetadata[] = [];
    if (file.path in cache.resolvedLinks) {
        for (let resolved in cache.resolvedLinks[file.path]) {
            links.push({
                type: 'file',
                path: resolved,
                display: resolved,
                embed: false
            })
        }
    }

    // Trawl through file contents to locate custom inline file content...
    let fileContents = await vault.read(file);
    for (let line of fileContents.split("\n")) {
        // Fast bail-out for lines that are too long.
        if (line.length > MAX_PARSED_LINE_LENGTH || !line.includes("::")) continue;
        line = line.trim();

        let match = inlineRegex.exec(line);
        if (!match) continue;

        let inlineField = parseInlineField(match[2]);
        addInlineField(fields, match[1].trim(), inlineField);
        let simpleName = canonicalizeVarName(match[1].trim());
        if (simpleName.length > 0 && simpleName != match[1].trim()) addInlineField(fields, simpleName, inlineField);
    }

    // And extract tasks...
    let tasks = findTasksInFile(file.path, fileContents);

    return new PageMetadata(file.path, {
        fields, tags, aliases, links, tasks,
        ctime: DateTime.fromMillis(file.stat.ctime),
        mtime: DateTime.fromMillis(file.stat.mtime),
        size: file.stat.size,
        day: findDate(file.path, fields)
    });
}
