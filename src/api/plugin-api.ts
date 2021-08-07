/** The general, externally accessible plugin API (available at `app.plugins.plugins.dataview.api`). */

import { App, Component } from "obsidian";
import { FullIndex } from "src/data";
import { matchingSourcePaths } from "src/data/resolver";
import { Task } from "src/data/file";
import { Sources } from "src/data/source";
import { DataObject, Link, LiteralValue, Values } from "src/data/value";
import { EXPRESSION } from "src/expression/parse";
import { renderList, renderTable, renderValue } from "src/ui/render";
import { DataviewSettings } from "src/settings";
import { renderFileTasks, renderTasks, TaskViewLifecycle } from "src/ui/tasks";
import { DataArray } from "./data-array";
import { BoundFunctionImpl, DEFAULT_FUNCTIONS, Functions } from "src/expression/functions";
import { Context } from "src/expression/context";
import { defaultLinkHandler } from "src/query/engine";
import { DateTime } from "luxon";

export class DataviewApi {
    /** Evaluation context which expressions can be evaluated in. */
    public evaluationContext: Context;
    /** Dataview functions which can be called from DataviewJS. */
    public func: Record<string, BoundFunctionImpl>;

    public constructor(public app: App, public index: FullIndex, public settings: DataviewSettings) {
        this.evaluationContext = new Context(defaultLinkHandler(index, ""), settings);
        this.func = Functions.bindAll(DEFAULT_FUNCTIONS, this.evaluationContext);
    }

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

        return matchingSourcePaths(source, this.index, originFile).map(s => DataArray.from(s, this.settings)).orElseThrow();
    }

    /** Map a page path to the actual data contained within that page. */
    public page(path: string | Link, originFile?: string): Record<string, any> | undefined {
        if (!(typeof path === "string") && !Values.isLink(path)) {
            throw Error("dv.page only handles string and link paths; was provided type '" + (typeof path) + "'")
        }

        let rawPath = (path instanceof Link) ? path.path : path;
        let normPath = this.app.metadataCache.getFirstLinkpathDest(rawPath, originFile ?? "");
        if (!normPath) return undefined;

        let pageObject = this.index.pages.get(normPath.path);
        if (!pageObject) return undefined;

        return pageObject.toObject(this.index);
    }

    /** Load the contents of a CSV file (with a header), returning it as a list of objects. */
    public csv(path: string, originFile?: string): DataArray<DataObject> | undefined {
        if (!(typeof path === "string")) {
            throw Error("dv.csv only handles string paths; was provided type '" + (typeof path) + "'.");
        }

        let normPath = this.app.metadataCache.getFirstLinkpathDest(path, originFile ?? "");
        if (!normPath) return undefined;

        let data = this.index.csv.get(path);
        if (data.successful) return DataArray.from(data.value, this.settings);
        else return undefined;
    }

    /** Return an array of page objects corresponding to pages which match the query. */
    public pages(query?: string, originFile?: string): DataArray<any> {
        return this.pagePaths(query, originFile).flatMap(p => {
            let res = this.page(p, originFile);
            return res ? [res] : [];
        });
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
        if (Array.isArray(raw)) return DataArray.wrap(raw, this.settings);
        return DataArray.wrap([raw], this.settings);
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
        return this.func.date(pathlike) as DateTime | null;
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

    ///////////////
    // Rendering //
    ///////////////

    /** Render a dataview list of the given values. */
    public list(values: any[] | DataArray<any> | undefined, container: HTMLElement, component: Component, filePath: string) {
        if (!values) return;
        if (DataArray.isDataArray(values)) values = values.array();

        renderList(container, values as any[], component, filePath, this.settings);
    }

    /** Render a dataview table with the given headers, and the 2D array of values. */
    public table(headers: string[], values: any[][] | DataArray<any> | undefined, container: HTMLElement, component: Component, filePath: string) {
        if (!values) values = [];
        if (DataArray.isDataArray(values)) values = values.array();

        renderTable(container, headers, values as any[][], component, filePath, this.settings);
    }

    /** Render a dataview task view with the given tasks. */
    public taskList(tasks: Task[] | DataArray<any>, groupByFile: boolean = true, container: HTMLElement, component: Component, filePath: string) {
        if (DataArray.isDataArray(tasks)) tasks = tasks.array();

        if (groupByFile) {
            let byFile = new Map<string, Task[]>();
            for (let task of (tasks as Task[])) {
                if (!byFile.has(task.path)) byFile.set(task.path, []);
                byFile.get(task.path)?.push(task);
            }

            let subcontainer = container.createDiv();
            (async () => {
                await renderFileTasks(subcontainer, byFile);
                component.addChild(new TaskViewLifecycle(this.app.vault, subcontainer));
            })();
        } else {
            let subcontainer = container.createDiv();
            (async () => {
                await renderTasks(subcontainer, tasks as Task[]);
                component.addChild(new TaskViewLifecycle(this.app.vault, subcontainer));
            })();
        }
    }

    /** Render an arbitrary value into a container. */
    public async renderValue(value: any, container: HTMLElement, component: Component, filePath: string, inline: boolean = false) {
        await renderValue(value as LiteralValue, container, filePath, component, this.settings, inline);
    }
}
