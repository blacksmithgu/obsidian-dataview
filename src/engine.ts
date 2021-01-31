/**
 * Takes a full query and a set of indices, and (hopefully quickly) returns all relevant files.
 */
import { LiteralType, LiteralTypeRepr, Field, LiteralField, LiteralFieldRepr, Query, BinaryOp, Fields } from './query';
import { FullIndex } from './index';
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

/** Execute a query over the given index, returning  */
export function execute(query: Query, index: FullIndex): QueryResult | string {
    // Start by collecting all of the files that match the 'from' queries.
    let fileset = new Set<string>();
    for (let tag of query.from) {
        for (let file of index.tag.get(tag)) fileset.add(file);
    }
    // And eliminate files that match the 'except'.
    for (let tag of query.except) {
        for (let file of index.tag.get(tag)) fileset.delete(file);
    }

    // TODO: Schema inference from file data.
    // Then, evaluate each file one at a time.
    let errors: [string, string][] = [];
    let rows: QueryRow[] = [];
    outer: for (let file of fileset) {
        let context = new Map<string, LiteralField>();
        // TODO: Add 'ctime', 'mtime' to fields. Make 'file' a link type.
        context.set("filepath", Fields.literal('string', file));
        context.set("filename", Fields.literal('string', getFileName(file)));

        let fileData = index.metadataCache.getCache(file);
        if (fileData && fileData.frontmatter) {
            for (let key of Object.keys(fileData.frontmatter)) {
                if (key === 'position') continue;

                let value = fileData.frontmatter[key];
                // TODO: Handle lists and dicts.
                // For dicts, just recurse (so stuff like 'dict.element.thing' whatever).
                // For lists, need special operators (probably 'has'/'in'/other predicates).
                if (typeof value === 'number') {
                    context.set(key, Fields.literal('number', value));
                } else if (typeof value === 'string') {
                    context.set(key, Fields.literal('string', value));
                }
            }
        }

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

// TODO: Implement this. At what level do we filter tasks? I'm thinking per-file for now,
// and then we can move this to per-task block. Per individual task may be wierd to render.
// The main complication is how to handle subtasks - do you filter those too? What if only
// a subtask matches, but not a task?
export function executeTask(query: Query, index: FullIndex): Map<string, Task[]> | string {
    return null;
}