/* Builds on top of the raw markdown parser to generate full PageMetadata objects. */
import {
    extractFullLineField,
    extractInlineFields,
    extractSpecialTaskFields,
    parseInlineValue,
} from "data-source/parsers/inline-field";
import { MarkdownField, MarkdownLink, MarkdownTag, PageMetadata, SectionMetadata, ListItem } from "data-model/markdown";
import { LiteralValue, Values } from "data-model/value";
import { Link } from "data-model/link";
import { EXPRESSION } from "expression/parse";
import { DateTime } from "luxon";
import { FileStats, parseFrontMatterAliases, parseFrontMatterTags, parseYaml } from "obsidian";
import { canonicalizeVarName, extractDate, getFileTitle } from "util/normalize";
import {
    extractLinks,
    extractTags,
    MarkdownBlock,
    markdownBlockEndingLine,
    markdownFile,
    MarkdownListElement,
    markdownToRaw,
} from "data-source/parsers/markdown";

/** Given the contents of a markdown page and some associated metadata, generate complex markdown page metadata. */
export function markdownToMetadata(path: string, contents: string, stats: FileStats): PageMetadata {
    // Split the page into markdown blocks; we'll collect data by section.
    let blocks = markdownFile(contents);

    // Pull the frontmatter (which should be the first block if present).
    let frontmatter = {};
    let index = 0;
    if (blocks.length > 0 && blocks[0].type == "frontmatter") {
        frontmatter = parseYaml(blocks[0].contents.join("\n"));
        index++;
    }

    // Iterate until we find the first header to initiate a section.
    let page = new SectionBuilder("<implicit page section>", 1, 0, Link.file(path), Link.file(path));
    while (index < blocks.length && blocks[index].type !== "heading") {
        markdownBlockToMetadata(blocks[index], page);
        index++;
    }

    // We are either at the end of the document, or are sitting on a header.
    let sections: SectionMetadata[] = [];
    if (index < blocks.length) {
        let initialBlock = blocks[index];
        if (initialBlock.type !== "heading")
            throw Error(
                `Internal error: tried to start parsing a section from '${initialBlock.type}' instead of 'heading'.`
            );

        let currentSection = new SectionBuilder(
            initialBlock.text,
            initialBlock.level,
            initialBlock.line,
            Link.file(path),
            Link.header(path, initialBlock.text)
        );
        for (; index < blocks.length; index++) {
            let block = blocks[index];
            // On section start, start a new section and merge the old one with the page.
            if (block.type == "heading") {
                let finished = currentSection.finish(block.line - 1);
                page.mergeFrom(finished);
                sections.push(finished);

                currentSection = new SectionBuilder(
                    block.text,
                    block.level,
                    block.line,
                    Link.file(path),
                    Link.header(path, initialBlock.text)
                );
            }

            markdownBlockToMetadata(block, currentSection);
        }

        let finished = currentSection.finish(markdownBlockEndingLine(blocks[blocks.length - 1]));
        page.mergeFrom(finished);
        sections.push(finished);
    }

    // Infer various global metadata: aliases, frontmatter, tags, and so on.
    let aliases: Set<string> = new Set(parseFrontMatterAliases(frontmatter));
    let frontTags: MarkdownTag[] = Array.from(new Set(parseFrontMatterTags(frontmatter))).map(t => {
        return { value: t, context: { type: "frontmatter" } };
    });

    // Convert all frontmatter to additional fields.
    let frontFields: MarkdownField[] = [];
    for (let [key, value] of Object.entries(frontmatter)) {
        frontFields.push({
            key: canonicalizeVarName(key),
            rawKey: key,
            rawValue: value,
            value: jsToLiteral(value),
            context: { type: "frontmatter" },
        });
    }

    return new PageMetadata(path, {
        links: page.links,
        fields: frontFields.concat(page.fields),
        tags: frontTags.concat(page.tags),
        lists: page.listItems,
        ctime: DateTime.fromMillis(stats.ctime),
        mtime: DateTime.fromMillis(stats.mtime),
        size: stats.size,
        day: inferDate(path, frontFields.concat(page.fields), sections?.[0].title),
        title: sections?.[0].title ?? getFileTitle(path),
        frontmatter,
        sections,
        aliases,
    });
}

/** Iterate through a markdown block, appending relevant metadata to the given section builder. */
function markdownBlockToMetadata(block: MarkdownBlock, section: SectionBuilder, builder: MetadataBuilder) {
    switch (block.type) {
        case "paragraph":
        case "blockquote":
            for (let index = 0; index < block.contents.length; index++)
                markdownLineToMetadata(block.contents[index], block.line + index, block, builder);
            break;
        case "heading":
            markdownLineToMetadata(block.text, block.line, block, builder);
            break;
        case "list":
            markdownListToMetadata(block, builder);
            break;
        case "rule":
        case "codeblock":
            // Nothing to do in these cases, no useful metadata in these sections currently.
            break;
        default:
            // Error out on unexpected types for now.
            throw Error(`Unrecognized markdown block type encountered during metadata extraction: '${block.type}'`);
    }
}

/**
 * Extract tasks, metadata, and other information from a list. Returns the line numbers of elements in this list (for
 * recursive purposes.)
 */
function markdownListToMetadata(list: MarkdownBlock, builder: SectionBuilder): ListItem[] {
    if (list.type !== "list") throw Error("This function can only be called with a list markdown block.");

    return list.elements.map(element => markdownElementToMetadata(element, list.line, undefined, builder));
}

/** Extract tasks, metadata, and other information from a specific list element; this function is recursive. */
function markdownElementToMetadata(
    element: MarkdownListElement,
    listLine: number,
    parentLine?: number,
    builder: SectionBuilder
): ListItem {
    let children: ListItem[] = [];

    let item = new ListItem({
        symbol: element.symbol,
        line: element.line,
        file: builder.file,
        section: builder.self,
        link: builder.self,
        list: listLine,
        parent: parentLine,
        children: children.filter(l => l.parent == element.line).map(l => l.line),
        blockId: element.blockId,
        text: markdownToRaw(element.text),
    });

    if (element.task) {
        let completed = element.task.trim() != "";
        let meta = new MetadataBuilder();
        for (let block of element.text) markdownBlockToMetadata(block, meta);

        item.task = {
            status: element.task,
            completed,
            fullyCompleted: completed && children.every(l => !l.task || l.task.completed),
            annotations: {},
        };
    }

    builder.listItem(item);
    return item;
}

/** Extract inline fields, metadata, and tags from a specific line and appending to the given builder. */
function markdownLineToMetadata(line: string, lineno: number, block: MarkdownBlock, builder: SectionBuilder) {
    // Always extract tags and links, irrespective of inline field type.
    for (let tag of extractTags(line))
        builder.tag({
            value: tag.value,
            context: { type: "markdown", block, line: lineno, col: tag.col, length: tag.length },
        });

    for (let link of extractLinks(line))
        builder.link({
            value: link.value,
            context: { type: "markdown", block, line: lineno, col: link.col, length: link.length },
            style: link.style,
        });

    let fullLine = extractFullLineField(line);
    if (fullLine) {
        builder.field({
            value: parseInlineValue(fullLine.value),
            rawValue: fullLine.value,
            rawKey: fullLine.key,
            key: canonicalizeVarName(fullLine.key),
            context: { type: "line", block, line: lineno, count: 1 },
        });
    } else {
        for (let field of extractInlineFields(line))
            builder.field({
                value: parseInlineValue(field.value),
                rawValue: field.value,
                rawKey: field.key,
                key: canonicalizeVarName(field.key),
                context: { type: "inline", block, line: lineno, col: field.start, length: field.end - field.start },
            });
    }
}

/** Recursively convert frontmatter into fields. We have to dance around YAML structure. */
export function jsToLiteral(value: any): LiteralValue {
    if (value == null) {
        return null;
    } else if (typeof value === "object") {
        if (Array.isArray(value)) {
            let result = [];
            for (let child of value as Array<any>) {
                result.push(jsToLiteral(child));
            }

            return result;
        } else {
            let object = value as Record<string, any>;
            let result: Record<string, LiteralValue> = {};
            for (let key in object) {
                result[key] = jsToLiteral(object[key]);
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

/** Attempt to find a date associated with the given page from metadata or filenames. */
function inferDate(path: string, fields: MarkdownField[], title?: string): DateTime | undefined {
    for (let field of fields) {
        if (!(field.key == "date" || field.key == "day")) continue;

        let value = field.value;
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

    if (title) {
        let titleDate = extractDate(title);
        if (titleDate) return titleDate;
    }

    return extractDate(getFileTitle(path));
}

/** Generic builder object which tracks fields, tags, and other common metadata. */
class MetadataBuilder {
    /** All of the fields inside of this section. */
    public fields: MarkdownField[];
    /** All of the links - resolved and unresolved - in this section. */
    public links: MarkdownLink[];
    /** List items contained in this specific section. */
    public listItems: ListItem[];
    /** All of the tags contained in this specific section. */
    public tags: MarkdownTag[];

    public constructor() {
        this.fields = [];
        this.links = [];
        this.listItems = [];
        this.tags = [];
    }

    public field(f: MarkdownField): this {
        this.fields.push(f);
        return this;
    }

    public link(l: MarkdownLink): this {
        this.links.push(l);
        return this;
    }

    public listItem(t: ListItem): this {
        this.listItems.push(t);
        return this;
    }

    public tag(t: MarkdownTag): this {
        this.tags.push(t);
        return this;
    }

    /** Merge metadata from the other section into this one. */
    public mergeFrom(other: MetadataBuilder): this {
        this.fields = this.fields.concat(other.fields);
        this.links = this.links.concat(other.links);
        this.listItems = this.listItems.concat(this.listItems);
        this.tags = this.tags.concat(this.tags);
        return this;
    }
}

/** Utility for building up a markdown section filled with metadata. */
class SectionBuilder extends MetadataBuilder {
    /** The name of this section. */
    public title: string;
    /** The level that this section appears at. */
    public level: number;
    /** The (inclusive) line that this section starts on. */
    public start: number;
    /** The (inclusive) line that this section ends on. */
    public end: number;
    /** A link to the file that this section is in. */
    public file: Link;
    /** A link to this section; may include additional metadata to disambiguate identically named sections. */
    public self: Link;

    public constructor(title: string, level: number, line: number, file: Link, self: Link) {
        super();

        this.title = title;
        this.level = level;
        this.start = line;
        this.file = file;
        this.self = self;
    }

    /** Finish this section, returning completed metadata. */
    public finish(line: number): SectionMetadata {
        this.end = line;

        return new SectionMetadata(this.title, this.level, {
            start: this.start,
            end: this.end,
            file: this.file,
            fields: this.fields,
            links: this.links,
            lists: this.listItems,
            tags: this.tags,
        });
    }
}
