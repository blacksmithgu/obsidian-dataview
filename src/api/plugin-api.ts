/** The general, externally accessible plugin API (available at `app.plugins.plugins.dataview.api` or as global `DataviewAPI`). */

import { App, Component, MarkdownPostProcessorContext, TFile } from "obsidian";
import { FullIndex } from "data-index/index";
import { matchingSourcePaths } from "data-index/resolver";
import { Sources } from "data-index/source";
import { DataObject, Grouping, Groupings, Link, Literal, Values, Widgets } from "data-model/value";
import { EXPRESSION } from "expression/parse";
import { renderCodeBlock, renderErrorPre, renderValue } from "ui/render";
import { DataArray } from "./data-array";
import { BoundFunctionImpl, DEFAULT_FUNCTIONS, Functions } from "expression/functions";
import { Context } from "expression/context";
import {
    defaultLinkHandler,
    executeCalendar,
    executeInline,
    executeList,
    executeTable,
    executeTask,
    IdentifierMeaning,
} from "query/engine";
import { DateTime, Duration } from "luxon";
import * as Luxon from "luxon";
import { compare, CompareOperator, satisfies } from "compare-versions";
import { DataviewSettings, ExportSettings } from "settings";
import { parseFrontmatter } from "data-import/markdown-file";
import { SListItem, SMarkdownPage } from "data-model/serialized/markdown";
import { createFixedTaskView, createTaskView, nestGroups } from "ui/views/task-view";
import { createFixedListView, createListView } from "ui/views/list-view";
import { createFixedTableView, createTableView } from "ui/views/table-view";
import { Result } from "api/result";
import { parseQuery } from "query/parse";
import { tryOrPropagate } from "util/normalize";
import { Query } from "query/query";
import { DataviewCalendarRenderer } from "ui/views/calendar-view";
import { DataviewJSRenderer } from "ui/views/js-view";
import { markdownList, markdownTable, markdownTaskList } from "ui/export/markdown";

/** Asynchronous API calls related to file / system IO. */
export class DataviewIOApi {
    public constructor(public api: DataviewApi) {}

    /** Load the contents of a CSV asynchronously, returning a data array of rows (or undefined if it does not exist). */
    public async csv(path: Link | string, originFile?: string): Promise<DataArray<DataObject> | undefined> {
        if (!Values.isLink(path) && !Values.isString(path)) {
            throw Error(`dv.io.csv only handles string or link paths; was provided type '${typeof path}'.`);
        }

        let data = await this.api.index.csv.get(this.normalize(path, originFile));
        if (data.successful) return DataArray.from(data.value, this.api.settings);
        else throw Error(`Could not find CSV for path '${path}' (relative to origin '${originFile ?? "/"}')`);
    }

    /** Asynchronously load the contents of any link or path in an Obsidian vault. */
    public async load(path: Link | string, originFile?: string): Promise<string | undefined> {
        if (!Values.isLink(path) && !Values.isString(path)) {
            throw Error(`dv.io.load only handles string or link paths; was provided type '${typeof path}'.`);
        }

        let existingFile = this.api.index.vault.getAbstractFileByPath(this.normalize(path, originFile));
        if (!existingFile || !(existingFile instanceof TFile)) return undefined;

        return this.api.index.vault.cachedRead(existingFile);
    }

    /** Normalize a link or path relative to an optional origin file. Returns a textual fully-qualified-path. */
    public normalize(path: Link | string, originFile?: string): string {
        let realPath;
        if (Values.isLink(path)) realPath = path.path;
        else realPath = path;

        return this.api.index.prefix.resolveRelative(realPath, originFile);
    }
}

/** Global API for accessing the Dataview API, executing dataview queries, and  */
export class DataviewApi {
    /** Evaluation context which expressions can be evaluated in. */
    public evaluationContext: Context;
    /** IO API which supports asynchronous loading of data directly. */
    public io: DataviewIOApi;
    /** Dataview functions which can be called from DataviewJS. */
    public func: Record<string, BoundFunctionImpl>;
    /** Value utility functions for comparisons and type-checking. */
    public value = Values;
    /** Widget utility functions for creating built-in widgets. */
    public widget = Widgets;
    /** Re-exporting of luxon for people who can't easily require it. Sorry! */
    public luxon = Luxon;

    public constructor(
        public app: App,
        public index: FullIndex,
        public settings: DataviewSettings,
        private verNum: string
    ) {
        this.evaluationContext = new Context(defaultLinkHandler(index, ""), settings);
        this.func = Functions.bindAll(DEFAULT_FUNCTIONS, this.evaluationContext);
        this.io = new DataviewIOApi(this);
    }

    /** Utilities to check the current Dataview version and compare it to SemVer version ranges. */
    public version: {
        current: string;
        compare: (op: CompareOperator, ver: string) => boolean;
        satisfies: (range: string) => boolean;
    } = (() => {
        const self = this;
        return {
            get current() {
                return self.verNum;
            },
            compare: (op: CompareOperator, ver: string) => compare(this.verNum, ver, op),
            satisfies: (range: string) => satisfies(this.verNum, range),
        };
    })();

    /////////////////////////////
    // Index + Data Collection //
    /////////////////////////////

    /** Return an array of paths (as strings) corresponding to pages which match the query. */
    public pagePaths(query?: string, originFile?: string): DataArray<string> {
        let source;
        try {
            if (!query || query.trim() === "") source = Sources.folder("");
            else source = EXPRESSION.source.tryParse(query);
        } catch (ex) {
            throw new Error(`Failed to parse query in 'pagePaths': ${ex}`);
        }

        return matchingSourcePaths(source, this.index, originFile)
            .map(s => DataArray.from(s, this.settings))
            .orElseThrow();
    }

    /** Map a page path to the actual data contained within that page. */
    public page(path: string | Link, originFile?: string): Record<string, Literal> | undefined {
        if (!(typeof path === "string") && !Values.isLink(path)) {
            throw Error("dv.page only handles string and link paths; was provided type '" + typeof path + "'");
        }

        let rawPath = path instanceof Link ? path.path : path;
        let normPath = this.app.metadataCache.getFirstLinkpathDest(rawPath, originFile ?? "");
        if (!normPath) return undefined;

        let pageObject = this.index.pages.get(normPath.path);
        if (!pageObject) return undefined;

        return this._addDataArrays(pageObject.serialize(this.index));
    }

    /** Return an array of page objects corresponding to pages which match the source query. */
    public pages(query?: string, originFile?: string): DataArray<Record<string, Literal>> {
        return this.pagePaths(query, originFile).flatMap(p => {
            let res = this.page(p, originFile);
            return res ? [res] : [];
        });
    }

    /** Remaps important metadata to add data arrays.  */
    private _addDataArrays(pageObject: SMarkdownPage): SMarkdownPage {
        // Remap the "file" metadata entries to be data arrays.
        for (let [key, value] of Object.entries(pageObject.file)) {
            if (Array.isArray(value)) (pageObject.file as any)[key] = DataArray.wrap<any>(value, this.settings);
        }

        return pageObject;
    }

    /////////////
    // Utility //
    /////////////

    /**
     * Convert an input element or array into a Dataview data-array. If the input is already a data array,
     * it is returned unchanged.
     */
    public array(raw: unknown): DataArray<any> {
        if (DataArray.isDataArray(raw)) return raw;
        if (Array.isArray(raw)) return DataArray.wrap(raw, this.settings);
        return DataArray.wrap([raw], this.settings);
    }

    /** Return true if the given value is a javascript array OR a dataview data array. */
    public isArray(raw: unknown): raw is DataArray<any> | Array<any> {
        return DataArray.isDataArray(raw) || Array.isArray(raw);
    }

    /** Return true if the given value is a dataview data array; this returns FALSE for plain JS arrays. */
    public isDataArray(raw: unknown): raw is DataArray<any> {
        return DataArray.isDataArray(raw);
    }

    /** Create a dataview file link to the given path. */
    public fileLink(path: string, embed: boolean = false, display?: string) {
        return Link.file(path, embed, display);
    }

    /** Create a dataview section link to the given path. */
    public sectionLink(path: string, section: string, embed: boolean = false, display?: string): Link {
        return Link.header(path, section, embed, display);
    }

    /** Create a dataview block link to the given path. */
    public blockLink(path: string, blockId: string, embed: boolean = false, display?: string): Link {
        return Link.block(path, blockId, embed, display);
    }

    /** Attempt to extract a date from a string, link or date. */
    public date(pathlike: string | Link | DateTime): DateTime | null {
        return this.func.date(pathlike) as DateTime | null;
    }

    /** Attempt to extract a duration from a string or duration. */
    public duration(str: string | Duration): Duration | null {
        return this.func.dur(str) as Duration | null;
    }

    /** Parse a raw textual value into a complex Dataview type, if possible. */
    public parse(value: string): Literal {
        let raw = EXPRESSION.inlineField.parse(value);
        if (raw.status) return raw.value;
        else return value;
    }

    /** Convert a basic JS type into a Dataview type by parsing dates, links, durations, and so on. */
    public literal(value: any): Literal {
        return parseFrontmatter(value);
    }

    /** Deep clone the given literal, returning a new literal which is independent of the original. */
    public clone(value: Literal): Literal {
        return Values.deepCopy(value);
    }

    /**
     * Compare two arbitrary JavaScript values using Dataview's default comparison rules. Returns a negative value if
     * a < b, 0 if a = b, and a positive value if a > b.
     */
    public compare(a: any, b: any): number {
        return Values.compareValue(a, b, this.evaluationContext.linkHandler.normalize);
    }

    /** Return true if the two given JavaScript values are equal using Dataview's default comparison rules. */
    public equal(a: any, b: any): boolean {
        return this.compare(a, b) == 0;
    }

    ///////////////////////////////
    // Dataview Query Evaluation //
    ///////////////////////////////

    /**
     * Execute an arbitrary Dataview query, returning a query result which:
     *
     * 1. Indicates the type of query,
     * 2. Includes the raw AST of the parsed query.
     * 3. Includes the output in the form relevant to that query type.
     *
     * List queries will return a list of objects ({ id, value }); table queries return a header array
     * and a 2D array of values; and task arrays return a Grouping<Task> type which allows for recursive
     * task nesting.
     */
    public async query(
        source: string | Query,
        originFile?: string,
        settings?: QueryApiSettings
    ): Promise<Result<QueryResult, string>> {
        const query = typeof source === "string" ? parseQuery(source) : Result.success<Query, string>(source);
        if (!query.successful) return query.cast();

        const header = query.value.header;
        switch (header.type) {
            case "calendar":
                const cres = await executeCalendar(query.value, this.index, originFile ?? "", this.settings);
                if (!cres.successful) return cres.cast();

                return Result.success({ type: "calendar", values: cres.value.data });
            case "task":
                const tasks = await executeTask(query.value, originFile ?? "", this.index, this.settings);
                if (!tasks.successful) return tasks.cast();

                return Result.success({ type: "task", values: tasks.value.tasks });
            case "list":
                if (settings?.forceId !== undefined) header.showId = settings.forceId;

                const lres = await executeList(query.value, this.index, originFile ?? "", this.settings);
                if (!lres.successful) return lres.cast();

                // TODO: WITHOUT ID probably shouldn't exist, or should be moved to the engine itself.
                // For now, until I fix it up in an upcoming refactor, we re-implement the behavior here.

                return Result.success({
                    type: "list",
                    values: lres.value.data,
                    primaryMeaning: lres.value.primaryMeaning,
                });
            case "table":
                if (settings?.forceId !== undefined) header.showId = settings.forceId;

                const tres = await executeTable(query.value, this.index, originFile ?? "", this.settings);
                if (!tres.successful) return tres.cast();

                return Result.success({
                    type: "table",
                    values: tres.value.data,
                    headers: tres.value.names,
                    idMeaning: tres.value.idMeaning,
                });
        }
    }

    /** Error-throwing version of {@link query}. */
    public async tryQuery(source: string, originFile?: string, settings?: QueryApiSettings): Promise<QueryResult> {
        return (await this.query(source, originFile, settings)).orElseThrow();
    }

    /** Execute an arbitrary dataview query, returning the results in well-formatted markdown. */
    public async queryMarkdown(
        source: string | Query,
        originFile?: string,
        settings?: Partial<QueryApiSettings & ExportSettings>
    ): Promise<Result<string, string>> {
        const result = await this.query(source, originFile, settings);
        if (!result.successful) return result.cast();

        switch (result.value.type) {
            case "list":
                return Result.success(this.markdownList(result.value.values, settings));
            case "table":
                return Result.success(this.markdownTable(result.value.headers, result.value.values, settings));
            case "task":
                return Result.success(this.markdownTaskList(result.value.values, settings));
            case "calendar":
                return Result.failure("Cannot render calendar queries to markdown.");
        }
    }

    /** Error-throwing version of {@link queryMarkdown}. */
    public async tryQueryMarkdown(
        source: string | Query,
        originFile?: string,
        settings?: Partial<QueryApiSettings & ExportSettings>
    ): Promise<string> {
        return (await this.queryMarkdown(source, originFile, settings)).orElseThrow();
    }

    /**
     * Evaluate a dataview expression (like '2 + 2' or 'link("hello")'), returning the evaluated result.
     * This takes an optional second argument which provides definitions for variables, such as:
     *
     * ```
     * dv.evaluate("x + 6", { x: 2 }) = 8
     * dv.evaluate('link(target)', { target: "Okay" }) = [[Okay]]
     * ```
     *
     * This method returns a Result type instead of throwing an error; you can check the result of the
     * execution via `result.successful` and obtain `result.value` or `result.error` accordingly. If
     * you'd rather this method throw on an error, use `dv.tryEvaluate`.
     */
    public evaluate(expression: string, context?: DataObject, originFile?: string): Result<Literal, string> {
        let field = EXPRESSION.field.parse(expression);
        if (!field.status) return Result.failure(`Failed to parse expression "${expression}"`);

        let evaluationContext = originFile
            ? new Context(defaultLinkHandler(this.index, originFile), this.settings)
            : this.evaluationContext;

        return evaluationContext.evaluate(field.value, context);
    }

    /** Error-throwing version of `dv.evaluate`. */
    public tryEvaluate(expression: string, context?: DataObject, originFile?: string): Literal {
        return this.evaluate(expression, context, originFile).orElseThrow();
    }

    /** Evaluate an expression in the context of the given file. */
    public evaluateInline(expression: string, origin: string): Result<Literal, string> {
        let field = EXPRESSION.field.parse(expression);
        if (!field.status) return Result.failure(`Failed to parse expression "${expression}"`);

        return executeInline(field.value, origin, this.index, this.settings);
    }

    ///////////////
    // Rendering //
    ///////////////

    /**
     * Execute the given query, rendering results into the given container using the components lifecycle.
     * Your component should be a *real* component which calls onload() on it's child components at some point,
     * or a MarkdownPostProcessorContext!
     *
     * Note that views made in this way are live updating and will automatically clean themselves up when
     * the component is unloaded or the container is removed.
     */
    public async execute(
        source: string,
        container: HTMLElement,
        component: Component | MarkdownPostProcessorContext,
        filePath: string
    ) {
        if (isDataviewDisabled(filePath)) {
            renderCodeBlock(container, source);
            return;
        }

        let maybeQuery = tryOrPropagate(() => parseQuery(source));

        // In case of parse error, just render the error.
        if (!maybeQuery.successful) {
            renderErrorPre(container, "Dataview: " + maybeQuery.error);
            return;
        }

        let query = maybeQuery.value;
        let init = { app: this.app, settings: this.settings, index: this.index, container };
        let childComponent;
        switch (query.header.type) {
            case "task":
                childComponent = createTaskView(init, query as Query, filePath);
                component.addChild(childComponent);
                break;
            case "list":
                childComponent = createListView(init, query as Query, filePath);
                component.addChild(childComponent);

                break;
            case "table":
                childComponent = createTableView(init, query as Query, filePath);

                component.addChild(childComponent);
                break;
            case "calendar":
                childComponent = new DataviewCalendarRenderer(
                    query as Query,
                    container,
                    this.index,
                    filePath,
                    this.settings,
                    this.app
                );

                component.addChild(childComponent);
                break;
        }
        childComponent.load();
    }

    /**
     * Execute the given DataviewJS query, rendering results into the given container using the components lifecycle.
     * See {@link execute} for general rendering semantics.
     */
    public async executeJs(
        code: string,
        container: HTMLElement,
        component: Component | MarkdownPostProcessorContext,
        filePath: string
    ) {
        if (isDataviewDisabled(filePath)) {
            renderCodeBlock(container, code, "javascript");
            return;
        }
        const renderer = new DataviewJSRenderer(this, code, container, filePath);
        renderer.load();
        component.addChild(renderer);
    }

    /** Render a dataview list of the given values. */
    public async list(
        values: any[] | DataArray<any> | undefined,
        container: HTMLElement,
        component: Component,
        filePath: string
    ) {
        if (!values) return;
        if (values !== undefined && values !== null && !Array.isArray(values) && !DataArray.isDataArray(values))
            values = Array.from(values);

        // Append a child div, since React will keep re-rendering otherwise.
        let subcontainer = container.createEl("div");
        component.addChild(
            createFixedListView(
                { app: this.app, settings: this.settings, index: this.index, container: subcontainer },
                values as Literal[],
                filePath
            )
        );
    }

    /** Render a dataview table with the given headers, and the 2D array of values. */
    public async table(
        headers: string[],
        values: any[][] | DataArray<any> | undefined,
        container: HTMLElement,
        component: Component,
        filePath: string
    ) {
        if (!headers) headers = [];
        if (!values) values = [];
        if (!Array.isArray(headers) && !DataArray.isDataArray(headers)) headers = Array.from(headers);

        // Append a child div, since React will keep re-rendering otherwise.
        let subcontainer = container.createEl("div");
        component.addChild(
            createFixedTableView(
                { app: this.app, settings: this.settings, index: this.index, container: subcontainer },
                headers,
                values as Literal[][],
                filePath
            )
        );
    }

    /** Render a dataview task view with the given tasks. */
    public async taskList(
        tasks: Grouping<SListItem>,
        groupByFile: boolean = true,
        container: HTMLElement,
        component: Component,
        filePath: string = ""
    ) {
        let groupedTasks =
            !Groupings.isGrouping(tasks) && groupByFile ? this.array(tasks).groupBy(t => Link.file(t.path)) : tasks;

        // Append a child div, since React will override several task lists otherwise.
        let taskContainer = container.createEl("div");
        component.addChild(
            createFixedTaskView(
                { app: this.app, settings: this.settings, index: this.index, container: taskContainer },
                groupedTasks as Grouping<SListItem>,
                filePath
            )
        );
    }

    /** Render an arbitrary value into a container. */
    public async renderValue(
        value: any,
        container: HTMLElement,
        component: Component,
        filePath: string,
        inline: boolean = false
    ) {
        return renderValue(this.app, value as Literal, container, filePath, component, this.settings, inline);
    }

    /////////////////
    // Data Export //
    /////////////////

    /** Render data to a markdown table. */
    public markdownTable(
        headers: string[] | undefined,
        values: any[][] | DataArray<any> | undefined,
        settings?: Partial<ExportSettings>
    ): string {
        if (!headers) headers = [];
        if (!values) values = [];

        const combined = Object.assign({}, this.settings, settings);
        return markdownTable(headers, values as any[][], combined);
    }

    /** Render data to a markdown list. */
    public markdownList(values: any[] | DataArray<any> | undefined, settings?: Partial<ExportSettings>): string {
        if (!values) values = [];

        const combined = Object.assign({}, this.settings, settings);
        return markdownList(values as any[], combined);
    }

    /** Render tasks or list items to a markdown task list. */
    public markdownTaskList(values: Grouping<SListItem>, settings?: Partial<ExportSettings>): string {
        if (!values) values = [];

        const sparse = nestGroups(values);
        const combined = Object.assign({}, this.settings, settings);
        return markdownTaskList(sparse as any[], combined);
    }
}

/** The result of executing a table query. */
export type TableResult = { type: "table"; headers: string[]; values: Literal[][]; idMeaning: IdentifierMeaning };
/** The result of executing a list query. */
export type ListResult = { type: "list"; values: Literal[]; primaryMeaning: IdentifierMeaning };
/** The result of executing a task query. */
export type TaskResult = { type: "task"; values: Grouping<SListItem> };
/** The result of executing a calendar query. */
export type CalendarResult = {
    type: "calendar";
    values: {
        date: DateTime;
        link: Link;
        value?: Literal[];
    }[];
};

/** The result of executing a query of some sort. */
export type QueryResult = TableResult | ListResult | TaskResult | CalendarResult;

/** Settings when querying the dataview API. */
export type QueryApiSettings = {
    /** If present, then this forces queries to include/exclude the implicit id field (such as with `WITHOUT ID`). */
    forceId?: boolean;
};

/** Determines if source-path has a `?no-dataview` annotation that disables dataview. */
export function isDataviewDisabled(sourcePath: string): boolean {
    if (!sourcePath) return false;

    let questionLocation = sourcePath.lastIndexOf("?");
    if (questionLocation == -1) return false;

    return sourcePath.substring(questionLocation).contains("no-dataview");
}
