/**
 * Takes a full query and a set of indices, and (hopefully quickly) returns all relevant files.
 */
import { LiteralType, LiteralTypeRepr, Field, LiteralField, LiteralFieldRepr, Query, BinaryOp, Fields, Source, Sources, QUERY_LANGUAGE } from './query';
import { FullIndex, TaskCache } from './index';
import { Task } from './tasks';
import { DateTime, Duration } from 'luxon';
import { TFile } from 'obsidian';

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

/** A literal type or a catch-all '*'. */
type LiteralTypeOrAll = LiteralType | '*';
/** Maps a literal type or the catch-all '*'. */
type LiteralFieldReprAll<T extends LiteralTypeOrAll> =
    T extends '*' ? LiteralField :
    T extends LiteralType ? LiteralFieldRepr<T> :
    any;

/** A handler function which handles combining two fields with an operator. */
export type BinaryOpImpl<T1 extends LiteralTypeOrAll, T2 extends LiteralTypeOrAll> =
    (a: LiteralFieldReprAll<T1>, b: LiteralFieldReprAll<T2>) => LiteralField | string;

/** Class which allows for type-safe implementation of binary ops. */
export class BinaryOpHandler {
    map: Map<string, BinaryOpImpl<LiteralTypeOrAll, LiteralTypeOrAll>>;

    static create() {
        return new BinaryOpHandler();
    }

    constructor() {
        this.map = new Map();
    }

    /** Add a new handler for the specified types to this handler. */
    public add<T1 extends LiteralTypeOrAll, T2 extends LiteralTypeOrAll>(op: BinaryOp, first: T1, second: T2,
        func: BinaryOpImpl<T1, T2>): BinaryOpHandler {
        this.map.set(BinaryOpHandler.repr(op, first, second), func);
        return this;
    }

    /**
     * Add a commutative operator for the specified types to this handler; in addition to adding the normal
     * (op, T1, T2) mapping, it additionally adds (op, T2, T1). Only needed if T1 and T2 are different types.
     */
    public addComm<T1 extends LiteralTypeOrAll, T2 extends LiteralTypeOrAll>(op: BinaryOp, first: T1, second: T2,
        func: BinaryOpImpl<T1, T2>): BinaryOpHandler {
        this.map.set(BinaryOpHandler.repr(op, first, second), func);
        this.map.set(BinaryOpHandler.repr(op, second, first), ((a, b) => func(b, a)) as BinaryOpImpl<T2, T1>);

        return this;
    }

    /** Attempt to evaluate the given binary operator on the two literal fields. */
    public evaluate(op: BinaryOp, left: LiteralField, right: LiteralField): LiteralField | string {
        let handler = this.map.get(BinaryOpHandler.repr(op, left.valueType, right.valueType));
        if (handler) return handler(left, right);

        // Left-'*' fallback:
        let handler2 = this.map.get(BinaryOpHandler.repr(op, '*', right.valueType));
        if (handler2) return handler2(left, right);

        // Right-'*' fallback:
        let handler3 = this.map.get(BinaryOpHandler.repr(op, left.valueType, '*'));
        if (handler3) return handler3(left, right);

        // Double '*' fallback.
        let handler4 = this.map.get(BinaryOpHandler.repr(op, '*', '*'));
        if (handler4) return handler4(left, right);

        return `Operator '${op}' is not supported for '${left.valueType}' and '${right.valueType}`;
    }

    private static repr(op: BinaryOp, left: LiteralTypeOrAll, right: LiteralTypeOrAll) {
        return `${op},${left},${right}`
    }
}

export const BINARY_OPS = BinaryOpHandler.create()
    // Numeric operations.
    .add('+', 'number', 'number', (a, b) => Fields.literal('number', a.value + b.value))
    .add('-', 'number', 'number', (a, b) => Fields.literal('number', a.value - b.value))
    .add('<', 'number', 'number', (a, b) => Fields.literal('boolean', a.value < b.value))
    .add('<=', 'number', 'number', (a, b) => Fields.literal('boolean', a.value <= b.value))
    .add('>=', 'number', 'number', (a, b) => Fields.literal('boolean', a.value >= b.value))
    .add('>', 'number', 'number', (a, b) => Fields.literal('boolean', a.value > b.value))
    .add('=', 'number', 'number', (a, b) => Fields.literal('boolean', a.value == b.value))
    .add('!=', 'number', 'number', (a, b) => Fields.literal('boolean', a.value != b.value))
    // String operations.
    .addComm('+', 'string', '*', (a, b) => Fields.literal('string', a.value + b.value))
    .add('-', 'string', 'string', (a, b) => "String subtraction is not defined")
    .add('<', 'string', 'string', (a, b) => Fields.literal('boolean', a.value < b.value))
    .add('<=', 'string', 'string', (a, b) => Fields.literal('boolean', a.value <= b.value))
    .add('>=', 'string', 'string', (a, b) => Fields.literal('boolean', a.value >= b.value))
    .add('>', 'string', 'string', (a, b) => Fields.literal('boolean', a.value > b.value))
    .add('=', 'string', 'string', (a, b) => Fields.literal('boolean', a.value == b.value))
    .add('!=', 'string', 'string', (a, b) => Fields.literal('boolean', a.value != b.value))
    // Date Operations.
    .add("-", 'date', 'date', (a, b) => Fields.literal('duration', b.value.until(a.value).toDuration("seconds")))
    .add('<', 'date', 'date', (a, b) => Fields.literal('boolean', a.value < b.value))
    .add('<=', 'date', 'date', (a, b) => Fields.literal('boolean', a.value <= b.value))
    .add('>=', 'date', 'date', (a, b) => Fields.literal('boolean', a.value >= b.value))
    .add('>', 'date', 'date', (a, b) => Fields.literal('boolean', a.value > b.value))
    .add('=', 'date', 'date', (a, b) => Fields.literal('boolean', a.value.equals(b.value)))
    .add('!=', 'date', 'date' , (a, b) => Fields.literal('boolean', !a.value.equals(b.value)))
    // Duration operations.
    .add('+', 'duration', 'duration', (a, b) => Fields.literal('duration', a.value.plus(b.value)))
    .add('-', 'duration', 'duration', (a, b) => Fields.literal('duration', a.value.minus(b.value)))
    .add('<', 'duration', 'duration', (a, b) => Fields.literal('boolean', a.value < b.value))
    .add('<=', 'duration', 'duration', (a, b) => Fields.literal('boolean', a.value < b.value))
    .add('>=', 'duration', 'duration', (a, b) => Fields.literal('boolean', a.value < b.value))
    .add('>', 'duration', 'duration', (a, b) => Fields.literal('boolean', a.value < b.value))
    .add('=', 'duration', 'duration', (a, b) => Fields.literal('boolean', a.value.equals(b.value)))
    .add('!=', 'duration', 'duration', (a, b) => Fields.literal('boolean', !a.value.equals(b.value)))
    // Date-Duration operations.
    .addComm('+', 'date', 'duration', (a, b) => Fields.literal('date', a.value.plus(b.value)))
    .add('-', 'date', 'duration', (a, b) => Fields.literal('date', a.value.minus(b.value)))
    // Boolean operations.
    .add('&', '*', '*', (a, b) => Fields.literal('boolean', Fields.isTruthy(a) && Fields.isTruthy(b)))
    .add('|', '*', '*', (a, b) => Fields.literal('boolean', Fields.isTruthy(a) || Fields.isTruthy(b)))
    // Null comparisons.
    .add('=', 'null', 'null', (a, b) => Fields.literal('boolean', true))
    .add('!=', 'null', 'null', (a, b) => Fields.literal('boolean', false))
    .add('<', 'null', 'null', (a, b) => Fields.literal('boolean', false))
    .add('<=', 'null', 'null', (a, b) => Fields.literal('boolean', true))
    .add('>=', 'null', 'null', (a, b) => Fields.literal('boolean', true))
    .add('>', 'null', 'null', (a, b) => Fields.literal('boolean', false))
    // Fall-back comparisons-to-null.
    .add('<', 'null', '*', (a, b) => Fields.literal('boolean', true))
    .add('<', '*', 'null', (a, b) => Fields.literal('boolean', false))
    .add('>', 'null', '*', (a, b) => Fields.literal('boolean', false))
    .add('>', '*', 'null', (a, b) => Fields.literal('boolean', true))
    .add('>=', 'null', '*', (a, b) => Fields.literal('boolean', false))
    .add('>=', '*', 'null', (a, b) => Fields.literal('boolean', true))
    .add('<=', 'null', '*', (a, b) => Fields.literal('boolean', true))
    .add('<=', '*', 'null', (a, b) => Fields.literal('boolean', false))
    ;

/** Get the file name for the file, without any parent directories. */
export function getFileName(path: string): string {
    if (path.contains("/")) return path.substring(path.lastIndexOf("/") + 1);
    else return path;
}

/** Evaluate a field in the given context. */
export function evaluate(field: Field, context: Map<string, LiteralField>): LiteralField | string {
    if (field.type === 'literal') return field;
    else if (field.type === 'variable') {
        let value = context.get(field.name);
        if (value == undefined || value == null) return Fields.literal('null', null);
        else return value;
    } else if (field.type === 'binaryop') {
        let left = evaluate(field.left, context);
        if (typeof left === 'string') return left;
        let right = evaluate(field.right, context);
        if (typeof right === 'string') return right;

        return BINARY_OPS.evaluate(field.op, left, right);
    }
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
    }
}

export function parseFrontmatterString(value: string): LiteralField {
    let dateParse = QUERY_LANGUAGE.date.parse(value);
    if (dateParse.status) {
        return Fields.literal('date', dateParse.value);
    }

    let durationParse = QUERY_LANGUAGE.duration.parse(value);
    if (durationParse.status) {
        return Fields.literal('duration', durationParse.value);
    }

    return Fields.literal('string', value);
}

export function populateContextFrontmatter(context: Map<string, LiteralField>, prefix: string, node: Record<string, any>) {
    for (let key of Object.keys(node)) {
        let value = node[key];

        // TODO: Handle lists. Need special operators like 'contains' or 'in'.
        if (value == null) {
            context.set(prefix + key, Fields.literal('null', null));
        } else if (typeof value === 'number') {
            context.set(prefix + key, Fields.literal('number', value));
        } else if (typeof value === 'string') {
            context.set(prefix + key, parseFrontmatterString(value));
        } else if (typeof value === 'object') {
            populateContextFrontmatter(context, prefix + key + ".", value as any);
        }
    }
}

/** Populate the initial context for the given file. */
export function populateContextFromMeta(file: string, index: FullIndex): Map<string, LiteralField> {
    let context = new Map<string, LiteralField>();
    // TODO: Add 'ctime', 'mtime' to fields. Make 'file' a link type.
    context.set("file.path", Fields.literal('string', file));
    context.set("file.name", Fields.literal('string', getFileName(file)));

    // If the file has a date name, add it as the 'day' field.
    let dateMatch = /(\d{4})-(\d{2})-(\d{2})/.exec(getFileName(file));
    if (dateMatch) {
        let year = Number.parseInt(dateMatch[1]);
        let month = Number.parseInt(dateMatch[2]);
        let day = Number.parseInt(dateMatch[3]);
        context.set("file.day", Fields.literal('date', DateTime.fromObject({ year, month, day })))
    }

    // Populate file metadata.
    let afile = index.vault.getAbstractFileByPath(file);
    if (afile && afile instanceof TFile) {
        context.set('file.ctime', Fields.literal('date', DateTime.fromMillis(afile.stat.ctime)));
        context.set('file.mtime', Fields.literal('date', DateTime.fromMillis(afile.stat.mtime)));
        context.set('file.size', Fields.literal('number', afile.stat.size));
    }

    // Populate from frontmatter.
    let fileData = index.metadataCache.getCache(file);
    if (fileData && fileData.frontmatter) {
        populateContextFrontmatter(context, "", fileData.frontmatter);
    }

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
        let context = populateContextFromMeta(file, index);

        for (let nfield of query.fields) {
            let value = evaluate(nfield.field, context);
            if (typeof value === 'string') {
                errors.push([file, value]);
                continue outer;
            }

            context.set(nfield.name, value);
        }

        // Then check if this file passes the filter.
        let passes = evaluate(query.where, context);
        if (typeof passes === 'string') {
            errors.push([file, passes]);
            continue outer;
        }

        if (!Fields.isTruthy(passes)) continue;

        // Finally, compute the sort fields for later sorting.
        let sorts = [];
        for (let sort of query.sortBy) {
            let value = evaluate(sort.field, context);
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