import { Fields } from "src/query";

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

        return DataArray.wrap(result);
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
export namespace DataArray {
    /** Create a new Dataview data array. */
    export function wrap<T>(raw: T[]): DataArray<T> {
        return DataArrayImpl.wrap(raw);
    }

    /** Return true if the given object is a data array. */
    export function isDataArray(obj: any): obj is DataArray<any> {
        return obj instanceof DataArrayImpl;
    }
}
