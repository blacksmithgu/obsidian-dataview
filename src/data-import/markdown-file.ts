/** Importer for markdown documents. */

import { extractInlineFields, extractSpecialTaskFields, parseInlineValue } from "data-import/inline-field";
import { PageMetadata } from "data-model/markdown";
import { Literal, Link, Values, Task } from "data-model/value";
import { EXPRESSION } from "expression/parse";
import { DateTime } from "luxon";
import {
    CachedMetadata,
    getAllTags,
    HeadingCache,
    MetadataCache,
    parseFrontMatterAliases,
    parseFrontMatterTags,
    TFile,
} from "obsidian";
import { canonicalizeVarName, extractDate, getFileTitle } from "util/normalize";

export interface ParsedMarkdown {
    fields: Map<string, Literal[]>;
    tasks: Task[];
}

/** Attempt to find a date associated with the given page from metadata or filenames. */
function findDate(file: string, fields: Map<string, Literal>): DateTime | undefined {
    for (let key of fields.keys()) {
        if (!(key.toLocaleLowerCase() == "date" || key.toLocaleLowerCase() == "day")) continue;

        let value = fields.get(key) as Literal;
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
export function parseFrontmatter(value: any): Literal {
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
            let result: Record<string, Literal> = {};
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

/** Add an inline field to a nexisting field array, converting a single value into an array if it is present multiple times. */
export function addInlineField(fields: Map<string, Literal>, name: string, value: Literal) {
    if (fields.has(name)) {
        let existing = fields.get(name) as Literal;
        if (Values.isArray(existing)) fields.set(name, existing.concat([value]));
        else fields.set(name, [existing, value]);
    } else {
        fields.set(name, value);
    }
}

/** Matches lines of the form "- [ ] <task thing>". */
export const TASK_REGEX = /^(\s*)[-*]\s*(\[[ Xx\.]?\])?\s*([^-*].*)$/iu;
/** Matches Obsidian block IDs, which are at the end of the line of the form ^blockid. */
export const TASK_BLOCK_REGEX = /\^([a-zA-Z0-9]+)$/;

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

/** Find the header that is most immediately above the given line number. */
export function findPreviousHeader(line: number, headers: HeadingCache[]): string | undefined {
    if (headers.length == 0) return undefined;
    if (headers[0].position.start.line > line) return undefined;

    let index = headers.length - 1;
    while (index >= 0 && headers[index].position.start.line > line) index--;

    return headers[index].heading;
}

/**
 * A hacky approach to scanning for all tasks using regex. Does not support multiline
 * tasks yet (though can probably be retro-fitted to do so).
 */
export function findTasksInFile(path: string, file: string, metadata: CachedMetadata): Task[] {
    // Dummy top of the stack that we'll just never get rid of.
    let stack: [Task, number][] = [];
    stack.push([
        new Task({ text: "Root", line: -1, path, completed: false, fullyCompleted: false, real: false, subtasks: [] }),
        -4,
    ]);

    let lineno = -1;
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

        // Look for block IDs on this line; if present, link to that. Otherwise, link to the nearest header
        // and then to just the page.
        let link = Link.file(path, false);
        let blockMatch = TASK_BLOCK_REGEX.exec(line);
        let lastHeader = findPreviousHeader(lineno, metadata.headings || []);
        if (blockMatch) {
            link = Link.block(path, blockMatch[1], false);
        } else if (lastHeader) {
            link = Link.header(path, lastHeader, false);
        }

        // Add all inline field definitions.
        let annotations: Record<string, Literal> = {};
        for (let field of extractInlineFields(line)) {
            let value = parseInlineValue(field.value);

            annotations[field.key] = value;
            annotations[canonicalizeVarName(field.key)] = value;
        }

        let special = extractSpecialTaskFields(line, annotations);

        let indent = match[1].replace("\t", "    ").length;
        let isReal = !!match[2] && match[2].trim().length > 0;
        let isCompleted = !isReal || match[2] == "[X]" || match[2] == "[x]";
        let task = new Task({
            text: match[3],
            completed: isCompleted,
            fullyCompleted: isCompleted,
            real: isReal,
            path,
            line: lineno,
            section: lastHeader ? Link.header(path, lastHeader, false) : Link.file(path, false),
            link,
            subtasks: [],
            annotations,
            created: special.created,
            due: special.due,
            completion: special.completed,
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

export function parseMarkdown(
    path: string,
    metadata: CachedMetadata,
    contents: string,
    inlineRegex: RegExp
): ParsedMarkdown {
    let fields: Map<string, Literal[]> = new Map();

    // Trawl through file contents to locate custom inline file content...
    for (let line of contents.split("\n")) {
        // Fast bail-out for lines that are too long.
        if (!line.includes("::")) continue;
        line = line.trim();

        // Skip real task lines, since they can have their own custom metadata.
        // TODO: Abstract this check (i.e., improve task parsing to be more encapsulated).
        let taskParse = TASK_REGEX.exec(line);
        if (taskParse && (taskParse[2]?.trim()?.length ?? 0) > 0) continue;

        // Handle inline-inline fields (haha...)
        let hasInlineInline = false;
        for (let field of extractInlineFields(line)) {
            let value = parseInlineValue(field.value);

            fields.set(field.key, (fields.get(field.key) ?? []).concat([value]));
            let simpleName = canonicalizeVarName(field.key);
            if (simpleName.length > 0 && simpleName != field.key.trim()) {
                fields.set(simpleName, (fields.get(simpleName) ?? []).concat([value]));
            }

            hasInlineInline = true;
        }

        // Handle full-line inline fields if there are no inline-inline fields.
        if (!hasInlineInline) {
            let match = inlineRegex.exec(line);
            if (match) {
                let name = match[1].trim();
                let inlineField = parseInlineValue(match[2]);

                fields.set(name, (fields.get(name) ?? []).concat([inlineField]));
                let simpleName = canonicalizeVarName(match[1].trim());
                if (simpleName.length > 0 && simpleName != match[1].trim()) {
                    fields.set(simpleName, (fields.get(simpleName) ?? []).concat([inlineField]));
                }
            }
        }
    }

    // And extract tasks...
    let tasks = findTasksInFile(path, contents, metadata);

    return { fields, tasks };
}

/** Extract markdown metadata from the given Obsidian markdown file. */
export function parsePage(file: TFile, cache: MetadataCache, markdownData: ParsedMarkdown): PageMetadata {
    let tags = new Set<string>();
    let aliases = new Set<string>();
    let fields = new Map<string, Literal>();

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

            let frontFields = parseFrontmatter(fileCache.frontmatter) as Record<string, Literal>;
            for (let [key, value] of Object.entries(frontFields)) fields.set(key, value);
        }
    }

    // Grab links from the frontmatter cache.
    let links: Link[] = [];
    if (file.path in cache.resolvedLinks) {
        for (let resolved in cache.resolvedLinks[file.path]) links.push(Link.file(resolved));
    }
    // Also include unresolved links
    if (file.path in cache.unresolvedLinks) {
        for (let unresolved in cache.unresolvedLinks[file.path]) links.push(Link.file(unresolved));
    }

    // Merge frontmatter fields with parsed fields.
    for (let [name, values] of markdownData.fields.entries()) {
        for (let value of values) addInlineField(fields, name, value);
    }

    // Add task defaults; this should probably be done in the task parsing directly
    // once the parser has access to the common file metadata.
    let pageCtime = DateTime.fromMillis(file.stat.ctime);
    let fixedTasks = markdownData.tasks.map(t => t.withDefaultDates(pageCtime, undefined));

    return new PageMetadata(file.path, {
        fields,
        tags,
        aliases,
        links,
        tasks: fixedTasks,
        ctime: pageCtime,
        mtime: DateTime.fromMillis(file.stat.mtime),
        size: file.stat.size,
        day: findDate(file.path, fields),
    });
}
