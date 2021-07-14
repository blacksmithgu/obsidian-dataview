/** Fancy wrappers for the JavaScript API, used both by external plugins AND by the dataview javascript view. */

import { App, Component, FileSystemAdapter } from "obsidian";
import { FullIndex } from "src/data/index";
import { Task } from "src/data/file";
import { renderValue, renderErrorPre } from "src/ui/render";
import { DataviewApi } from "src/api/plugin-api";
import { DataviewSettings } from "src/settings";
import { Link, Values } from "src/data/value";
import { BoundFunctionImpl, DEFAULT_FUNCTIONS, Functions } from "src/expression/functions";
import { Context } from "src/expression/context";
import { defaultLinkHandler } from "src/query/engine";
import { DateTime } from "luxon";
import { DataArray } from "./data-array";

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

    /** Dataview functions which can be called from DataviewJS. */
    public func: Record<string, BoundFunctionImpl>;

    constructor(index: FullIndex, component: Component, container: HTMLElement, app: App, settings: DataviewSettings, currentFilePath: string) {
        this.index = index;
        this.component = component;
        this.container = container;
        this.app = app;
        this.currentFilePath = currentFilePath;
        this.settings = settings;

        this.api = new DataviewApi(this.app, this.index, this.settings);

        // Set up the evaluation context with variables from the current file.
        let fileMeta = this.index.pages.get(this.currentFilePath)?.toObject(this.index) ?? {};
        this.evaluationContext = new Context(defaultLinkHandler(this.index, this.currentFilePath), fileMeta);

        this.func = Functions.bindAll(DEFAULT_FUNCTIONS, this.evaluationContext);
    }

    /////////////////////////////
    // Index + Data Collection //
    /////////////////////////////

    /** Return an array of paths (as strings) corresponding to pages which match the query. */
    public pagePaths(query?: string): DataArray<string> { return this.api.pagePaths(query, this.currentFilePath); }

    /** Map a page path to the actual data contained within that page. */
    public page(path: string | Link): Record<string, any> | undefined { return this.api.page(path, this.currentFilePath); }

    /** Return an array of page objects corresponding to pages which match the query. */
    public pages(query?: string): DataArray<any> { return this.api.pages(query, this.currentFilePath); }

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
        if (DataArray.isDataArray(raw)) return raw;
        if (Array.isArray(raw)) return DataArray.wrap(raw);
        return DataArray.wrap([raw]);
    }

    /** Return true if theg given value is a javascript array OR a dataview data array. */
    public isArray(raw: any): raw is DataArray<any> | Array<any> {
        return DataArray.isDataArray(raw) || Array.isArray(raw);
    }

    /** Create a dataview file link to the given path. */
    public fileLink(path: string, embed: boolean = false, display?: string) {
        return Link.file(path, embed, display);
    }

    /** Attempt to extract a date from a string, link or date. */
    public date(pathlike: string | Link | DateTime): DateTime | null {
        return this.api.date(pathlike);
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

    /** Render an HTML header; the level can be anything from 1 - 6. */
    public header(level: number, text: any) {
        let headerType: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
        switch (level) {
            case 1: headerType = 'h1'; break;
            case 2: headerType = 'h2'; break;
            case 3: headerType = 'h3'; break;
            case 4: headerType = 'h4'; break;
            case 5: headerType = 'h5'; break;
            case 6: headerType = 'h6'; break;
            default: throw new Error(`Invalid header level ${level}`);
        }

        let wrapped = Values.wrapValue(text);
        if (wrapped === null || wrapped === undefined) {
            this.container.createEl(headerType, { text });
            return;
        }

        let header = this.container.createEl(headerType);
        renderValue(wrapped.value, header, this.currentFilePath, this.component, this.settings.renderNullAs, false);
    }

    /** Render an HTML paragraph, containing arbitrary text. */
    public paragraph(text: any) {
        let wrapped = Values.wrapValue(text);
        if (wrapped === null || wrapped === undefined) {
            this.container.createEl('p', { text });
            return;
        }

        renderValue(wrapped.value, this.container, this.currentFilePath, this.component, this.settings.renderNullAs, true);
    }

    /** Render an inline span, containing arbitrary text. */
    public span(text: any) {
        let wrapped = Values.wrapValue(text);
        if (wrapped === null || wrapped === undefined) {
            this.container.createEl('p', { text });
            return;
        }

        renderValue(wrapped.value, this.container, this.currentFilePath, this.component, this.settings.renderNullAs, true);
    }

    /**
     * Render HTML from the output of a template "view" saved as a file in the vault.
     * Takes a filename and arbitrary input data.
     */
    public view(viewName: string, input: any) {
        /** This cannot be used on systems without file access (i.e. web and mobile devices). */
        if (!(this.app.vault.adapter instanceof FileSystemAdapter)) {
            renderErrorPre( this.container, `Dataview: file system access is not available.` );
            return;
        }

        /** Check that a file exists for the requested view name. */
        let viewPath = `${this.app.vault.configDir}/dataviews/${viewName}/view.js`;
        this.app.vault.adapter.exists(viewPath).then(viewExists => {
            if ( !viewExists ) throw new Error(`view file does not exist: ${viewPath}`);

            return this.app.vault.adapter.read(viewPath);
        }).then(viewData => {
            /**
             * Create a function from file contents. This is the dangerous part:
             * it’s basically eval(). Consider adding sanitization & filtering.
             */
            let viewFunction = new Function('dv', 'input', viewData);
            /** The view file code must return a string, which we treat as HTML. */
            let text = viewFunction(this, input);

            let wrapped = Values.wrapValue(text);
            if (wrapped === null || wrapped === undefined) {
                this.container.createEl('div', { text });
                return;
            }

            renderValue(wrapped.value, this.container, this.currentFilePath, this.component, this.settings.renderNullAs, true);
        }).catch(error => {
            renderErrorPre(this.container, "Dataview: " + error.stack)
        });

        /** Check for optional CSS. */
        let cssPath = `${this.app.vault.configDir}/dataviews/${viewName}/view.css`;
        this.app.vault.adapter.exists(cssPath).then(cssExists => {
            if (!cssExists) return;

            this.app.vault.adapter.read(cssPath).then(viewCSS => {
                this.container.createEl('style', { text: viewCSS, attr: { scoped: '' } });
            });
        });
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
    public taskList(tasks: Task[] | DataArray<any>, groupByFile: boolean = true) {
        return this.api.taskList(tasks, groupByFile, this.container, this.component, this.currentFilePath);
    }

}

/** Evaluate a script where 'this' for the script is set to the given context. Allows you to define global variables. */
export function evalInContext(script: string, context: any): any {
    return function () { return eval(script); }.call(context);
}

/** Make a full API context which a script can be evaluted in. */
export function makeApiContext(index: FullIndex, component: Component, app: App, settings: DataviewSettings, container: HTMLElement, originFile: string): DataviewInlineApi {
    return new DataviewInlineApi(index, component, container, app, settings, originFile);
}
