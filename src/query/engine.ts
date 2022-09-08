/**
 * Takes a full query and a set of indices, and (hopefully quickly) returns all relevant files.
 */
import { FullIndex } from "data-index/index";
import { Context, LinkHandler } from "expression/context";
import { resolveSource, Datarow, matchingSourcePaths } from "data-index/resolver";
import { DataObject, Link, Literal, Values, Grouping, Widgets } from "data-model/value";
import { CalendarQuery, ListQuery, Query, QueryOperation, TableQuery } from "query/query";
import { Result } from "api/result";
import { Field, Fields } from "expression/field";
import { QuerySettings } from "settings";
import { DateTime } from "luxon";
import { SListItem } from "data-model/serialized/markdown";

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

/** The meaning of the 'id' field for a data row - i.e., where it came from. */
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
    let startTime = Date.now();

    for (let op of ops) {
        let opStartTime = Date.now();
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
                let taggedData: { data: Pagerow; fields: Literal[] }[] = [];
                outer: for (let index = 0; index < rows.length; index++) {
                    let row = rows[index];
                    let rowSorts: Literal[] = [];
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
                let groupData: { data: Pagerow; key: Literal }[] = [];
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
                let finalGroupData: { key: Literal; rows: DataObject[]; [groupKey: string]: Literal }[] = [];
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
            timeMs: Date.now() - opStartTime,
        });
    }

    return Result.success({
        data: rows,
        idMeaning: identMeaning,
        ops,
        diagnostics,
        timeMs: Date.now() - startTime,
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
    let startTime = Date.now();
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

    let execTime = Date.now() - startTime;
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
    data: Literal[];
    primaryMeaning: IdentifierMeaning;
}

/** Execute a list-based query, returning the final results. */
export async function executeList(
    query: Query,
    index: FullIndex,
    origin: string,
    settings: QuerySettings
): Promise<Result<ListExecution, string>> {
    // Start by collecting all of the files that match the 'from' queries.
    let fileset = await resolveSource(query.source, index, origin);
    if (!fileset.successful) return Result.failure(fileset.error);

    // Extract information about the origin page to add to the root context.
    let rootContext = new Context(defaultLinkHandler(index, origin), settings, {
        this: index.pages.get(origin)?.serialize(index) ?? {},
    });

    let targetField = (query.header as ListQuery).format;
    let showId = (query.header as ListQuery).showId;
    let fields: Record<string, Field> = targetField ? { target: targetField } : {};

    return executeCoreExtract(fileset.value, rootContext, query.operations, fields).map(core => {
        let data: Literal[];
        if (showId && targetField) {
            data = core.data.map(p => Widgets.listPair(p.id, p.data["target"] ?? null));
        } else if (targetField) {
            data = core.data.map(p => p.data["target"] ?? null);
        } else {
            data = core.data.map(p => p.id);
        }

        return { primaryMeaning: core.idMeaning, core, data };
    });
}

/** Result of executing a table query. */
export interface TableExecution {
    core: CoreExecution;
    names: string[];
    data: Literal[][];
    idMeaning: IdentifierMeaning;
}

/** Execute a table query. */
export async function executeTable(
    query: Query,
    index: FullIndex,
    origin: string,
    settings: QuerySettings
): Promise<Result<TableExecution, string>> {
    // Start by collecting all of the files that match the 'from' queries.
    let fileset = await resolveSource(query.source, index, origin);
    if (!fileset.successful) return Result.failure(fileset.error);

    // Extract information about the origin page to add to the root context.
    let rootContext = new Context(defaultLinkHandler(index, origin), settings, {
        this: index.pages.get(origin)?.serialize(index) ?? {},
    });

    let targetFields = (query.header as TableQuery).fields;
    let showId = (query.header as TableQuery).showId;
    let fields: Record<string, Field> = {};
    for (let field of targetFields) fields[field.name] = field.field;

    return executeCoreExtract(fileset.value, rootContext, query.operations, fields).map(core => {
        if (showId) {
            const idName = core.idMeaning.type === "group" ? core.idMeaning.name : settings.tableIdColumnName;
            let names = [idName].concat(targetFields.map(f => f.name));

            let data = core.data.map(p => ([p.id] as Literal[]).concat(targetFields.map(f => p.data[f.name])));
            return { core, names, data, idMeaning: core.idMeaning };
        } else {
            let names = targetFields.map(f => f.name);

            let data = core.data.map(p => targetFields.map(f => p.data[f.name]));
            return { core, names, data, idMeaning: core.idMeaning };
        }
    });
}

/** The result of executing a task query. */
export interface TaskExecution {
    core: CoreExecution;
    tasks: Grouping<SListItem>;
}

/** Maps a raw core execution result to a task grouping which is much easier to render. */
function extractTaskGroupings(id: IdentifierMeaning, rows: DataObject[]): Grouping<SListItem> {
    switch (id.type) {
        case "path":
            return rows as SListItem[];
        case "group":
            let key = id.name;
            return rows.map(r =>
                iden({
                    key: r[key],
                    rows: extractTaskGroupings(id.on, r.rows as DataObject[]),
                })
            );
    }
}

/** Execute a task query, returning all matching tasks. */
export async function executeTask(
    query: Query,
    origin: string,
    index: FullIndex,
    settings: QuerySettings
): Promise<Result<TaskExecution, string>> {
    let fileset = matchingSourcePaths(query.source, index, origin);
    if (!fileset.successful) return Result.failure(fileset.error);

    // Collect tasks from pages which match.
    let incomingTasks: Pagerow[] = [];
    for (let path of fileset.value) {
        let page = index.pages.get(path);
        if (!page) continue;

        let pageData = page.serialize(index);
        let pageTasks = pageData.file.tasks.map(t => {
            const tcopy = Values.deepCopy(t);

            // Add page data to this copy.
            for (let [key, value] of Object.entries(pageData)) {
                if (key in tcopy) continue;
                tcopy[key] = value;
            }

            return { id: `${pageData.path}#${t.line}`, data: tcopy };
        });

        for (let task of pageTasks) incomingTasks.push(task);
    }

    // Extract information about the origin page to add to the root context.
    let rootContext = new Context(defaultLinkHandler(index, origin), settings, {
        this: index.pages.get(origin)?.serialize(index) ?? {},
    });

    return executeCore(incomingTasks, rootContext, query.operations).map(core => {
        return {
            core,
            tasks: extractTaskGroupings(
                core.idMeaning,
                core.data.map(r => r.data)
            ),
        };
    });
}

/** Execute a single field inline a file, returning the evaluated result. */
export function executeInline(
    field: Field,
    origin: string,
    index: FullIndex,
    settings: QuerySettings
): Result<Literal, string> {
    return new Context(defaultLinkHandler(index, origin), settings, {
        this: index.pages.get(origin)?.serialize(index) ?? {},
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

            return realPage.serialize(index);
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

/** Execute a calendar-based query, returning the final results. */
export async function executeCalendar(
    query: Query,
    index: FullIndex,
    origin: string,
    settings: QuerySettings
): Promise<Result<CalendarExecution, string>> {
    // Start by collecting all of the files that match the 'from' queries.
    let fileset = await resolveSource(query.source, index, origin);
    if (!fileset.successful) return Result.failure(fileset.error);

    // Extract information about the origin page to add to the root context.
    let rootContext = new Context(defaultLinkHandler(index, origin), settings, {
        this: index.pages.get(origin)?.serialize(index) ?? {},
    });

    let targetField = (query.header as CalendarQuery).field.field;
    let fields: Record<string, Field> = {
        target: targetField,
        link: Fields.indexVariable("file.link"),
    };

    return executeCoreExtract(fileset.value, rootContext, query.operations, fields).map(core => {
        let data = core.data.map(p =>
            iden({
                date: p.data["target"] as DateTime,
                link: p.data["link"] as Link,
            })
        );

        return { core, data };
    });
}

export interface CalendarExecution {
    core: CoreExecution;
    data: { date: DateTime; link: Link; value?: Literal[] }[];
}
