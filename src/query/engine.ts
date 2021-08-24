/**
 * Takes a full query and a set of indices, and (hopefully quickly) returns all relevant files.
 */
import { FullIndex } from "data/index";
import { Context, LinkHandler } from "expression/context";
import { resolveSource, Datarow } from "data/resolver";
import { DataObject, LiteralValue, Values, Task } from "data/value";
import { ListQuery, Query, QueryOperation, TableQuery } from "query/query";
import { Result } from "api/result";
import { Field } from "expression/field";
import { QuerySettings } from "settings";
import { DateTime } from "luxon";

function iden<T>(x: T): T {
    return x;
}

/** Operation diagnostics collected during the execution of each query step. */
export interface OperationDiagnostics {
    timeMs: number;
    incomingRows: number;
    outgoingRows: number;
    errors: { index: number; message: string }[];
}

export type IdentifierMeaning = { type: "group"; name: string; on: IdentifierMeaning } | { type: "path" };

/** A data row over an object. */
export type Pagerow = Datarow<DataObject>;
/** An error during execution. */
export type ExecutionError = { index: number; message: string };

/** The result of executing query operations over incoming data rows; includes timing and error information. */
export interface CoreExecution {
    data: Pagerow[];
    idMeaning: IdentifierMeaning;
    timeMs: number;
    ops: QueryOperation[];
    diagnostics: OperationDiagnostics[];
}

/** Shared execution code which just takes in arbitrary data, runs operations over it, and returns it + per-row errors. */
export function executeCore(rows: Pagerow[], context: Context, ops: QueryOperation[]): Result<CoreExecution, string> {
    let diagnostics = [];
    let identMeaning: IdentifierMeaning = { type: "path" };
    let startTime = new Date().getTime();

    for (let op of ops) {
        let opStartTime = new Date().getTime();
        let incomingRows = rows.length;
        let errors: { index: number; message: string }[] = [];

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
                let taggedData: { data: Pagerow; fields: LiteralValue[] }[] = [];
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
                        let factor = sortFields[index].direction === "ascending" ? 1 : -1;
                        let le = context.binaryOps
                            .evaluate("<", a.fields[index], b.fields[index], context)
                            .orElse(false);
                        if (Values.isTruthy(le)) return factor * -1;

                        let ge = context.binaryOps
                            .evaluate(">", a.fields[index], b.fields[index], context)
                            .orElse(false);
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
                    return Result.failure(
                        `Failed to execute 'limit' statement: limit should be a number, but got '${Values.typeOf(
                            limiting.value
                        )}' (${limiting.value})`
                    );

                rows = rows.slice(0, limiting.value);
                break;
            case "group":
                let groupData: { data: Pagerow; key: LiteralValue }[] = [];
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
                    let le = context.binaryOps.evaluate("<", a.key, b.key, context).orElse(false);
                    if (Values.isTruthy(le)) return -1;

                    let ge = context.binaryOps.evaluate(">", a.key, b.key, context).orElse(false);
                    if (Values.isTruthy(ge)) return 1;

                    return 0;
                });

                // Then walk through and find fields that are equal.
                let finalGroupData: { key: LiteralValue; rows: DataObject[]; [groupKey: string]: LiteralValue }[] = [];
                if (groupData.length > 0)
                    finalGroupData.push({
                        key: groupData[0].key,
                        rows: [groupData[0].data.data],
                        [op.field.name]: groupData[0].key,
                    });

                for (let index = 1; index < groupData.length; index++) {
                    let curr = groupData[index],
                        prev = groupData[index - 1];
                    if (context.binaryOps.evaluate("=", curr.key, prev.key, context).orElse(false)) {
                        finalGroupData[finalGroupData.length - 1].rows.push(curr.data.data);
                    } else {
                        finalGroupData.push({
                            key: curr.key,
                            rows: [curr.data.data],
                            [op.field.name]: curr.key,
                        });
                    }
                }

                rows = finalGroupData.map(d => {
                    return { id: d.key, data: d };
                });
                identMeaning = { type: "group", name: op.field.name, on: identMeaning };
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
                if (identMeaning.type == "group" && identMeaning.name == op.field.name) identMeaning = identMeaning.on;
                break;
            default:
                return Result.failure("Unrecognized query operation '" + op.type + "'");
        }

        if (errors.length >= incomingRows && incomingRows > 0) {
            return Result.failure(`Every row during operation '${op.type}' failed with an error; first ${Math.min(
                3,
                errors.length
            )}:\n
                ${errors
                    .slice(0, 3)
                    .map(d => "- " + d.message)
                    .join("\n")}`);
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
        idMeaning: identMeaning,
        ops,
        diagnostics,
        timeMs: new Date().getTime() - startTime,
    });
}

/** Expanded version of executeCore which adds an additional "extraction" step to the pipeline. */
export function executeCoreExtract(
    rows: Pagerow[],
    context: Context,
    ops: QueryOperation[],
    fields: Record<string, Field>
): Result<CoreExecution, string> {
    let internal = executeCore(rows, context, ops);
    if (!internal.successful) return internal;

    let core = internal.value;
    let startTime = new Date().getTime();
    let errors: ExecutionError[] = [];
    let res: Pagerow[] = [];

    outer: for (let index = 0; index < core.data.length; index++) {
        let page: Pagerow = { id: core.data[index].id, data: {} };
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

    if (errors.length >= core.data.length && core.data.length > 0) {
        return Result.failure(`Every row during final data extraction failed with an error; first ${Math.max(
            errors.length,
            3
        )}:\n
            ${errors
                .slice(0, 3)
                .map(d => "- " + d.message)
                .join("\n")}`);
    }

    let execTime = new Date().getTime() - startTime;
    return Result.success({
        data: res,
        idMeaning: core.idMeaning,
        diagnostics: core.diagnostics.concat([
            {
                timeMs: execTime,
                incomingRows: core.data.length,
                outgoingRows: res.length,
                errors,
            },
        ]),
        ops: core.ops.concat([{ type: "extract", fields }]),
        timeMs: core.timeMs + execTime,
    });
}

export interface ListExecution {
    core: CoreExecution;
    data: { primary: LiteralValue; value?: LiteralValue }[];
    primaryMeaning: IdentifierMeaning;
}

/** Execute a list-based query, returning the final results. */
export function executeList(
    query: Query,
    index: FullIndex,
    origin: string,
    settings: QuerySettings
): Result<ListExecution, string> {
    // Start by collecting all of the files that match the 'from' queries.
    let fileset = resolveSource(query.source, index, origin);
    if (!fileset.successful) return Result.failure(fileset.error);

    // Extract information about the origin page to add to the root context.
    let rootContext = new Context(defaultLinkHandler(index, origin), settings, {
        this: index.pages.get(origin)?.toObject(index) ?? {},
    });

    let targetField = (query.header as ListQuery).format;
    let fields: Record<string, Field> = targetField ? { target: targetField } : {};

    return executeCoreExtract(fileset.value, rootContext, query.operations, fields).map(core => {
        let data = core.data.map(p =>
            iden({
                primary: p.id,
                value: p.data["target"] ?? undefined,
            })
        );

        return { primaryMeaning: core.idMeaning, core, data };
    });
}

/** Result of executing a table query. */
export interface TableExecution {
    core: CoreExecution;
    names: string[];
    data: { id: LiteralValue; values: LiteralValue[] }[];
    idMeaning: IdentifierMeaning;
}

/** Execute a table query. */
export function executeTable(
    query: Query,
    index: FullIndex,
    origin: string,
    settings: QuerySettings
): Result<TableExecution, string> {
    // Start by collecting all of the files that match the 'from' queries.
    let fileset = resolveSource(query.source, index, origin);
    if (!fileset.successful) return Result.failure(fileset.error);

    // Extract information about the origin page to add to the root context.
    let rootContext = new Context(defaultLinkHandler(index, origin), settings, {
        this: index.pages.get(origin)?.toObject(index) ?? {},
    });

    let targetFields = (query.header as TableQuery).fields;
    let fields: Record<string, Field> = {};
    for (let field of targetFields) fields[field.name] = field.field;

    return executeCoreExtract(fileset.value, rootContext, query.operations, fields).map(core => {
        let names = targetFields.map(f => f.name);
        let data = core.data.map(p =>
            iden({
                id: p.id,
                values: targetFields.map(f => p.data[f.name]),
            })
        );

        return { core, names, data, idMeaning: core.idMeaning };
    });
}

export interface TaskExecution {
    core: CoreExecution;
    tasks: Map<string, Task[]>;
}

/** Execute a task query, returning all matching tasks. */
export function executeTask(
    query: Query,
    origin: string,
    index: FullIndex,
    settings: QuerySettings
): Result<TaskExecution, string> {
    // This is a somewhat silly way to do this for now; call into regular execute on the full query,
    // yielding a list of files. Then map the files to their tasks.
    let fileset = resolveSource(query.source, index, origin);
    if (!fileset.successful) return Result.failure(fileset.error);

    // Extract information about the origin page to add to the root context.
    let rootContext = new Context(defaultLinkHandler(index, origin), settings, {
        this: index.pages.get(origin)?.toObject(index) ?? {},
    });

    let tasksAsPages: Pagerow[] = [];

    for (let row of fileset.value) {
        if (!Values.isLink(row.id)) continue;

        let page = index.pages.get(row.id.path);
        if (page == undefined) {
            continue;
        }
        let defaultsFromPage = {
            createdDate: DateTime.fromObject({
                year: page.ctime.year,
                month: page.ctime.month,
                day: page.ctime.day,
            }),
            completedDate: DateTime.fromObject({
                year: page.mtime.year,
                month: page.mtime.month,
                day: page.mtime.day,
            }),
        };

        let tasks = page.tasks;
        if (tasks == undefined) {
            continue;
        }

        tasks.forEach(t => {
            let data = t;
            if (!data.createdDate) {
                data.createdDate = defaultsFromPage.createdDate;
            }
            if (t.completed && !data.completedDate) {
                data.completedDate = defaultsFromPage.completedDate;
            }
            tasksAsPages.push({
                id: t.id(),
                data,
            } as Pagerow);
        });
    }

    // Per-task filtering
    // TODO: Consider per-task-block filtering via a more nuanced algorithm.
    return executeCoreExtract(tasksAsPages, rootContext, query.operations, {}).map(core => {
        let realResult = new Map<string, Task[]>();

        let taskIds = new Set(core.data.map(t => t.id));
        tasksAsPages.forEach(t => {
            if (!taskIds.has(t.id)) {
                return;
            }
            let task = t.data as Task;
            let tasks = realResult.get(task.path) || [];
            tasks.push(task);
            realResult.set(task.path, tasks);
        });

        return {
            core,
            tasks: realResult,
        };
    });
}

/** Execute a single field inline a file, returning the evaluated result. */
export function executeInline(
    field: Field,
    origin: string,
    index: FullIndex,
    settings: QuerySettings
): Result<LiteralValue, string> {
    return new Context(defaultLinkHandler(index, origin), settings, {
        this: index.pages.get(origin)?.toObject(index) ?? {},
    }).evaluate(field);
}

/** The default link resolver used when creating contexts. */
export function defaultLinkHandler(index: FullIndex, origin: string): LinkHandler {
    return {
        resolve: link => {
            let realFile = index.metadataCache.getFirstLinkpathDest(link, origin);
            if (!realFile) return null;

            let realPage = index.pages.get(realFile.path);
            if (!realPage) return null;

            return realPage.toObject(index);
        },
        normalize: link => {
            let realFile = index.metadataCache.getFirstLinkpathDest(link, origin);
            return realFile?.path ?? link;
        },
        exists: link => {
            let realFile = index.metadataCache.getFirstLinkpathDest(link, origin);
            return !!realFile;
        },
    };
}
