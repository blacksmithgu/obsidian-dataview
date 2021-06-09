/** The general, externally accessible plugin API (available at `app.plugins.plugins.dataview.api`). */

import { App, Component } from "obsidian";
import { FullIndex } from "src/data";
import { collectPagePaths } from "src/data/collector";
import { Task } from "src/data/file";
import { Sources } from "src/data/source";
import { EXPRESSION } from "src/parse";
import { Fields, Link, LiteralValue } from "src/query";
import { renderList, renderTable, renderValue } from "src/render";
import { DataviewSettings } from "src/settings";
import { renderFileTasks, renderTasks, TaskViewLifecycle } from "src/tasks";
import { DataArray } from "./data-array";

export class DataviewApi {
    public constructor(public app: App, public index: FullIndex, public settings: DataviewSettings) {
        app.metadataCache.trigger("dataview:api-ready");
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

        return collectPagePaths(source, this.index, originFile).map(s => DataArray.from(s)).orElseThrow();
    }

    /** Map a page path to the actual data contained within that page. */
    public page(path: string | Link, originFile?: string): Record<string, any> | undefined {
        if (!(typeof path === "string") && !Fields.isLink(path)) {
            throw Error("dv.page only handles string and link paths; was provided type '" + (typeof path) + "'")
        }

        let rawPath = (path instanceof Link) ? path.path : path;
        let normPath = this.app.metadataCache.getFirstLinkpathDest(rawPath, originFile ?? "");
        if (!normPath) return undefined;

        let pageObject = this.index.pages.get(normPath.path);
        if (!pageObject) return undefined;

        return pageObject.toObject(this.index);
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

    /**
     * Compare two arbitrary JavaScript values using Dataview's default comparison rules. Returns a negative value if
     * a < b, 0 if a = b, and a positive value if a > b.
     */
    public compare(a: any, b: any): number {
        return Fields.compareValue(a, b);
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

        renderList(container, values as any[], component, filePath, this.settings.renderNullAs);
    }

    /** Render a dataview table with the given headers, and the 2D array of values. */
    public table(headers: string[], values: any[][] | DataArray<any> | undefined, container: HTMLElement, component: Component, filePath: string) {
        if (!values) values = [];
        if (DataArray.isDataArray(values)) values = values.array();

        renderTable(container, headers, values as any[][], component, filePath, this.settings.renderNullAs);
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
        await renderValue(value as LiteralValue, container, filePath, component, "\-", !inline);
    }
}
