import { canonicalizeVarName, getFileName, getParentFolder } from './util/normalize';
import { Fields, LiteralField, LiteralFieldRepr } from './query';
import { getAllTags, MetadataCache, parseFrontMatterAliases, parseFrontMatterTags, TFile, Vault } from 'obsidian';
import { EXPRESSION, parseInnerLink } from './parse';
import { DateTime } from 'luxon';

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
    /** The tags inside of this task description. */
    tags?: Set<string>;
	/** Any subtasks of this task. */
	subtasks: Task[];
}

/** All extracted markdown file metadata obtained from a file. */
export class PageMetadata {
    /** The path this file exists at. */
    path: string;
    /** Obsidian-provided date this page was created. */
    ctime: DateTime;
    /** Obsidian-provided date this page was modified. */
    mtime: DateTime;
    /** Obsidian-provided size of this page in bytes. */
    size: number;
    /** The day associated with this page, if relevant. */
    day?: DateTime;
    /** The first H1/H2 header in the file. May not exist. */
    title?: string;
    /** All of the fields contained in this markdown file - both frontmatter AND in-file links. */
    fields: Map<string, LiteralField>;
    /** All of the exact tags (prefixed with '#') in this file overall. */
    tags: Set<string>;
    /** All of the aliases defined for this file. */
    aliases: Set<string>;
    /** All OUTGOING links (including embeds, header + block links) in this file. */
    links: LinkMetadata[];
    /** All tasks contained within this file. */
    tasks: Task[];

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
        while (tag.contains("/")) {
            tag = tag.substring(0, tag.lastIndexOf("/"));
            result.push(tag);
        }

        return result;
    }

    /** The name (based on path) of this file. */
    public name(): string { return getFileName(this.path); }

    /** The containing folder (based on path) of this file. */
    public folder(): string { return getParentFolder(this.path); }

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

/** Matches lines of the form "- [ ] <task thing>". */
export const TASK_REGEX = /(\s*)[-*]\s*\[([ Xx\.]?)\]\s*(.+)/i;

/**
 * A hacky approach to scanning for all tasks using regex. Does not support multiline
 * tasks yet (though can probably be retro-fitted to do so).
*/
export function findTasksInFile(path: string, file: string): Task[] {
	// Dummy top of the stack that we'll just never get rid of.
	let stack: [Task, number][] = [];
	stack.push([{ text: "Root", line: -1, path, completed: false, subtasks: [] }, -4]);

	let lineno = 0;
	for (let line of file.replace("\r", "").split("\n")) {
		lineno += 1;

		let match = TASK_REGEX.exec(line);
		if (!match) {
            if (line.trim().length == 0) continue;

            // Non-empty line that is not a task, reset.
            while (stack.length > 1) stack.pop();
            continue;
        }

		let indent = match[1].replace("\t" , "    ").length;
		let task: Task = {
			text: match[3],
			completed: match[2] == 'X' || match[2] == 'x',
            path,
			line: lineno,
			subtasks: []
		};

		while (indent <= (stack.last()?.[1] ?? -4)) stack.pop();
		stack.last()?.[0].subtasks.push(task);
		stack.push([task, indent]);
	}

	// Return everything under the root, which should be all tasks.
	return stack[0][0].subtasks;
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
        line = line.trim();
        let match = inlineRegex.exec(line);
        if (!match) continue;

        let inlineField = parseInlineField(match[2]);
        fields.set(match[1].trim(), inlineField);
        let simpleName = canonicalizeVarName(match[1].trim());
        if (simpleName.length > 0) fields.set(simpleName, inlineField);
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
