/** Importer for markdown documents. */

import { extractFullLineField, extractInlineFields, InlineField, parseInlineValue } from "data-import/inline-field";
import { ListItem, PageMetadata } from "data-model/markdown";
import { Literal, Link, Values } from "data-model/value";
import { EXPRESSION } from "expression/parse";
import { DateTime } from "luxon";
import type { CachedMetadata, FileStats, FrontMatterCache, HeadingCache } from "obsidian";
import { canonicalizeVarName, extractDate, getFileTitle } from "util/normalize";

/** Extract markdown metadata from the given Obsidian markdown file. */
export function parsePage(path: string, contents: string, stat: FileStats, metadata: CachedMetadata): PageMetadata {
    let tags = new Set<string>();
    let aliases = new Set<string>();
    let fields = new Map<string, Literal>();
    let links: Link[] = [];

    // File tags, including front-matter and in-file tags.
    (metadata.tags || []).forEach(t => tags.add(t.tag.startsWith("#") ? t.tag : "#" + t.tag));

    // Front-matter file tags, aliases, AND frontmatter properties.
    if (metadata.frontmatter) {
        for (let tag of extractTags(metadata.frontmatter)) {
            if (!tag.startsWith("#")) tag = "#" + tag;
            tags.add(tag.toLocaleLowerCase());
        }

        for (let alias of extractAliases(metadata.frontmatter) || []) aliases.add(alias);

        let frontFields = parseFrontmatter(metadata.frontmatter) as Record<string, Literal>;
        for (let [key, value] of Object.entries(frontFields)) fields.set(key, value);
    }

    // Links in metadata.
    for (let rawLink of metadata.links || []) {
        let parsed = EXPRESSION.embedLink.parse(rawLink.original);
        if (parsed.status) links.push(parsed.value);
    }

    // Merge frontmatter fields with parsed fields.
    let markdownData = parseMarkdown(path, contents.split("\n"), metadata);
    for (let [name, values] of markdownData.fields.entries()) {
        for (let value of values) addInlineField(fields, name, value);
    }

    return new PageMetadata(path, {
        fields,
        tags,
        aliases,
        links,
        lists: markdownData.lists,
        ctime: DateTime.fromMillis(stat.ctime),
        mtime: DateTime.fromMillis(stat.mtime),
        size: stat.size,
        day: findDate(path, fields),
    });
}

/** Extract tags intelligently from frontmatter. Handles arrays, numbers, and strings. */
export function extractTags(metadata: FrontMatterCache): string[] {
    let tagKeys = Object.keys(metadata).filter(t => t.toLowerCase() == "tags" || t.toLowerCase() == "tag");

    return tagKeys.map(k => splitFrontmatterTagOrAlias(metadata[k])).reduce((p, c) => p.concat(c), []);
}

/** Extract tags intelligently from frontmatter. Handles arrays, numbers, and strings.  */
export function extractAliases(metadata: FrontMatterCache): string[] {
    let aliasKeys = Object.keys(metadata).filter(t => t.toLowerCase() == "alias" || t.toLowerCase() == "aliases");

    return aliasKeys.map(k => splitFrontmatterTagOrAlias(metadata[k])).reduce((p, c) => p.concat(c), []);
}

/** Split a frontmatter list into separate elements; handles actual lists, comma separated lists, and single elements. */
export function splitFrontmatterTagOrAlias(data: any): string[] {
    if (Array.isArray(data)) return data.filter(s => !!s).map(s => ("" + s).trim());

    // Force to a string to handle numbers and so on.
    const strData = "" + data;
    return strData
        .split(",")
        .filter(t => !!t)
        .map(t => t.trim())
        .filter(t => t.length > 0);
}

/** Parse raw (newline-delimited) markdown, returning inline fields, list items, and other metadata. */
export function parseMarkdown(
    path: string,
    contents: string[],
    metadata: CachedMetadata
): { fields: Map<string, Literal[]>; lists: ListItem[] } {
    let fields: Map<string, Literal[]> = new Map();

    // Only parse heading and paragraph elements for inline fields; we will parse list metadata separately.
    for (let section of metadata.sections || []) {
        if (section.type == "list" || section.type == "ruling") continue;

        for (let lineno = section.position.start.line; lineno <= section.position.end.line; lineno++) {
            let line = contents[lineno];

            // Fast bail-out for lines that are too long or do not contain '::'.
            if (line.length > 2048 || !line.includes("::")) continue;
            line = line.trim();

            let inlineFields = extractInlineFields(line);
            if (inlineFields.length > 0) {
                for (let ifield of inlineFields) addRawInlineField(ifield, fields);
            } else {
                let fullLine = extractFullLineField(line);
                if (fullLine) addRawInlineField(fullLine, fields);
            }
        }
    }

    // Extract task data and append the global data extracted from them to our fields.
    let [lists, extraData] = parseLists(path, contents, metadata);
    for (let [key, values] of extraData.entries()) {
        if (!fields.has(key)) fields.set(key, values);
        else fields.set(key, fields.get(key)!!.concat(values));
    }

    return { fields, lists };
}

// TODO: Consider using an actual parser in leiu of a more expensive regex.
export const LIST_ITEM_REGEX = /^\s*(\d+\.|\*|-|\+)\s*(\[.{0,1}\])?\s*(.+)$/mu;

/**
 * Parse list items from the page + metadata. This requires some additional parsing above whatever Obsidian provides,
 * since Obsidian only gives line numbers.
 */
export function parseLists(
    path: string,
    content: string[],
    metadata: CachedMetadata
): [ListItem[], Map<string, Literal[]>] {
    let cache: Record<number, ListItem> = {};

    // Place all of the values in the cache before resolving children & metadata relationships.
    for (let rawElement of metadata.listItems || []) {
        // Match on the first line to get the symbol and first line of text.
        let rawMatch = LIST_ITEM_REGEX.exec(content[rawElement.position.start.line]);
        if (!rawMatch) {
            console.log(
                `Dataview: Encountered unrecognized list element "${content[rawElement.position.start.line]}" (line ${
                    rawElement.position.start.line
                }, file ${path}).`
            );
            continue;
        }

        // And then strip unnecessary spacing from the remaining lines.
        let textParts = [rawMatch[3]]
            .concat(content.slice(rawElement.position.start.line + 1, rawElement.position.end.line + 1))
            .map(t => t.trim());
        let textWithNewline = textParts.join("\n");
        let textNoNewline = textParts.join(" ");

        // Find the list that we are a part of by line.
        let containingListId = (metadata.sections || []).findIndex(
            s =>
                s.type == "list" &&
                s.position.start.line <= rawElement.position.start.line &&
                s.position.end.line >= rawElement.position.start.line
        );

        // Find the section we belong to as well.
        let sectionName = findPreviousHeader(rawElement.position.start.line, metadata.headings || []);
        let sectionLink = sectionName === undefined ? Link.file(path) : Link.header(path, sectionName);
        let closestLink = rawElement.id === undefined ? sectionLink : Link.block(path, rawElement.id);

        // Construct universal information about this element (before tasks).
        let item = new ListItem({
            symbol: rawMatch[1],
            link: closestLink,
            section: sectionLink,
            text: textWithNewline,
            line: rawElement.position.start.line,
            lineCount: rawElement.position.end.line - rawElement.position.start.line + 1,
            list: containingListId == -1 ? -1 : (metadata.sections || [])[containingListId].position.start.line,
            position: rawElement.position,
            children: [],
            blockId: rawElement.id,
        });

        if (rawElement.parent >= 0) item.parent = rawElement.parent;

        // Set up the basic task information for now, though we have to recompute `fullyComputed` later.
        if (rawElement.task) {
            item.task = {
                status: rawElement.task,
                completed: rawElement.task != " ",
                fullyCompleted: rawElement.task != " ",
            };
        }

        // Extract inline fields; extract full-line fields only if we are NOT a task.
        item.fields = new Map<string, Literal[]>();
        for (let element of extractInlineFields(textNoNewline, true)) addRawInlineField(element, item.fields);

        if (!rawElement.task && item.fields.size == 0) {
            let fullLine = extractFullLineField(textNoNewline);
            if (fullLine) addRawInlineField(fullLine, item.fields);
        }

        cache[item.line] = item;
    }

    // Tree updating passes. Update child lists. Propogate metadata up to parent tasks. Update task `fullyCompleted`.
    let literals: Map<string, Literal[]> = new Map();
    for (let listItem of Object.values(cache).filter(l => l.parent !== undefined)) {
        // Pass 1: Update child lists.
        cache[listItem.parent!!].children.push(listItem.line);

        // Pass 2: Propogate metadata up to the parent task or root element.
        let root: ListItem | undefined = listItem;
        while (!!root && !root.task) root = cache[root.parent ?? -1];

        // If the root is null, append this metadata to the root; otherwise, append to the task.
        mergeFieldGroups(root === undefined ? literals : root.fields, listItem.fields);

        // Pass 3: Propogate `fullyCompleted` up the task tree. This is a little less efficient than just doing a simple
        // DFS using the children IDs, but it's probably fine.
        if (listItem.task) {
            let curr: ListItem | undefined = listItem;
            while (!!curr) {
                if (curr.task) curr.task.fullyCompleted = curr.task.fullyCompleted && listItem.task.completed;
                curr = cache[curr.parent ?? -1];
            }
        }
    }

    return [Object.values(cache), literals];
}

/** Attempt to find a date associated with the given page from metadata or filenames. */
function findDate(file: string, fields: Map<string, Literal>): DateTime | undefined {
    for (let key of fields.keys()) {
        if (!(key.toLocaleLowerCase() == "date" || key.toLocaleLowerCase() == "day")) continue;

        let value = fields.get(key) as Literal;
        if (Values.isDate(value)) {
            return value;
        } else if (Values.isArray(value) && value.length > 0 && Values.isDate(value[0])) {
            return value[0];
        } else if (Values.isLink(value)) {
            let date = extractDate(value.path) ?? extractDate(value.subpath ?? "") ?? extractDate(value.display ?? "");
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

/** Add a raw inline field to an output map, canonicalizing as needed. */
export function addRawInlineField(field: InlineField, output: Map<string, Literal[]>) {
    let value = parseInlineValue(field.value);

    output.set(field.key, (output.get(field.key) ?? []).concat([value]));
    let simpleName = canonicalizeVarName(field.key);
    if (simpleName.length > 0 && simpleName != field.key.trim()) {
        output.set(simpleName, (output.get(simpleName) ?? []).concat([value]));
    }
}

/** Add an inline field to an existing field array, converting a single value into an array if it is present multiple times. */
export function addInlineField(fields: Map<string, Literal>, name: string, value: Literal) {
    if (fields.has(name)) {
        let existing = fields.get(name) as Literal;
        if (Values.isArray(existing)) fields.set(name, existing.concat([value]));
        else fields.set(name, [existing, value]);
    } else {
        fields.set(name, value);
    }
}

/** Copy all fields of 'source' into 'target'. */
export function mergeFieldGroups(target: Map<string, Literal[]>, source: Map<string, Literal[]>) {
    for (let key of source.keys()) {
        if (!target.has(key)) target.set(key, source.get(key)!!);
        else target.set(key, target.get(key)!!.concat(source.get(key)!!));
    }
}

/** Find the header that is most immediately above the given line number. */
export function findPreviousHeader(line: number, headers: HeadingCache[]): string | undefined {
    if (headers.length == 0) return undefined;
    if (headers[0].position.start.line > line) return undefined;

    let index = headers.length - 1;
    while (index >= 0 && headers[index].position.start.line > line) index--;

    return headers[index].heading;
}
