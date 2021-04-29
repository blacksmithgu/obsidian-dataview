/** Fancy wrappers for the JavaScript API, used both by external plugins AND by the dataview javascript view. */

import { App, Component } from "obsidian";
import { FullIndex } from "src/index";
import { collectFromSource, createContext } from "./engine";
import { EXPRESSION } from "./parse";
import { Fields, Link } from "./query";
import { renderList, renderTable } from "./render";

type ArrayFunc<O> = (elem: any, index: number, arr: any[]) => O;

/**
 * Proxied interface which allows manipulating array-based data. All functions on a data array produce a NEW array
 * (i.e., the arrays are immutable).
 */
export interface DataArray {
    /** The total number of elements in the array. */
    length: number;

    /** Filter the data array down to just elements which match the given predicate. */
    where(predicate: ArrayFunc<boolean>): DataArray;
    /** Alias for 'where' for people who want array semantics. */
    filter(predicate: ArrayFunc<boolean>): DataArray;

    /** Map elements in the data array by applying a function to each. */
    map(f: ArrayFunc<any>): DataArray;
    /** Map elements in the data array by applying a function to each, then flatten the results to produce a new array. */
    flatMap(f: ArrayFunc<any[]>): DataArray;

    /** Limit the total number of entries in the array to the given value. */
    limit(count: number): DataArray;
    /**
     * Take a slice of the array. If `start` is undefined, it is assumed to be 0; if `end` is undefined, it is assumbed
     * to be the end of the array.
     */
    slice(start?: number, end?: number): DataArray;

    /**
     * Return a sorted array sorted by the given key; an optional comparator can be provided, which will
     * be used to compare the keys in leiu of the default dataview comparator.
     */
    sort(key: ArrayFunc<any>, direction?: 'asc' | 'desc', comparator?: (a: any, b: any) => number): DataArray;

    /** Return true if the predicate is true for all values. */
    every(f: ArrayFunc<boolean>): boolean;
    /** Return true if the predicate is true for at least one value. */
    some(f: ArrayFunc<boolean>): boolean;
    /** Return true if the predicate is FALSE for all values. */
    none(f: ArrayFunc<boolean>): boolean;

    /** Return the first element in the data array. Returns undefined if the array is empty. */
    first(): any;
    /** Return the last element in the data array. Returns undefined if the array is empty. */
    last(): any;

    /** Map every element in this data array to the given key, and then flatten it.*/
    to(key: string): DataArray;
    /**
     * Recursively expand the given key, flattening a tree structure based on the key into a flat array. Useful for handling
     * heirarchical data like tasks with 'subtasks'.
     */
    expand(key: string): DataArray;

    /** Run a lambda on each element in the array. */
    forEach(f: ArrayFunc<void>): void;

    /** Allow iterating directly over the array. */
    [Symbol.iterator](): Iterator<any>;

    /** Map indexes to values. */
    [index: number]: any;
    /** Automatic flattening of fields. */
    [field: string]: any;
}

/** Implementation of DataArray, minus the dynamic variable access, which is implemented via proxy. */
class DataArrayImpl implements DataArray {
    private static ARRAY_FUNCTIONS: Set<string> = new Set([
        "where", "filter", "map", "flatMap", "slice", "sort", "every", "some", "none", "first", "last", "to",
        "expand", "forEach"
    ]);

    private static ARRAY_PROXY: ProxyHandler<DataArrayImpl> = {
        get: function(target, prop, reciever) {
            if (typeof prop === "number") return target[prop];
            else if (DataArrayImpl.ARRAY_FUNCTIONS.has(prop.toString())) return target[prop.toString()];

            return target.to(prop.toString());
        }
    };

    public static wrap(arr: any[]): DataArray {
        return new Proxy(new DataArrayImpl(arr), DataArrayImpl.ARRAY_PROXY);
    }

    public length: number;
    [key: string]: any;

    private constructor(public values: any[]) {
        this.length = values.length;
    }

    public where(predicate: ArrayFunc<boolean>): DataArray {
        return DataArrayImpl.wrap(this.values.filter(predicate));
    }

    public filter(predicate: ArrayFunc<boolean>): DataArray {
        return this.where(predicate);
    }

    public map(f: ArrayFunc<any>): DataArray {
        return DataArrayImpl.wrap(this.values.map(f));
    }

    public flatMap(f: ArrayFunc<any[]>): DataArray {
        let result = [];
        for (let index = 0; index < this.length; index++) {
            for (let r of f(this.values[index], index, this.values)) result.push(r);
        }

        return DataArrayImpl.wrap(result);
    }

    public limit(count: number): DataArray {
        return DataArrayImpl.wrap(this.values.slice(0, count));
    }

    public slice(start?: number, end?: number): DataArray {
        return DataArrayImpl.wrap(this.values.slice(start, end));
    }

    public sort(key: ArrayFunc<any>, direction?: 'asc' | 'desc', comparator?: (a: any, b: any) => number): DataArray {
        // todo: implement.
        return this;
    }

    public every(f: ArrayFunc<boolean>): boolean { return this.values.every(f); }

    public some(f: ArrayFunc<boolean>): boolean { return this.values.some(f); }

    public none(f: ArrayFunc<boolean>): boolean { return this.values.every((v, i, a) => !f(v, i, a)); }

    public first(): any { return this.values.length > 0 ? this.values[0] : undefined; }
    public last(): any { return this.values.length > 0 ? this.values[this.values.length - 1] : undefined; }

    public to(key: string): DataArray {
        let result: any[] = [];
        for (let child of this.values) {
            let value = child[key];
            if (value === undefined || value === null) continue;

            if (Array.isArray(value)) value.forEach(v => result.push(v));
            else result.push(value);
        }

        return DataArrayImpl.wrap(result);
    }

    public expand(key: string): DataArray {
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

    public forEach(f: ArrayFunc<void>) {
        for (let index = 0; index < this.values.length; index++) {
            f(this.values[index], index, this.values);
        }
    }

    public [Symbol.iterator](): Iterator<any> {
        return this.values[Symbol.iterator]();
    }
}

/** Proxied interface which stores field-based data. */
export interface DataObject {
    size: number;
    
    /** Index into the object to obtain values for this row. */
    [key: string]: any;

    /**
     * Recursively expand the given key, producing a flattened list. Useful for heirarchical data structures, like
     * tasks with 'subtasks'.
     */
    expand(key: string): DataArray;
}

class DataObjectImpl implements DataObject {
    private static OBJECT_FUNCTIONS: Set<string> = new Set([
        "size", "expand"
    ]);

    private static OBJECT_PROXY: ProxyHandler<DataObjectImpl> = {
        get: function(target, prop, reciever) {
            if (DataObjectImpl.OBJECT_FUNCTIONS.has(prop.toString())) return target[prop.toString()];
            
            return target.object[prop.toString()];
        }
    };

    public static wrap(raw: Record<string, any>): DataObject {
        return new Proxy(new DataObjectImpl(raw), this.OBJECT_PROXY);
    }

    public size: number;
    [key: string]: any;

    public constructor(public object: Record<string, any>) {
        this.size = Object.keys(object).length;
    }

    public expand(key: string): DataArray {
        let result = [];
        let queue: any[] = [this];

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
}

/** Provides utility functions for generating data arrays. */
export namespace Data {
    /** Create a new Dataview data array. */
    export function array(raw: any[]): DataArray {
        return DataArrayImpl.wrap(raw);
    }

    /** Create a new dataview data object. */
    export function object(raw: Record<string, any>): DataObject {
        return DataObjectImpl.wrap(raw);
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

    /////////////////////////
    // Rendering Functions //
    /////////////////////////

    public header(level: number, text: string) {
        switch (level) {
            case 1: this.container.createEl('h1', { text }); break;
            case 2: this.container.createEl('h2', { text }); break;
            case 3: this.container.createEl('h3', { text }); break;
            case 4: this.container.createEl('h4', { text }); break;
            case 5: this.container.createEl('h5', { text }); break;
            case 6: this.container.createEl('h6', { text }); break;
            default: throw new Error(`Invalid header level ${level}`);
        }
    }

    public paragraph(text: string) {
        this.container.createEl('p', { text });
    }

    /** Return an array of paths (as strings) corresponding to pages which match the query. */
    public pagePaths(query: string): DataArray {
        try {
            let source = EXPRESSION.source.tryParse(query);
            return Data.array(Array.from(collectFromSource(source, this.index, this.currentFilePath)));
        } catch (ex) {
            throw new Error(`Failed to parse query in 'pagePaths': ${ex}`);
        }
    }

    /** Map a page path to the actual data contained within that page. */
    public page(path: string | Link): DataObject | undefined {
        let rawPath = (path instanceof Link) ? path.path : path;
        let rawData = createContext(rawPath, this.index, undefined)?.namespace;
        if (rawData === undefined) return undefined;

        return Data.object(Fields.fieldToValue(rawData) as Record<string, any>);
    }

    /** Return an array of page objects corresponding to pages which match the query. */
    public pages(query: string): DataArray {
        return this.pagePaths(query).flatMap(p => {
            console.log("inside?");
            let res = this.page(p);
            return res ? [res] : [];
        });
    }

    public list(values: any[]) {
        renderList(this.container, values, this.component, this.currentFilePath, "\-");
    }

    public rawTable(headers: string[], values: any[][]) {
        renderTable(this.container, headers, values, this.component, this.currentFilePath, "\-");
    }
}

/** Evaluate a script where 'this' for the script is set to the given context. Allows you to define global variables. */
export function evalInContext(script: string, context: any): any {
    return function() { return eval(script); }.call(context);
}

/** Make a full API context which a script can be evaluted in. */
export function makeApiContext(index: FullIndex, component: Component, app: App, container: HTMLElement, originFile: string): DataviewInlineApi {
    return new DataviewInlineApi(index, component, container, app, originFile);
}