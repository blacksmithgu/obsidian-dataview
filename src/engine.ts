/**
 * Takes a full query and a set of indices, and (hopefully quickly) returns all relevant files.
 */
import { LiteralField, LiteralFieldRepr, Query, Fields, Source, Sources, NamedField } from 'src/query';
import { FullIndex, TaskCache } from 'src/index';
import { Task } from 'src/tasks';
import { DateTime } from 'luxon';
import { TFile } from 'obsidian';
import { EXPRESSION } from 'src/parse';
import { Context, BINARY_OPS } from 'src/eval';
import { renderField, getFileName } from './render';

/** The result of executing a query over an index. */
export interface QueryResult {
    /** The names of the resulting fields. */
    names: string[];
    /** The actual data rows returned. */
    data: LiteralField[][];
}

/** Recursively collect target files from the given source. */
export function collectFromSource(source: Source, index: FullIndex, origin: string): Set<string> | string {
    if (source.type === 'empty') {
        return new Set<string>();
    } else if (source.type === 'tag') {
        return index.tag.get(source.tag);
    } else if (source.type === 'folder') {
        return index.prefix.get(source.folder);
    } else if (source.type === 'link') {
        let fullPath = index.metadataCache.getFirstLinkpathDest(source.file, origin)?.path;
        if (!fullPath) return `Could not resolve link "${source.file}" during link lookup - does it exist?`;

        if (source.direction === 'incoming') {
            // To find all incoming links (i.e., things that link to this), use the index that Obsidian provides.
            // TODO: Use an actual index so this isn't a fullscan.
            let resolved = index.metadataCache.resolvedLinks;
            let incoming = new Set<string>();

            for (let [key, value] of Object.entries(resolved)) {
                if (fullPath in value) incoming.add(key);
            }

            return incoming;
        } else {
            let resolved = index.metadataCache.resolvedLinks;
            if (!(fullPath in resolved)) return `Could not find file "${source.file}" during link lookup - does it exist?`;

            return new Set<string>(Object.keys(index.metadataCache.resolvedLinks[fullPath]));
        }
    } else if (source.type === 'binaryop') {
        let left = collectFromSource(source.left, index, origin);
        if (typeof left === 'string') return left;
        let right = collectFromSource(source.right, index, origin);
        if (typeof right === 'string') return right;

        if (source.op == '&') {
            let result = new Set<string>();
            for (let elem of right) {
                if (left.has(elem)) result.add(elem);
            }

            return result;
        } else if (source.op == '|') {
            let result = new Set(left);
            for (let elem of right) result.add(elem);
            return result;
        } else {
            return `Unrecognized operator '${source.op}'.`;
        }
    } else if (source.type === 'negate') {
        let child = collectFromSource(source.child, index, origin);
        if (typeof child === 'string') return child;

        // TODO: This is obviously very inefficient.
        let allFiles = new Set<string>(index.vault.getMarkdownFiles().map(f => f.path));

        for (let file of child) {
            allFiles.delete(file);
        }

        return allFiles;
    }
}

/** Recursively convert frontmatter into fields. */
export function parseFrontmatter(value: any): LiteralField {
    if (value == null) {
        return Fields.NULL;
    } else if (typeof value === 'object') {
        if (Array.isArray(value)) {
            let object = (value as Array<any>);
            // Special case for link syntax, which shows up as double-nested arrays.
            if (object.length == 1 && Array.isArray(object[0]) && (object[0].length == 1) && typeof object[0][0] === 'string') {
                return Fields.link(object[0][0]);
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

        let linkParse = EXPRESSION.link.parse(value);
        if (linkParse.status) {
            return Fields.literal('link', linkParse.value);
        }

        return Fields.literal('string', value);
    }

    // Backup if we don't understand the type.
    return Fields.NULL;
}

/** The default link resolver used when creating contexts. */
export function defaultLinkResolver(index: FullIndex, origin: string): (link: string) => LiteralFieldRepr<'object'> | LiteralFieldRepr<'null'> {
    return (link) => {
        let realFile = index.metadataCache.getFirstLinkpathDest(link, origin);
        if (!realFile) return Fields.NULL;

        return createContext(realFile.path, index).namespace;
    };
}

/** Create a fully-filled context representing the given file. */
export function createContext(file: string, index: FullIndex, rootContext: Context = null): Context {
    // Parse the frontmatter if present.
    let frontmatterData = Fields.emptyObject();
    let fileData = index.metadataCache.getCache(file);
    if (fileData && fileData.frontmatter) {
        frontmatterData = parseFrontmatter(fileData.frontmatter) as LiteralFieldRepr<'object'>;
    }

    // Create a context which uses the cache to look up link info.
    let context = new Context(defaultLinkResolver(index, file), rootContext, frontmatterData);

    // Fill out per-file metadata.
    let fileMeta = new Map<string, LiteralField>();
    fileMeta.set("path", Fields.literal('string', file));
    fileMeta.set("name", Fields.literal('string', getFileName(file)));
    fileMeta.set("link", Fields.link(file));
    fileMeta.set("tags", Fields.array(Array.from(index.tag.getInverse(file)).map(val => Fields.string(val))));

    // If the file has a date name, add it as the 'day' field.
    let dateMatch = /(\d{4})-(\d{2})-(\d{2})/.exec(getFileName(file));
    if (!dateMatch) dateMatch = /\b(\d{4})(\d{2})(\d{2})\b/.exec(getFileName(file));
    if (dateMatch) {
        let year = Number.parseInt(dateMatch[1]);
        let month = Number.parseInt(dateMatch[2]);
        let day = Number.parseInt(dateMatch[3]);
        fileMeta.set("day", Fields.literal('date', DateTime.fromObject({ year, month, day })))
    }

    // Populate file metadata.
    let afile = index.vault.getAbstractFileByPath(file);
    if (afile && afile instanceof TFile) {
        fileMeta.set('ctime', Fields.literal('date', DateTime.fromMillis(afile.stat.ctime)));
        fileMeta.set('mtime', Fields.literal('date', DateTime.fromMillis(afile.stat.mtime)));
        fileMeta.set('size', Fields.number(afile.stat.size));
        fileMeta.set('ext', Fields.string(afile.extension));
    }

    context.set("file", Fields.object(fileMeta));

    return context;
}

/** Execute a query over the given index, returning all matching rows. */
export function execute(query: Query, index: FullIndex, origin: string): QueryResult | string {
    // Start by collecting all of the files that match the 'from' queries.
    let fileset = collectFromSource(query.source, index, origin);
    if (typeof fileset === 'string') return fileset;

    let rootContext = new Context(defaultLinkResolver(index, origin));

    // Then, map all of the files to their corresponding contexts.
    let rows: Context[] = [];
    for (let file of fileset) {
        let context = createContext(file, index, rootContext);
        if (context) rows.push(context);
    }

    for (let operation of query.operations) {
        switch (operation.type) {
            case "limit":
                let amount = rootContext.evaluate(operation.amount);
                if (typeof amount == 'string') return amount;
                if (amount.valueType != 'number') return `LIMIT clauses requires a number - got ${amount.valueType} (value ${amount.value})`;
                
                if (rows.length > amount.value) rows = rows.slice(0, amount.value);
                break;
            case "where":
                let predicate = operation.clause;
                rows = rows.filter(row => {
                    let value = row.evaluate(predicate);
                    if (typeof value == 'string') return false;
                    return Fields.isTruthy(value);
                });
                break;
            case "sort":
                let sortFields = operation.fields;
                // Sort rows by the sort fields, and then return the finished result.
                rows.sort((a, b) => {
                    for (let index = 0; index < sortFields.length; index++) {
                        let factor = sortFields[index].direction === 'ascending' ? 1 : -1;

                        let aValue = a.evaluate(sortFields[index].field);
                        if (typeof aValue == 'string') return 1;
                        let bValue = b.evaluate(sortFields[index].field);
                        if (typeof bValue == 'string') return -1;

                        let le = BINARY_OPS.evaluate('<', aValue, bValue) as LiteralFieldRepr<'boolean'>;
                        if (le.value) return factor * -1;

                        let ge = BINARY_OPS.evaluate('>', aValue, bValue) as LiteralFieldRepr<'boolean'>;
                        if (ge.value) return factor * 1;
                    }

                    return 0;
                });
                break;
            case "flatten":
                let flattenField = operation.field;
                let newRows: Context[] = [];
                for (let row of rows) {
                    let value = row.evaluate(flattenField.field);
                    if (typeof value == "string") continue;

                    if (value.valueType == "array") {
                        for (let newValue of value.value) {
                            newRows.push(row.copy().set(flattenField.name, newValue));
                        }
                    } else {
                        newRows.push(row);
                        continue;
                    }
                }

                rows = newRows;
                break;
            case "group":
                let groupField = operation.field;
                let groupIndex: Map<string, [LiteralField, Context[]]> = new Map();
                for (let row of rows) {
                    let value = row.evaluate(groupField.field);
                    if (typeof value == 'string') continue; // TODO: Maybe put in an '<error>' group?

                    let key = Fields.toLiteralKey(value);
                    if (!groupIndex.has(key)) groupIndex.set(key, [value, []]);

                    groupIndex.get(key)[1].push(row);
                }

                let groupedRows: Context[] = [];
                for (let [key, value] of groupIndex.entries()) {
                    // We are gaurunteed to have at least 1 object since the key was created.
                    let dummyFile = value[1][0].evaluate(Fields.indexVariable("file.path")) as LiteralFieldRepr<'string'>;

                    // Create a context, assign the grouped field and the 'rows'.
                    let context = new Context(defaultLinkResolver(index, dummyFile.value), rootContext);
                    context.set(groupField.name, value[0]);
                    context.set("rows", Fields.array(value[1].map(c => c.namespace)));

                    // This is a hack because I have a file association per-row, which breaks down in group queries.
                    context.set("file", Fields.object(new Map<string, LiteralField>().set("path", dummyFile)));
                    groupedRows.push(context);
                }

                rows = groupedRows;
                break;
        }
    }

    let hasFileLinks = rows.some(ctx => {
        let field = ctx.evaluate(Fields.indexVariable("file.link"))
        if (typeof field == "string") return false;
        return field.valueType == "link";
    });

    switch (query.header.type) {
        case "table":
            let tableFields = query.header.fields;
            if (hasFileLinks) tableFields.unshift(Fields.named("File", Fields.indexVariable("file.link")));

            return {
                names: tableFields.map(v => v.name),
                data: rows.map(row => {
                    return tableFields.map(f => {
                        let value = row.evaluate(f.field);
                        if (typeof value == "string") return Fields.NULL;
                        return value;
                    })
                })
            };
        case "list":
            let format = query.header.format;

            let listFields: NamedField[] = [];
            if (hasFileLinks) listFields.push(Fields.named("File", Fields.indexVariable("file.link")));
            if (format) listFields.push(Fields.named("Value", format));

            return {
                names: listFields.map(v => v.name),
                data: rows.map(row => {
                    return listFields.map(f => {
                        let value = row.evaluate(f.field);
                        if (typeof value == "string") return Fields.NULL;
                        return value;
                    })
                })
            };
        case "task":
            return {
                names: ["file"],
                data: rows.map(row => {
                    let file = row.evaluate(Fields.indexVariable("file.path"));
                    if (typeof file == "string") return null;
                    return [file];
                }).filter(k => k)
            }
    }
}

export function executeTask(query: Query, origin: string, index: FullIndex, cache: TaskCache): Map<string, Task[]> | string {
    // This is a somewhat silly way to do this for now; call into regular execute on the full query,
    // yielding a list of files. Then map the files to their tasks.
    // TODO: Consider per-task or per-task-block filtering via a more nuanced algorithm.

    // TODO: Hacky special-case for tasks; if no source provided, search everywhere.
    if (query.source.type === 'empty') {
        query.source = Sources.folder("");
    }

    let result = execute(query, index, origin);
    if (typeof result === 'string') return result;

    let realResult = new Map<string, Task[]>();
    for (let row of result.data) {
        let file = (row[0] as LiteralFieldRepr<'string'>).value;

        let tasks = cache.get(file);
        if (tasks == undefined || tasks.length == 0) continue;

        realResult.set(file, tasks);
    }

    return realResult;
}