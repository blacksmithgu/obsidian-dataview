/**
 * Takes a full query and a set of indices, and (hopefully quickly) returns all relevant files.
 */
import { LiteralType, LiteralTypeRepr, Field, LiteralField, LiteralFieldRepr, Query, BinaryOp, Fields, Source, Sources } from './query';
import { FullIndex, TaskCache } from './index';
import { Task } from './tasks';

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

export function evaluateBiop(op: BinaryOp, left: LiteralField, right: LiteralField): LiteralField | string {
    // Null short-circuit.
    if (left.valueType === 'null') {
        return `Cannot operate on a null field (left operand)`;
    } else if (right.valueType === 'null') {
        return `Cannot operate on a null field (right operand)`;
    }

    // TODO: This is ugly and big. Could/should be replaced with a lookup table.
    // This would also make operators like '<' and '>' and '=' much easier to write since we can
    // just write them in terms of other operations (as '>' == !'<=', for example).
    switch (op) {
        case "+":
            if (left.valueType === 'string') {
                return Fields.literal('string', left.value + "" + right.value);
            } else if (left.valueType === 'number' && right.valueType === 'number') {
                return Fields.literal('number', left.value + right.value);
            }

            return `Unrecognized operands for (+): ${left.valueType} + ${right.valueType}`;
        case "-":
            if (left.valueType === 'number' && right.valueType === 'number') {
                return Fields.literal('number', left.value + right.value);
            }

            return `Unrecognized operands for (-): ${left.valueType} - ${right.valueType}`;
        case "&":
            return Fields.literal('boolean', Fields.isTruthy(left) && Fields.isTruthy(right));
        case "|":
            return Fields.literal('boolean', Fields.isTruthy(left) || Fields.isTruthy(right));
        case "<":
            if (left.valueType === 'number' && right.valueType === 'number') {
                return Fields.literal('boolean', left.value < right.value);
            } else if (left.valueType === 'string' && right.valueType === 'string') {
                return Fields.literal('boolean', left.value < right.value);
            }

            return `Unrecognized operands for (<): ${left.valueType} < ${right.valueType}`;
        case "<=":
            if (left.valueType === 'number' && right.valueType === 'number') {
                return Fields.literal('boolean', left.value <= right.value);
            } else if (left.valueType === 'string' && right.valueType === 'string') {
                return Fields.literal('boolean', left.value <= right.value);
            }

            return `Unrecognized operands for (<=): ${left.valueType} <= ${right.valueType}`;
        case "=":
            if (left.valueType === 'number' && right.valueType === 'number') {
                return Fields.literal('boolean', left.value === right.value);
            } else if (left.valueType === 'string' && right.valueType === 'string') {
                return Fields.literal('boolean', left.value === right.value);
            }

            return `Unrecognized operands for (=): ${left.valueType} = ${right.valueType}`;
        case ">":
            if (left.valueType === 'number' && right.valueType === 'number') {
                return Fields.literal('boolean', left.value > right.value);
            } else if (left.valueType === 'string' && right.valueType === 'string') {
                return Fields.literal('boolean', left.value > right.value);
            }

            return `Unrecognized operands for (>): ${left.valueType} > ${right.valueType}`;
        case ">=":
            if (left.valueType === 'number' && right.valueType === 'number') {
                return Fields.literal('boolean', left.value >= right.value);
            } else if (left.valueType === 'string' && right.valueType === 'string') {
                return Fields.literal('boolean', left.value >= right.value);
            }

            return `Unrecognized operands for (>=): ${left.valueType} >= ${right.valueType}`;
    }
}

export function evaluate(field: Field, context: Map<string, LiteralField>): LiteralField | string {
    if (field.type === 'literal') return field;
    else if (field.type === 'variable') {
        let value = context.get(field.name);
        if (value == undefined || value == null) {
            return Fields.literal('null', null);
            // return `Could not find variable '${field.name}'; available variables are ${Array.from(context.keys()).join(", ")}`;
        } else {
            return value;
        }
    } else if (field.type === 'binaryop') {
        let left = evaluate(field.left, context);
        if (typeof left === 'string') return left;
        let right = evaluate(field.right, context);
        if (typeof right === 'string') return right;

        return evaluateBiop(field.op, left, right);
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

export function populateContextFrontmatter(context: Map<string, LiteralField>, prefix: string, node: Record<string, any>) {
    for (let key of Object.keys(node)) {
        let value = node[key];

        // TODO: Handle lists. Need special operators like 'contains' or 'in'.
        if (typeof value === 'number') {
            context.set(prefix + key, Fields.literal('number', value));
        } else if (typeof value === 'string') {
            context.set(prefix + key, Fields.literal('string', value));
        } else if (typeof value === 'object') {
            populateContextFrontmatter(context, prefix + key + ".", value as any);
        }
    }
}

/** Populate the initial context for the given file. */
export function populateContextFromMeta(file: string, index: FullIndex): Map<string, LiteralField> {
    let context = new Map<string, LiteralField>();
    // TODO: Add 'ctime', 'mtime' to fields. Make 'file' a link type.
    context.set("filepath", Fields.literal('string', file));
    context.set("filename", Fields.literal('string', getFileName(file)));

    let fileData = index.metadataCache.getCache(file);
    if (fileData && fileData.frontmatter) {
        populateContextFrontmatter(context, "", fileData.frontmatter);
    }

    return context;
}

/** Execute a query over the given index, returning  */
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

            let le = evaluateBiop('<', a.sort[index], b.sort[index]) as LiteralFieldRepr<'boolean'>;
            if (le.value) return factor * -1;

            let ge = evaluateBiop('>', a.sort[index], b.sort[index]) as LiteralFieldRepr<'boolean'>;
            if (ge.value) return factor * 1;
        }

        return 0;
    });

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