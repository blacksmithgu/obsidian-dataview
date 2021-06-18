/**
 * Takes a full query and a set of indices, and (hopefully quickly) returns all relevant files.
 */
import { FullIndex } from 'src/data/index';
import { Task } from 'src/data/file';
import { Context, LinkHandler } from 'src/expression/context';
import { collectPages, Datarow } from 'src/data/collector';
import { DataObject, LiteralValue, Values } from 'src/data/value';
import { ListQuery, Query, QueryOperation, TableQuery } from './query';
import { Result } from 'src/api/result';
import { Field } from 'src/expression/field';

function iden<T>(x: T): T { return x; }

/** Operation diagnostics collected during the execution of each query step. */
export interface OperationDiagnostics {
    timeMs: number;
    incomingRows: number;
    outgoingRows: number;
    errors: { index: number, message: string }[];
}

/** A data row over an object. */
export type Pagerow = Datarow<DataObject>;
/** An error during execution. */
export type ExecutionError = { index: number, message: string};

/** The result of executing query operations over incoming data rows; includes timing and error information. */
export interface CoreExecution {
    data: Pagerow[];
    timeMs: number;
    ops: QueryOperation[];
    diagnostics: OperationDiagnostics[];
}

/** Shared execution code which just takes in arbitrary data, runs operations over it, and returns it + per-row errors. */
export function executeCore(rows: Pagerow[], context: Context, ops: QueryOperation[]): Result<CoreExecution, string> {
    let diagnostics = [];
    let startTime = new Date().getTime();

    for (let op of ops) {
        let opStartTime = new Date().getTime();
        let incomingRows = rows.length;
        let errors: { index: number, message: string }[] = [];

        switch (op.type) {
            case "where":
                let whereResult: Pagerow[] = [];
                for (let index = 0; index < rows.length; index++) {
                    let row = rows[index];
                    let value = context.evaluate(op.clause, row.data);
                    if (!value.successful) errors.push({ index, message: value.error });
                    else if (Values.isTruthy(value.value)) whereResult.push(row);
                }

                rows = whereResult;
                break;
            case "sort":
                let sortFields = op.fields;
                let taggedData: { data: Pagerow, fields: LiteralValue[] }[] = [];
                outer: for (let index = 0; index < rows.length; index++) {
                    let row = rows[index];
                    let rowSorts: LiteralValue[] = [];
                    for (let sIndex = 0; sIndex < sortFields.length; sIndex++) {
                        let value = context.evaluate(sortFields[sIndex].field, row.data);
                        if (!value.successful) {
                            errors.push({ index, message: value.error });
                            continue outer;
                        }

                        rowSorts.push(value.value);
                    }

                    taggedData.push({ data: row, fields: rowSorts });
                }

                // Sort rows by the sort fields, and then return the finished result.
                taggedData.sort((a, b) => {
                    for (let index = 0; index < sortFields.length; index++) {
                        let factor = sortFields[index].direction === 'ascending' ? 1 : -1;
                        let le = context.binaryOps.evaluate('<', a.fields[index], b.fields[index]).orElse(false);
                        if (Values.isTruthy(le)) return factor * -1;

                        let ge = context.binaryOps.evaluate('>', a.fields[index], b.fields[index]).orElse(false);
                        if (Values.isTruthy(ge)) return factor * 1;
                    }

                    return 0;
                });

                rows = taggedData.map(v => v.data);
                break;
            case "limit":
                let limiting = context.evaluate(op.amount);
                if (!limiting.successful)
                    return Result.failure("Failed to execute 'limit' statement: " + limiting.error);
                if (!Values.isNumber(limiting.value))
                    return Result.failure(`Failed to execute 'limit' statement: limit should be a number, but got '${Values.typeOf(limiting.value)}' (${limiting.value})`);

                rows = rows.slice(0, limiting.value);
                break;
            case "group":
                let groupData: { data: Pagerow, key: LiteralValue }[] = [];
                for (let index = 0; index < rows.length; index++) {
                    let value = context.evaluate(op.field.field, rows[index].data);
                    if (!value.successful) {
                        errors.push({ index, message: value.error });
                        continue;
                    }

                    groupData.push({ data: rows[index], key: value.value });
                }

                // Sort by the key, which we will group on shortly.
                groupData.sort((a, b) => {
                    let le = context.binaryOps.evaluate('<', a.key, b.key).orElse(false);
                    if (Values.isTruthy(le)) return -1;

                    let ge = context.binaryOps.evaluate('>', a.key, b.key).orElse(false);
                    if (Values.isTruthy(ge)) return 1;

                    return 0;
                });

                // Then walk through and find fields that are equal.
                let finalGroupData: { key: LiteralValue; rows: DataObject[] }[] = [];
                if (groupData.length > 0) finalGroupData.push({ key: groupData[0].key, rows: [groupData[0].data.data] });

                for (let index = 1; index < groupData.length; index++) {
                    let curr = groupData[index], prev = groupData[index - 1];
                    if (context.binaryOps.evaluate('=', curr.key, prev.key).orElse(false)) {
                        finalGroupData[finalGroupData.length - 1].rows.push(curr.data.data);
                    } else {
                        finalGroupData.push({ key: curr.key, rows: [curr.data.data] });
                    }
                }

                rows = finalGroupData.map(d => { return { id: d.key, data: d }});
                break;
            case "flatten":
                let flattenResult: Pagerow[] = [];
                for (let index = 0; index < rows.length; index++) {
                    let row = rows[index];
                    let value = context.evaluate(op.field.field, row.data);
                    if (!value.successful) {
                        errors.push({ index, message: value.error });
                        continue;
                    }

                    let datapoints = Values.isArray(value.value) ? value.value : [value.value];
                    for (let v of datapoints) {
                        let copy = Values.deepCopy(row);
                        copy.data[op.field.name] = v;
                        flattenResult.push(copy);
                    }
                }

                rows = flattenResult;
                break;
            default:
                return Result.failure("Unrecognized query operation '" + op.type + "'");
        }

        if (errors.length >= incomingRows) {
            return Result.failure(`Every row during operation '${op.type}' failed with an error; first three:\n
                ${errors.slice(0, 3).map(d => "- " + d.message).join("\n")}`);
        }

        diagnostics.push({
            incomingRows,
            errors,
            outgoingRows: rows.length,
            timeMs: new Date().getTime() - opStartTime,
        });
    }

    return Result.success({
        data: rows,
        ops,
        diagnostics,
        timeMs: new Date().getTime() - startTime,
    });
}

/** Expanded version of executeCore which adds an additional "extraction" step to the pipeline. */
export function executeCoreExtract(rows: Pagerow[], context: Context, ops: QueryOperation[], fields: Record<string, Field>): Result<CoreExecution, string> {
    let internal = executeCore(rows, context, ops);
    if (!internal.successful) return internal;

    let core = internal.value;
    let startTime = new Date().getTime();
    let errors: ExecutionError[] = [];
    let res: Pagerow[] = [];

    outer: for (let index = 0; index < core.data.length; index++) {
        let page: Pagerow = { id: core.data[index].id, data: {}};
        for (let [name, field] of Object.entries(fields)) {
            let value = context.evaluate(field, core.data[index].data);
            if (!value.successful) {
                errors.push({ index: index, message: value.error });
                continue outer;
            }

            page.data[name] = value.value;
        }
        res.push(page);
    }

    if (errors.length >= core.data.length) {
        return Result.failure(`Every row during final data extraction failed with an error; first three:\n
            ${errors.slice(0, 3).map(d => "- " + d.message).join("\n")}`);
    }

    let execTime = new Date().getTime() - startTime;
    return Result.success({
        data: res,
        diagnostics: core.diagnostics.concat([{
            timeMs: execTime,
            incomingRows: core.data.length,
            outgoingRows: res.length,
            errors
        }]),
        ops: core.ops.concat([{ type: 'extract', fields }]),
        timeMs: core.timeMs + execTime
    });
}

export interface ListExecution {
    core: CoreExecution;
    data: { primary: LiteralValue, value?: LiteralValue }[];
}

/** Execute a list-based query, returning the fina lresults. */
export function executeList(query: Query, index: FullIndex, origin: string): Result<ListExecution, string> {
    // Start by collecting all of the files that match the 'from' queries.
    let fileset = collectPages(query.source, index, origin);
    if (!fileset.successful) return Result.failure(fileset.error);

    // Extract information about the origin page to add to the root context.
    let rootContext = new Context(defaultLinkHandler(index, origin),
        index.pages.get(origin)?.toObject(index) ?? {});

    let targetField = (query.header as ListQuery).format;
    let fields: Record<string, Field> = targetField ? { "target": targetField } : { };

    return executeCoreExtract(fileset.value, rootContext, query.operations, fields).map(core => {
        let data = core.data.map(p => iden({
            primary: p.id,
            value: p.data["target"] ?? undefined
        }));

        return { core, data };
    });
}

/** Result of executing a table query. */
export interface TableExecution {
    core: CoreExecution;
    names: string[];
    data: LiteralValue[][];
}

/** Execute a table query. */
export function executeTable(query: Query, index: FullIndex, origin: string): Result<TableExecution, string> {
    // Start by collecting all of the files that match the 'from' queries.
    let fileset = collectPages(query.source, index, origin);
    if (!fileset.successful) return Result.failure(fileset.error);

    // Extract information about the origin page to add to the root context.
    let rootContext = new Context(defaultLinkHandler(index, origin),
        index.pages.get(origin)?.toObject(index) ?? {});

    let targetFields = (query.header as TableQuery).fields;
    let fields: Record<string, Field> = {};
    for (let field of targetFields) fields[field.name] = field.field;

    return executeCoreExtract(fileset.value, rootContext, query.operations, fields).map(core => {
        let names = targetFields.map(f => f.name);
        let data = core.data.map(p => targetFields.map(f => p.data[f.name]));

        return { core, names, data };
    });
}

export interface TaskExecution {
    core: CoreExecution;
    tasks: Map<string, Task[]>;
}

/** Execute a task query, returning all matching tasks. */
export function executeTask(query: Query, origin: string, index: FullIndex): Result<TaskExecution, string> {
    // This is a somewhat silly way to do this for now; call into regular execute on the full query,
    // yielding a list of files. Then map the files to their tasks.
    // TODO: Consider per-task or per-task-block filtering via a more nuanced algorithm.
    let fileset = collectPages(query.source, index, origin);
    if (!fileset.successful) return Result.failure(fileset.error);

    // Extract information about the origin page to add to the root context.
    let rootContext = new Context(defaultLinkHandler(index, origin),
        index.pages.get(origin)?.toObject(index) ?? {});

    return executeCoreExtract(fileset.value, rootContext, query.operations, {}).map(core => {
        let realResult = new Map<string, Task[]>();
        for (let row of core.data) {
            if (!Values.isLink(row.id)) continue;

            let tasks = index.pages.get(row.id.path)?.tasks;
            if (tasks == undefined || tasks.length == 0) continue;

            realResult.set(row.id.path, tasks);
        }

        return {
            core,
            tasks: realResult
        };
    });
}

/** Execute a single field inline a file, returning the evaluated result. */
export function executeInline(field: Field, origin: string, index: FullIndex): Result<LiteralValue, string> {
    return new Context(defaultLinkHandler(index, origin), index.pages.get(origin)?.toObject(index) ?? {})
        .evaluate(field);
}

/** The default link resolver used when creating contexts. */
export function defaultLinkHandler(index: FullIndex, origin: string): LinkHandler {
    return {
        resolve: (link) => {
            let realFile = index.metadataCache.getFirstLinkpathDest(link, origin);
            if (!realFile) return null;

            let realPage = index.pages.get(realFile.path);
            if (!realPage) return null;

            return realPage.toObject(index);
        },
        normalize: (link) => {
            let realFile = index.metadataCache.getFirstLinkpathDest(link, origin);
            return realFile?.path ?? link;
        },
        exists: (link) => {
            let realFile = index.metadataCache.getFirstLinkpathDest(link, origin);
            return !!realFile;
        }
    }
}
