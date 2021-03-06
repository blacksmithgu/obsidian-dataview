/**
 * Takes a full query and a set of indices, and (hopefully quickly) returns all relevant files.
 */
import { LiteralType, Field, LiteralField, LiteralFieldRepr, Query, BinaryOp, Fields, Source, Sources } from './query';
import { FullIndex, TaskCache } from './index';
import { Task } from './tasks';
import { DateTime, Duration } from 'luxon';
import { TFile } from 'obsidian';
import { EXPRESSION } from './parse';
import { Context, BINARY_OPS } from './eval';

/** The result of executing a query over an index. */
export interface QueryResult {
    /** The names of the resulting fields. */
    names: string[];
    /** The actual data rows returned. */
    data: QueryRow[];
}

/** Internal row computed during execution; includes some sorting metadata. */
export interface QueryRow {
    /** The file this data row came from. */
    file: string;
    /** The data produced by this row. */
    data: LiteralField[];
    /** The sort fields used to sort this row. */
    sort: LiteralField[];
}

/** Get the file name for the file, without any parent directories. */
export function getFileName(path: string): string {
    if (path.contains("/")) return path.substring(path.lastIndexOf("/") + 1);
    else return path;
}

/** Recursively collect target files from the given source. */
export function collectFromSource(source: Source, index: FullIndex): Set<string> | string {
    if (source.type === 'empty') {
        return new Set<string>();
    } else if (source.type === 'tag') {
        return index.tag.get(source.tag);
    } else if (source.type === 'folder') {
        return index.prefix.get(source.folder);
    } else if (source.type === 'binaryop') {
        let left = collectFromSource(source.left, index);
        if (typeof left === 'string') return left;
        let right = collectFromSource(source.right, index);
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
        let child = collectFromSource(source.child, index);
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

export function createContext(file: string, index: FullIndex): Context {
    // Parse the frontmatter if present.
    let frontmatterData = Fields.emptyObject();
    let fileData = index.metadataCache.getCache(file);
    if (fileData && fileData.frontmatter) {
        frontmatterData = parseFrontmatter(fileData.frontmatter) as LiteralFieldRepr<'object'>;
    }

    // Create a context which uses the cache to look up link info.
    let context = new Context((file) => {
        let meta = index.metadataCache.getCache(file);
        if (!meta) {
            file += ".md";
            meta = index.metadataCache.getCache(file);
        }

        // TODO: Hacky, change this later.
        if (meta && meta.frontmatter) return createContext(file, index).namespace;
        else return Fields.NULL;
    }, frontmatterData);

    // Fill out per-file metadata.
    let fileMeta = new Map<string, LiteralField>();
    fileMeta.set("path", Fields.literal('string', file));
    fileMeta.set("name", Fields.literal('string', getFileName(file)));
    fileMeta.set("link", Fields.link(file));

    // If the file has a date name, add it as the 'day' field.
    let dateMatch = /(\d{4})-(\d{2})-(\d{2})/.exec(getFileName(file));
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
        fileMeta.set('size', Fields.literal('number', afile.stat.size));
    }

    context.set("file", Fields.object(fileMeta));

    return context;
}

/** Execute a query over the given index, returning all matching rows. */
export function execute(query: Query, index: FullIndex): QueryResult | string {
    // Start by collecting all of the files that match the 'from' queries.
    let fileset = collectFromSource(query.source, index);
    if (typeof fileset === 'string') return fileset;

    // TODO: Schema inference from file data.
    // Then, evaluate each file one at a time.
    let errors: [string, string][] = [];
    let rows: QueryRow[] = [];
    outer: for (let file of fileset) {
        let context = createContext(file, index);

        for (let nfield of query.fields) {
            let value = context.evaluate(nfield.field);
            if (typeof value === 'string') {
                errors.push([file, value]);
                continue outer;
            }

            context.set(nfield.name, value);
        }

        // Then check if this file passes the filter.
        let passes = context.evaluate(query.where);
        if (typeof passes === 'string') {
            errors.push([file, passes]);
            continue outer;
        }

        if (!Fields.isTruthy(passes)) continue;

        // Finally, compute the sort fields for later sorting.
        let sorts = [];
        for (let sort of query.sortBy) {
            let value = context.evaluate(sort.field);
            if (typeof value === 'string') {
                errors.push([file, value]);
                continue outer;
            }

            sorts.push(value);
        }

        rows.push({
            file,
            data: query.fields.map(f => context.get(f.name)),
            sort: sorts
        });
    }

    // Sort rows by the sort fields, and then return the finished result.
    rows.sort((a, b) => {
        for (let index = 0; index < a.sort.length; index++) {
            let factor = query.sortBy[index].direction === 'ascending' ? 1 : -1;

            let le = BINARY_OPS.evaluate('<', a.sort[index], b.sort[index]) as LiteralFieldRepr<'boolean'>;
            if (le.value) return factor * -1;

            let ge = BINARY_OPS.evaluate('>', a.sort[index], b.sort[index]) as LiteralFieldRepr<'boolean'>;
            if (ge.value) return factor * 1;
        }

        return 0;
    });

    // TODO: Add query LIMIT support.

    return {
        names: query.fields.map(f => f.name),
        data: rows
    };
}

export function executeTask(query: Query, index: FullIndex, cache: TaskCache): Map<string, Task[]> | string {
    // This is a somewhat silly way to do this for now; call into regular execute on the full query,
    // yielding a list of files. Then map the files to their tasks.
    // TODO: Consider per-task or per-task-block filtering via a more nuanced algorithm.

    // TODO: Hacky special-case for tasks; if no source provided, search everywhere.
    if (query.source.type === 'empty') {
        query.source = Sources.folder("");
    }

    let result = execute(query, index);
    if (typeof result === 'string') return result;

    let realResult = new Map<string, Task[]>();
    for (let row of result.data) {
        let tasks = cache.get(row.file);
        if (tasks == undefined || tasks.length == 0) continue;

        realResult.set(row.file, tasks);
    }

    return realResult;
}