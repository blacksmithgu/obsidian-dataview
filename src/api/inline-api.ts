/** Fancy wrappers for the JavaScript API, used both by external plugins AND by the dataview javascript view. */

import { App, Component } from "obsidian";
import { FullIndex } from "data-index";
import { renderValue, renderErrorPre } from "ui/render";
import type { DataviewApi, DataviewIOApi, QueryApiSettings, QueryResult } from "api/plugin-api";
import { DataviewSettings, ExportSettings } from "settings";
import { DataObject, Grouping, Link, Literal, Values, Widgets } from "data-model/value";
import { BoundFunctionImpl, DEFAULT_FUNCTIONS, Functions } from "expression/functions";
import { Context } from "expression/context";
import { defaultLinkHandler } from "query/engine";
import { DateTime, Duration } from "luxon";
import * as Luxon from "luxon";
import { DataArray } from "./data-array";
import { SListItem } from "data-model/serialized/markdown";
import { EXPRESSION } from "expression/parse";
import { Result } from "api/result";

/** Asynchronous API calls related to file / system IO. */
export class DataviewInlineIOApi {
    public constructor(public api: DataviewIOApi, public currentFile: string) {}

    /** Load the contents of a CSV asynchronously, returning a data array of rows (or undefined if it does not exist). */
    public async csv(path: string, originFile?: string): Promise<DataArray<DataObject> | undefined> {
        return this.api.csv(path, originFile || this.currentFile);
    }

    /** Asynchronously load the contents of any link or path in an Obsidian vault. */
    public async load(path: Link | string, originFile?: string): Promise<string | undefined> {
        return this.api.load(path, originFile || this.currentFile);
    }

    /** Normalize a link or path relative to an optional origin file. Returns a textual fully-qualified-path. */
    public normalize(path: Link | string, originFile?: string): string {
        return this.api.normalize(path, originFile || this.currentFile);
    }
}

export class DataviewInlineApi {
    /**
     * The raw dataview indices, which track file <-> metadata relations. Use these if the intuitive API does not support
     * your use case.
     */
    public index: FullIndex;

    /** The component that handles the lifetime of this view. Use it if you are adding custom event handlers/components. */
    public component: Component;

    /** The path to the current file this script is running in. */
    public currentFilePath: string;

    /**
     * The container which holds the output of this view. You can directly append fields to this, if you wish, though
     * the rendering API is likely to be easier for straight-forward purposes.
     */
    public container: HTMLElement;

    /** Directly access the Obsidian app object, such as for reaching out to other plugins. */
    public app: App;

    /** The general plugin API which much of this inline API delegates to. */
    public api: DataviewApi;

    /** Settings which determine defaults, incl. many rendering options. */
    public settings: DataviewSettings;

    /** Evaluation context which expressions can be evaluated in. */
    public evaluationContext: Context;

    /** Value utilities which allow for type-checking and comparisons. */
    public value = Values;

    /** Widget utility functions for creating built-in widgets. */
    public widget = Widgets;

    /** IO utilities which are largely asynchronous. */
    public io: DataviewInlineIOApi;

    /** Re-exporting of luxon for people who can't easily require it. Sorry! */
    public luxon = Luxon;

    /** Dataview functions which can be called from DataviewJS. */
    public func: Record<string, BoundFunctionImpl>;

    constructor(api: DataviewApi, component: Component, container: HTMLElement, currentFilePath: string) {
        this.index = api.index;
        this.app = api.app;
        this.settings = api.settings;

        this.component = component;
        this.container = container;
        this.currentFilePath = currentFilePath;

        this.api = api;
        this.io = new DataviewInlineIOApi(this.api.io, this.currentFilePath);

        // Set up the evaluation context with variables from the current file.
        let fileMeta = this.index.pages.get(this.currentFilePath)?.serialize(this.index) ?? {};
        this.evaluationContext = new Context(defaultLinkHandler(this.index, this.currentFilePath), this.settings, {
            this: fileMeta,
        });

        this.func = Functions.bindAll(DEFAULT_FUNCTIONS, this.evaluationContext);
    }

    /////////////////////////////
    // Index + Data Collection //
    /////////////////////////////

    /** Return an array of paths (as strings) corresponding to pages which match the query. */
    public pagePaths(query?: string): DataArray<string> {
        return this.api.pagePaths(query, this.currentFilePath);
    }

    /** Map a page path to the actual data contained within that page. */
    public page(path: string | Link): DataObject | undefined {
        return this.api.page(path, this.currentFilePath);
    }

    /** Return an array of page objects corresponding to pages which match the query. */
    public pages(query?: string): DataArray<any> {
        return this.api.pages(query, this.currentFilePath);
    }

    /** Return the information about the current page. */
    public current(): Record<string, any> | undefined {
        return this.page(this.currentFilePath);
    }

    ///////////////////////////////
    // Dataview Query Evaluation //
    ///////////////////////////////

    /** Execute a Dataview query, returning the results in programmatic form. */
    public async query(
        source: string,
        originFile?: string,
        settings?: QueryApiSettings
    ): Promise<Result<QueryResult, string>> {
        return this.api.query(source, originFile ?? this.currentFilePath, settings);
    }

    /** Error-throwing version of {@link query}. */
    public async tryQuery(source: string, originFile?: string, settings?: QueryApiSettings): Promise<QueryResult> {
        return this.api.tryQuery(source, originFile ?? this.currentFilePath, settings);
    }

    /** Execute a Dataview query, returning the results in Markdown. */
    public async queryMarkdown(
        source: string,
        originFile?: string,
        settings?: QueryApiSettings
    ): Promise<Result<string, string>> {
        return this.api.queryMarkdown(source, originFile ?? this.currentFilePath, settings);
    }

    /** Error-throwing version of {@link queryMarkdown}. */
    public async tryQueryMarkdown(source: string, originFile?: string, settings?: QueryApiSettings): Promise<string> {
        return this.api.tryQueryMarkdown(source, originFile ?? this.currentFilePath, settings);
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
     * Note that `this` is implicitly available and refers to the current file.
     *
     * This method returns a Result type instead of throwing an error; you can check the result of the
     * execution via `result.successful` and obtain `result.value` or `result.error` accordingly. If
     * you'd rather this method throw on an error, use `dv.tryEvaluate`.
     */
    public evaluate(expression: string, context?: DataObject): Result<Literal, string> {
        let field = EXPRESSION.field.parse(expression);
        if (!field.status) return Result.failure(`Failed to parse expression "${expression}"`);

        return this.evaluationContext.evaluate(field.value, context);
    }

    /** Error-throwing version of `dv.evaluate`. */
    public tryEvaluate(expression: string, context?: DataObject): Literal {
        return this.evaluate(expression, context).orElseThrow();
    }

    /** Execute a Dataview query and embed it into the current view. */
    public async execute(source: string) {
        this.api.execute(source, this.container, this.component, this.currentFilePath);
    }

    /** Execute a DataviewJS query and embed it into the current view. */
    public async executeJs(code: string) {
        this.api.executeJs(code, this.container, this.component, this.currentFilePath);
    }

    /////////////
    // Utility //
    /////////////

    /**
     * Convert an input element or array into a Dataview data-array. If the input is already a data array,
     * it is returned unchanged.
     */
    public array(raw: any): DataArray<any> {
        return this.api.array(raw);
    }

    /** Return true if the given value is a javascript array OR a dataview data array. */
    public isArray(raw: any): raw is DataArray<any> | Array<any> {
        return this.api.isArray(raw);
    }

    /** Return true if the given value is a dataview data array; this returns FALSE for plain JS arrays. */
    public isDataArray(raw: unknown): raw is DataArray<any> {
        return DataArray.isDataArray(raw);
    }

    /** Create a dataview file link to the given path. */
    public fileLink(path: string, embed: boolean = false, display?: string): Link {
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
        return this.api.date(pathlike);
    }

    /** Attempt to extract a duration from a string or duration. */
    public duration(dur: string | Duration): Duration | null {
        return this.api.duration(dur);
    }

    /** Parse a raw textual value into a complex Dataview type, if possible. */
    public parse(value: string): Literal {
        return this.api.parse(value);
    }

    /** Convert a basic JS type into a Dataview type by parsing dates, links, durations, and so on. */
    public literal(value: any): Literal {
        return this.api.literal(value);
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
        return Values.compareValue(a, b);
    }

    /** Return true if the two given JavaScript values are equal using Dataview's default comparison rules. */
    public equal(a: any, b: any): boolean {
        return this.compare(a, b) == 0;
    }

    /////////////////////////
    // Rendering Functions //
    /////////////////////////

    /** Render an HTML element, containing arbitrary text. */
    public el<K extends keyof HTMLElementTagNameMap>(
        el: K,
        text: any,
        { container = this.container, ...options }: DomElementInfo & { container?: HTMLElement } = {}
    ): HTMLElementTagNameMap[K] {
        let wrapped = Values.wrapValue(text);

        if (wrapped === null || wrapped === undefined) {
            return container.createEl(el, Object.assign({ text }, options));
        }

        let _el = container.createEl(el, options);
        renderValue(this.app, wrapped.value, _el, this.currentFilePath, this.component, this.settings, true);
        return _el;
    }

    /** Render an HTML header; the level can be anything from 1 - 6. */
    public header(level: number, text: any, options?: DomElementInfo): HTMLHeadingElement {
        let header = { 1: "h1", 2: "h2", 3: "h3", 4: "h4", 5: "h5", 6: "h6" }[level];
        if (!header) throw Error(`Unrecognized level '${level}' (expected 1, 2, 3, 4, 5, or 6)`);

        return this.el(header as keyof HTMLElementTagNameMap, text, options) as HTMLHeadingElement;
    }

    /** Render an HTML paragraph, containing arbitrary text. */
    public paragraph(text: any, options?: DomElementInfo): HTMLParagraphElement {
        return this.el("p", text, options);
    }

    /** Render an inline span, containing arbitrary text. */
    public span(text: any, options?: DomElementInfo): HTMLSpanElement {
        return this.el("span", text, options);
    }

    /**
     * Render HTML from the output of a template "view" saved as a file in the vault.
     * Takes a filename and arbitrary input data.
     */
    public async view(viewName: string, input: any) {
        // Look for `${viewName}.js` first, then for `${viewName}/view.js`.
        const simpleViewPath = `${viewName}.js`;
        const complexViewPath = `${viewName}/view.js`;
        let checkForCss = false;
        let cssElement = undefined;
        let viewFile = this.app.metadataCache.getFirstLinkpathDest(simpleViewPath, this.currentFilePath);
        if (!viewFile) {
            viewFile = this.app.metadataCache.getFirstLinkpathDest(complexViewPath, this.currentFilePath);
            checkForCss = true;
        }

        if (!viewFile) {
            renderErrorPre(
                this.container,
                `Dataview: custom view not found for '${simpleViewPath}' or '${complexViewPath}'.`
            );
            return;
        }

        if (checkForCss) {
            // Check for optional CSS.
            let cssFile = this.app.metadataCache.getFirstLinkpathDest(`${viewName}/view.css`, this.currentFilePath);
            if (cssFile) {
                let cssContents = await this.app.vault.read(cssFile);
                cssContents += `\n/*# sourceURL=${location.origin}/${cssFile.path} */`;
                cssElement = this.container.createEl("style", { text: cssContents, attr: { scope: " " } });
            }
        }

        let contents = await this.app.vault.read(viewFile);
        if (contents.contains("await")) contents = "(async () => { " + contents + " })()";
        contents += `\n//# sourceURL=${viewFile.path}`;
        let func = new Function("dv", "input", contents);

        try {
            // This may directly render, in which case it will likely return undefined or null.
            let result = await Promise.resolve(func(this, input));
            if (result)
                await renderValue(
                    this.app,
                    result as any,
                    this.container,
                    this.currentFilePath,
                    this.component,
                    this.settings,
                    true
                );
        } catch (ex) {
            if (cssElement) this.container.removeChild(cssElement);
            renderErrorPre(this.container, `Dataview: Failed to execute view '${viewFile.path}'.\n\n${ex}`);
        }
    }

    /** Render a dataview list of the given values. */
    public list(values?: any[] | DataArray<any>) {
        return this.api.list(values, this.container, this.component, this.currentFilePath);
    }

    /** Render a dataview table with the given headers, and the 2D array of values. */
    public table(headers: string[], values?: any[][] | DataArray<any>) {
        return this.api.table(headers, values, this.container, this.component, this.currentFilePath);
    }

    /** Render a dataview task view with the given tasks. */
    public taskList(tasks: Grouping<SListItem>, groupByFile: boolean = true) {
        return this.api.taskList(tasks, groupByFile, this.container, this.component, this.currentFilePath);
    }

    ////////////////////////
    // Markdown Rendering //
    ////////////////////////

    /** Render a table directly to markdown, returning the markdown. */
    public markdownTable(
        headers: string[],
        values?: any[][] | DataArray<any>,
        settings?: Partial<ExportSettings>
    ): string {
        return this.api.markdownTable(headers, values, settings);
    }

    /** Render a list directly to markdown, returning the markdown. */
    public markdownList(values?: any[] | DataArray<any> | undefined, settings?: Partial<ExportSettings>) {
        return this.api.markdownList(values, settings);
    }

    /** Render at ask list directly to markdown, returning the markdown. */
    public markdownTaskList(values: Grouping<SListItem>, settings?: Partial<ExportSettings>) {
        return this.api.markdownTaskList(values, settings);
    }
}

/**
 * Evaluate a script where 'this' for the script is set to the given context. Allows you to define global variables.
 */
export function evalInContext(script: string, context: any): any {
    return function () {
        return eval(script);
    }.call(context);
}

/**
 * Evaluate a script possibly asynchronously, if the script contains `async/await` blocks.
 */
export async function asyncEvalInContext(script: string, context: any): Promise<any> {
    if (script.includes("await")) {
        return evalInContext("(async () => { " + script + " })()", context) as Promise<any>;
    } else {
        return Promise.resolve(evalInContext(script, context));
    }
}
