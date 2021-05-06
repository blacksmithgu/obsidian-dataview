/** Fancy wrappers for the JavaScript API, used both by external plugins AND by the dataview javascript view. */

import { App, Component } from "obsidian";
import { FullIndex } from "src/index";
import { collectFromSource, createContext } from "./engine";
import { Task } from "./file";
import { EXPRESSION } from "./parse";
import { Fields, Link, Sources } from "./query";
import { renderList, renderTable, renderValue } from "./render";
import { renderFileTasks, renderTasks, TaskViewLifecycle } from "./tasks";

/** A function which maps an array element to some value. */
export type ArrayFunc<T, O> = (elem: T, index: number, arr: T[]) => O;

/** A function which compares two types (plus their indices, if relevant). */
export type ArrayComparator<T> = (a: T, b: T) => number;

/**
 * Proxied interface which allows manipulating array-based data. All functions on a data array produce a NEW array
 * (i.e., the arrays are immutable).
 */
export interface DataArray<T> {
    /** The total number of elements in the array. */
    length: number;

    /** Filter the data array down to just elements which match the given predicate. */
    where(predicate: ArrayFunc<T, boolean>): DataArray<T>;
    /** Alias for 'where' for people who want array semantics. */
    filter(predicate: ArrayFunc<T, boolean>): DataArray<T>;

    /** Map elements in the data array by applying a function to each. */
    map<U>(f: ArrayFunc<T, U>): DataArray<U>;
    /** Map elements in the data array by applying a function to each, then flatten the results to produce a new array. */
    flatMap<U>(f: ArrayFunc<T, U[]>): DataArray<U>;
    /** Mutably change each value in the array, returning the same array which you can further chain off of. */
    mutate(f: ArrayFunc<T, any>): DataArray<any>;

    /** Limit the total number of entries in the array to the given value. */
    limit(count: number): DataArray<T>;
    /**
     * Take a slice of the array. If `start` is undefined, it is assumed to be 0; if `end` is undefined, it is assumbed
     * to be the end of the array.
     */
    slice(start?: number, end?: number): DataArray<T>;

    /**
     * Return a sorted array sorted by the given key; an optional comparator can be provided, which will
     * be used to compare the keys in leiu of the default dataview comparator.
     */
    sort<U>(key: ArrayFunc<T, U>, direction?: 'asc' | 'desc', comparator?: ArrayComparator<U>): DataArray<T>;

    /**
     * Return an array where elements are grouped by the given key; the resulting array will have objects of the form
     * { key: <key value>, rows: DataArray }.
     */
    groupBy<U>(key: ArrayFunc<T, U>, comparator?: ArrayComparator<U>): DataArray<{ key: U, rows: DataArray<T> }>;

    /**
     * Return distinct entries. If a key is provided, then rows with distinct keys are returned.
     */
    distinct<U>(key?: ArrayFunc<T, U>, comparator?: ArrayComparator<U>): DataArray<T>;

    /** Return true if the predicate is true for all values. */
    every(f: ArrayFunc<T, boolean>): boolean;
    /** Return true if the predicate is true for at least one value. */
    some(f: ArrayFunc<T, boolean>): boolean;
    /** Return true if the predicate is FALSE for all values. */
    none(f: ArrayFunc<T, boolean>): boolean;

    /** Return the first element in the data array. Returns undefined if the array is empty. */
    first(): T;
    /** Return the last element in the data array. Returns undefined if the array is empty. */
    last(): T;

    /** Map every element in this data array to the given key, and then flatten it.*/
    to(key: string): DataArray<any>;
    /**
     * Recursively expand the given key, flattening a tree structure based on the key into a flat array. Useful for handling
     * heirarchical data like tasks with 'subtasks'.
     */
    expand(key: string): DataArray<any>;

    /** Run a lambda on each element in the array. */
    forEach(f: ArrayFunc<T, void>): void;

    /** Convert this to a plain javascript array. */
    array(): T[];

    /** Allow iterating directly over the array. */
    [Symbol.iterator](): Iterator<T>;

    /** Map indexes to values. */
    [index: number]: any;
    /** Automatic flattening of fields. */
    [field: string]: any;
}

/** Implementation of DataArray, minus the dynamic variable access, which is implemented via proxy. */
class DataArrayImpl<T> implements DataArray<T> {
    private static ARRAY_FUNCTIONS: Set<string> = new Set([
        "where", "filter", "map", "flatMap", "slice", "sort", "groupBy", "distinct", "every", "some", "none", "first", "last", "to",
        "expand", "forEach", "length", "values", "array", "defaultComparator"
    ]);

    private static ARRAY_PROXY: ProxyHandler<DataArrayImpl<any>> = {
        get: function (target, prop, reciever) {
            if (typeof prop === "symbol") return (target as any)[prop];
            else if (typeof prop === "number") return target.values[prop];
            else if (!isNaN(parseInt(prop))) return target.values[parseInt(prop)];
            else if (DataArrayImpl.ARRAY_FUNCTIONS.has(prop.toString())) return target[prop.toString()];

            return target.to(prop);
        }
    };

    public static wrap<T>(arr: T[], defaultComparator: ArrayComparator<any> = Fields.compareValue): DataArray<T> {
        return new Proxy(new DataArrayImpl(arr, defaultComparator), DataArrayImpl.ARRAY_PROXY);
    }

    public length: number;
    [key: string]: any;

    private constructor(public values: any[], public defaultComparator: ArrayComparator<any> = Fields.compareValue) {
        this.length = values.length;
    }

    public where(predicate: ArrayFunc<T, boolean>): DataArray<T> {
        return DataArrayImpl.wrap(this.values.filter(predicate), this.defaultComparator);
    }

    public filter(predicate: ArrayFunc<T, boolean>): DataArray<T> {
        return this.where(predicate);
    }

    public map<U>(f: ArrayFunc<T, U>): DataArray<U> {
        return DataArrayImpl.wrap(this.values.map(f), this.defaultComparator);
    }

    public flatMap<U>(f: ArrayFunc<T, U[]>): DataArray<U> {
        let result = [];
        for (let index = 0; index < this.length; index++) {
            let value = f(this.values[index], index, this.values);
            if (!value || value.length == 0) continue;

            for (let r of value) result.push(r);
        }

        return DataArrayImpl.wrap(result, this.defaultComparator);
    }

    public mutate(f: ArrayFunc<T, any>): DataArray<any> {
        this.values.forEach(f);
        return this;
    }

    public limit(count: number): DataArray<T> {
        return DataArrayImpl.wrap(this.values.slice(0, count), this.defaultComparator);
    }

    public slice(start?: number, end?: number): DataArray<T> {
        return DataArrayImpl.wrap(this.values.slice(start, end), this.defaultComparator);
    }

    public sort<U>(key: ArrayFunc<T, U>, direction?: 'asc' | 'desc', comparator?: ArrayComparator<U>): DataArray<T> {
        if (this.values.length == 0) return this;
        let realComparator = comparator ?? this.defaultComparator;

        // Associate each entry with it's index for the key function, and then do a normal sort.
        let copy = ([] as any[]).concat(this.array()).map((elem, index) => { return { index: index, value: elem } });
        copy.sort((a, b) => {
            let aKey = key(a.value, a.index, this.values);
            let bKey = key(b.value, b.index, this.values);
            return direction === 'desc' ? -realComparator(aKey, bKey) : realComparator(aKey, bKey);
        });

        return DataArrayImpl.wrap(copy.map(e => e.value), this.defaultComparator);
    }

    public groupBy<U>(key: ArrayFunc<T, U>, comparator?: ArrayComparator<U>): DataArray<{ key: U, rows: DataArray<T> }> {
        if (this.values.length == 0) return DataArrayImpl.wrap([], this.defaultComparator);

        // JavaScript sucks and we can't make hash maps over arbitrary types (only strings/ints), so
        // we do a poor man algorithm where we SORT, followed by grouping.
        let intermediate = this.sort(key, "asc", comparator);
        comparator = comparator ?? this.defaultComparator;

        let result: { key: U, rows: DataArray<T> }[] = [];
        let currentRow = [intermediate[0]];
        let current = key(intermediate[0], 0, intermediate.values);
        for (let index = 1; index < intermediate.length; index++) {
            let newKey = key(intermediate[index], index, intermediate.values);
            if (comparator(current, newKey) != 0) {
                result.push({ key: current, rows: DataArrayImpl.wrap(currentRow, this.defaultComparator) });
                current = newKey;
                currentRow = [intermediate[index]];
            } else {
                currentRow.push(intermediate[index]);
            }
        }
        result.push({ key: current, rows: DataArrayImpl.wrap(currentRow, this.defaultComparator) });

        return DataArrayImpl.wrap(result, this.defaultComparator);
    }

    public distinct<U>(key?: ArrayFunc<T, U>, comparator?: ArrayComparator<U>): DataArray<T> {
        if (this.values.length == 0) return this;
        let realKey = key ?? (x => x as any as U);

        // For similar reasons to groupBy, do a sort and take the first element of each block.
        let intermediate = this
            .map((x, index) => { return { key: realKey(x, index, this.values), value: x } })
            .sort(x => x.key, "asc", comparator);
        comparator = comparator ?? this.defaultComparator;

        let result: T[] = [intermediate[0].value];
        for (let index = 1; index < intermediate.length; index++) {
            if (comparator(intermediate[index - 1].key, intermediate[index].key) != 0) {
                result.push(intermediate[index].value);
            }
        }

        return DataArrayImpl.wrap(result, this.defaultComparator);
    }

    public every(f: ArrayFunc<T, boolean>): boolean { return this.values.every(f); }

    public some(f: ArrayFunc<T, boolean>): boolean { return this.values.some(f); }

    public none(f: ArrayFunc<T, boolean>): boolean { return this.values.every((v, i, a) => !f(v, i, a)); }

    public first(): T { return this.values.length > 0 ? this.values[0] : undefined; }
    public last(): T { return this.values.length > 0 ? this.values[this.values.length - 1] : undefined; }

    public to(key: string): DataArray<any> {
        let result: any[] = [];
        for (let child of this.values) {
            let value = child[key];
            if (value === undefined || value === null) continue;

            if (Array.isArray(value)) value.forEach(v => result.push(v));
            else result.push(value);
        }

        return DataArrayImpl.wrap(result, this.defaultComparator);
    }

    public expand(key: string): DataArray<any> {
        let result = [];
        let queue: any[] = ([] as any[]).concat(this.values);

        while (queue.length > 0) {
            let next = queue.pop();
            let value = next[key];

            if (value === undefined || value === null) continue;
            if (Array.isArray(value)) value.forEach(v => queue.push(v));
            else if (value instanceof DataArrayImpl) value.forEach(v => queue.push(v));
            else queue.push(value);

            result.push(next);
        }

        return Data.array(result);
    }

    public forEach(f: ArrayFunc<T, void>) {
        for (let index = 0; index < this.values.length; index++) {
            f(this.values[index], index, this.values);
        }
    }

    public array(): T[] { return ([] as any[]).concat(this.values); }

    public [Symbol.iterator](): Iterator<T> {
        return this.values[Symbol.iterator]();
    }
}

/** Provides utility functions for generating data arrays. */
export namespace Data {
    /** Create a new Dataview data array. */
    export function array<T>(raw: T[]): DataArray<T> {
        return DataArrayImpl.wrap(raw);
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

    constructor(index: FullIndex, component: Component, container: HTMLElement, app: App, currentFilePath: string) {
        this.index = index;
        this.component = component;
        this.container = container;
        this.app = app;
        this.currentFilePath = currentFilePath;
    }

    /////////////////////////////
    // Index + Data Collection //
    /////////////////////////////

    /** Return an array of paths (as strings) corresponding to pages which match the query. */
    public pagePaths(query?: string): DataArray<string> {
        try {
            let source;
            if (!query || query.trim() === "") source = Sources.folder("");
            else source = EXPRESSION.source.tryParse(query);

            return Data.array(Array.from(collectFromSource(source, this.index, this.currentFilePath)));
        } catch (ex) {
            throw new Error(`Failed to parse query in 'pagePaths': ${ex}`);
        }
    }

    /** Map a page path to the actual data contained within that page. */
    public page(path: string | Link): Record<string, any> | undefined {
        let rawPath = (path instanceof Link) ? path.path : path;
        let rawData = createContext(rawPath, this.index, undefined)?.namespace;
        if (rawData === undefined) return undefined;

        return Fields.fieldToValue(rawData) as Record<string, any>;
    }

    /** Return an array of page objects corresponding to pages which match the query. */
    public pages(query: string): DataArray<any> {
        return this.pagePaths(query).flatMap(p => {
            let res = this.page(p);
            return res ? [res] : [];
        });
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

        let wrapped = Fields.wrapValue(text);
        if (wrapped === null || wrapped === undefined) this.container.createEl(headerType, { text });

        let header = this.container.createEl(headerType);
        renderValue(wrapped?.value ?? null, header, this.currentFilePath, this.component, "\-", false);
    }

    /** Render an HTML paragraph, containing arbitrary text. */
    public paragraph(text: any) {
        let wrapped = Fields.wrapValue(text);
        if (wrapped === null || wrapped === undefined) this.container.createEl('p', { text });

        renderValue(wrapped?.value ?? null, this.container, this.currentFilePath, this.component, "\-", true);
    }

    /** Render a dataview list of the given values. */
    public list(values?: any[] | DataArray<any>) {
        if (!values) return;
        if (values instanceof DataArrayImpl) values = values.array();

        renderList(this.container, values as any[], this.component, this.currentFilePath, "\-");
    }

    /** Render a dataview table with the given headers, and the 2D array of values. */
    public table(headers: string[], values?: any[][] | DataArray<any>) {
        if (!values) values = [];
        if (values instanceof DataArrayImpl) values = values.array();
        renderTable(this.container, headers, values as any[][], this.component, this.currentFilePath, "\-");
    }

    /** Render a dataview task view with the given tasks. */
    public taskList(tasks: Task[] | DataArray<any>, groupByFile: boolean = false) {
        if (tasks instanceof DataArrayImpl) tasks = tasks.array();

        if (groupByFile) {
            let byFile = new Map<string, Task[]>();
            for (let task of (tasks as Task[])) {
                if (!byFile.has(task.path)) byFile.set(task.path, []);
                byFile.get(task.path)?.push(task);
            }

            let subcontainer = this.container.createDiv();
            (async () => {
                await renderFileTasks(subcontainer, byFile);
                this.component.addChild(new TaskViewLifecycle(this.app.vault, subcontainer));
            })();
        } else {
            let subcontainer = this.container.createDiv();
            (async () => {
                await renderTasks(subcontainer, tasks as Task[]);
                this.component.addChild(new TaskViewLifecycle(this.app.vault, subcontainer));
            })();
        }
    }
}

/** Evaluate a script where 'this' for the script is set to the given context. Allows you to define global variables. */
export function evalInContext(script: string, context: any): any {
    return function () { return eval(script); }.call(context);
}

/** Make a full API context which a script can be evaluted in. */
export function makeApiContext(index: FullIndex, component: Component, app: App, container: HTMLElement, originFile: string): DataviewInlineApi {
    return new DataviewInlineApi(index, component, container, app, originFile);
}
