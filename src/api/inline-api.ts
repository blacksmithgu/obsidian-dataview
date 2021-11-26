/** Fancy wrappers for the JavaScript API, used both by external plugins AND by the dataview javascript view. */

import { App, Component } from "obsidian";
import { FullIndex } from "data/index";
import { renderValue, renderErrorPre } from "ui/render";
import { DataviewApi, DataviewIOApi } from "api/plugin-api";
import { DataviewSettings } from "settings";
import { DataObject, Link, Values, Task } from "data/value";
import { BoundFunctionImpl, DEFAULT_FUNCTIONS, Functions } from "expression/functions";
import { Context } from "expression/context";
import { defaultLinkHandler } from "query/engine";
import { DateTime, Duration } from "luxon";
import * as Luxon from "luxon";
import { DataArray } from "./data-array";

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

    /** IO utilities which are largely asynchronous. */
    public io: DataviewInlineIOApi;

    /** Re-exporting of luxon for people who can't easily require it. Sorry! */
    public luxon = Luxon;

    /** Dataview functions which can be called from DataviewJS. */
    public func: Record<string, BoundFunctionImpl>;

    constructor(
        index: FullIndex,
        component: Component,
        container: HTMLElement,
        app: App,
        settings: DataviewSettings,
        verNum: string,
        currentFilePath: string
    ) {
        this.index = index;
        this.component = component;
        this.container = container;
        this.app = app;
        this.currentFilePath = currentFilePath;
        this.settings = settings;

        this.api = new DataviewApi(this.app, this.index, this.settings, verNum);
        this.io = new DataviewInlineIOApi(this.api.io, this.currentFilePath);

        // Set up the evaluation context with variables from the current file.
        let fileMeta = this.index.pages.get(this.currentFilePath)?.toObject(this.index) ?? {};
        this.evaluationContext = new Context(defaultLinkHandler(this.index, this.currentFilePath), settings, fileMeta);

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

    /** Return true if theg given value is a javascript array OR a dataview data array. */
    public isArray(raw: any): raw is DataArray<any> | Array<any> {
        return this.api.isArray(raw);
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
    public async el<K extends keyof HTMLElementTagNameMap>(
        el: K,
        text: any,
        options?: DomElementInfo
    ): Promise<HTMLElementTagNameMap[K]> {
        let wrapped = Values.wrapValue(text);
        if (wrapped === null || wrapped === undefined) {
            return this.container.createEl(el, Object.assign({ text }, options));
        }

        let _el = this.container.createEl(el, options);
        await renderValue(wrapped.value, _el, this.currentFilePath, this.component, this.settings, true);
        return _el;
    }

    /** Render an HTML header; the level can be anything from 1 - 6. */
    public async header(level: number, text: any, options?: DomElementInfo): Promise<HTMLHeadingElement> {
        let header = { 1: "h1", 2: "h2", 3: "h3", 4: "h4", 5: "h5", 6: "h6" }[level];
        if (!header) throw Error(`Unrecognized level '${level}' (expected 1, 2, 3, 4, 5, or 6)`);

        return this.el(header as keyof HTMLElementTagNameMap, text, options) as Promise<HTMLHeadingElement>;
    }

    /** Render an HTML paragraph, containing arbitrary text. */
    public async paragraph(text: any, options?: DomElementInfo): Promise<HTMLParagraphElement> {
        return this.el("p", text, options);
    }

    /** Render an inline span, containing arbitrary text. */
    public async span(text: any, options?: DomElementInfo): Promise<HTMLSpanElement> {
        return this.el("span", text, options);
    }

    /**
     * Render HTML from the output of a template "view" saved as a file in the vault.
     * Takes a filename and arbitrary input data.
     */
    public async view(viewName: string, input: any) {
        // Look for `${viewName}.js` first, then for `${viewName}/view.js`.
        let simpleViewFile = this.app.metadataCache.getFirstLinkpathDest(viewName + ".js", this.currentFilePath);
        if (simpleViewFile) {
            let contents = await this.app.vault.read(simpleViewFile);
            let func = new Function("dv", "input", contents);

            try {
                // This may directly render, in which case it will likely return undefined or null.
                let result = await Promise.resolve(func(this, input));
                if (result)
                    await renderValue(
                        result as any,
                        this.container,
                        this.currentFilePath,
                        this.component,
                        this.settings,
                        true
                    );
            } catch (ex) {
                renderErrorPre(this.container, `Dataview: Failed to execute view '${simpleViewFile.path}'.\n\n${ex}`);
            }

            return;
        }

        // No `{viewName}.js`, so look for a folder instead.
        let viewPath = `${viewName}/view.js`;
        let viewFile = this.app.metadataCache.getFirstLinkpathDest(viewPath, this.currentFilePath);

        if (!viewFile) {
            renderErrorPre(this.container, `Dataview: custom view not found for '${viewPath}' or '${viewName}.js'.`);
            return;
        }

        let viewContents = await this.app.vault.read(viewFile);
        let viewFunction = new Function("dv", "input", viewContents);
        try {
            let result = await Promise.resolve(viewFunction(this, input));
            if (result)
                await renderValue(
                    result as any,
                    this.container,
                    this.currentFilePath,
                    this.component,
                    this.settings,
                    true
                );
        } catch (ex) {
            renderErrorPre(this.container, `Dataview: Error while executing view '${viewFile.path}'.\n\n${ex}`);
        }

        // Check for optional CSS.
        let cssFile = this.app.metadataCache.getFirstLinkpathDest(`${viewName}/view.css`, this.currentFilePath);
        if (!cssFile) return;

        let cssContents = await this.app.vault.read(cssFile);
        this.container.createEl("style", { text: cssContents, attr: { scope: " " } });
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
    public taskList(tasks: Task[] | DataArray<Task>, groupByFile: boolean = true) {
        return this.api.taskList(tasks, groupByFile, this.container, this.component, this.currentFilePath);
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

/** Make a full API context which a script can be evaluted in. */
export function makeApiContext(
    index: FullIndex,
    component: Component,
    app: App,
    settings: DataviewSettings,
    verNum: string,
    container: HTMLElement,
    originFile: string
): DataviewInlineApi {
    return new DataviewInlineApi(index, component, container, app, settings, verNum, originFile);
}
