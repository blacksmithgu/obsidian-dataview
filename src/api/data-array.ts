import { Groupings, Values } from "data-model/value";
import { QuerySettings } from "settings";

/** A function which maps an array element to some value. */
export type ArrayFunc<T, O> = (elem: T, index: number, arr: T[]) => O;

/** A function which compares two types. */
export type ArrayComparator<T> = (a: T, b: T) => number;

/** Finds the value of the lowest value type in a grouping. */
export type LowestKey<T> = T extends { key: any; rows: any } ? LowestKey<T["rows"][0]> : T;

/** A ridiculous type which properly types the result of the 'groupIn' command. */
export type Ingrouped<U, T> = T extends { key: any; rows: any }
    ? { key: T["key"]; rows: Ingrouped<U, T["rows"][0]> }
    : { key: U; rows: T[] };

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
    mutate(f: ArrayFunc<T, void>): DataArray<T>;

    /** Limit the total number of entries in the array to the given value. */
    limit(count: number): DataArray<T>;
    /**
     * Take a slice of the array. If `start` is undefined, it is assumed to be 0; if `end` is undefined, it is assumed
     * to be the end of the array.
     */
    slice(start?: number, end?: number): DataArray<T>;
    /** Concatenate the values in this data array with those of another iterable / data array / array. */
    concat(other: Iterable<T>): DataArray<T>;

    /** Return the first index of the given (optionally starting the search) */
    indexOf(element: T, fromIndex?: number): number;
    /** Return the first element that satisfies the given predicate. */
    find(pred: ArrayFunc<T, boolean>): T | undefined;
    /** Find the index of the first element that satisfies the given predicate. Returns -1 if nothing was found. */
    findIndex(pred: ArrayFunc<T, boolean>, fromIndex?: number): number;
    /** Returns true if the array contains the given element, and false otherwise. */
    includes(element: T): boolean;

    /**
     * Return a string obtained by converting each element in the array to a string, and joining it with the
     * given separator (which defaults to ', ').
     */
    join(sep?: string): string;

    /**
     * Return a sorted array sorted by the given key; an optional comparator can be provided, which will
     * be used to compare the keys in lieu of the default dataview comparator.
     */
    sort<U>(key: ArrayFunc<T, U>, direction?: "asc" | "desc", comparator?: ArrayComparator<U>): DataArray<T>;

    /**
     * Mutably modify the current array with an in place sort; this is less flexible than a regular sort in exchange
     * for being a little more performant. Only use this is performance is a serious consideration.
     */
    sortInPlace<U>(key: (v: T) => U, direction?: "asc" | "desc", comparator?: ArrayComparator<U>): DataArray<T>;

    /**
     * Return an array where elements are grouped by the given key; the resulting array will have objects of the form
     * { key: <key value>, rows: DataArray }.
     */
    groupBy<U>(key: ArrayFunc<T, U>, comparator?: ArrayComparator<U>): DataArray<{ key: U; rows: DataArray<T> }>;

    /**
     * If the array is not grouped, groups it as `groupBy` does; otherwise, groups the elements inside each current
     * group. This allows for top-down recursive grouping which may be easier than bottom-up grouping.
     */
    groupIn<U>(key: ArrayFunc<LowestKey<T>, U>, comparator?: ArrayComparator<U>): DataArray<Ingrouped<U, T>>;

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
    /** Map every element in this data array to the given key; unlike to(), does not flatten the result. */
    into(key: string): DataArray<any>;

    /**
     * Recursively expand the given key, flattening a tree structure based on the key into a flat array. Useful for handling
     * hierarchical data like tasks with 'subtasks'.
     */
    expand(key: string): DataArray<any>;

    /** Run a lambda on each element in the array. */
    forEach(f: ArrayFunc<T, void>): void;

    /** Calculate the sum of the elements in the array. */
    sum(): number;

    /** Calculate the average of the elements in the array. */
    avg(): number;

    /** Calculate the minimum of the elements in the array. */
    min(): number;

    /** Calculate the maximum of the elements in the array. */
    max(): number;

    /** Convert this to a plain javascript array. */
    array(): T[];

    /** Allow iterating directly over the array. */
    [Symbol.iterator](): Iterator<T>;

    /** Map indexes to values. */
    [index: number]: any;
    /** Automatic flattening of fields. Equivalent to implicitly calling `array.to("field")` */
    [field: string]: any;
}

/** Implementation of DataArray, minus the dynamic variable access, which is implemented via proxy. */
class DataArrayImpl<T> implements DataArray<T> {
    private static ARRAY_FUNCTIONS: Set<string> = new Set([
        "where",
        "filter",
        "map",
        "flatMap",
        "mutate",
        "slice",
        "concat",
        "indexOf",
        "limit",
        "find",
        "findIndex",
        "includes",
        "join",
        "sort",
        "sortInPlace",
        "groupBy",
        "groupIn",
        "distinct",
        "every",
        "some",
        "none",
        "first",
        "last",
        "to",
        "into",
        "lwrap",
        "expand",
        "forEach",
        "length",
        "values",
        "array",
        "defaultComparator",
        "toString",
        "settings",
        "sum",
        "avg",
        "min",
        "max",
    ]);

    private static ARRAY_PROXY: ProxyHandler<DataArrayImpl<any>> = {
        get: function (target, prop, receiver) {
            if (typeof prop === "symbol") return (target as any)[prop];
            else if (typeof prop === "number") return target.values[prop];
            else if (prop === "constructor") return target.values.constructor;
            else if (!isNaN(parseInt(prop))) return target.values[parseInt(prop)];
            else if (DataArrayImpl.ARRAY_FUNCTIONS.has(prop.toString())) return target[prop.toString()];

            return target.to(prop);
        },
    };

    public static wrap<T>(
        arr: T[],
        settings: QuerySettings,
        defaultComparator: ArrayComparator<any> = Values.compareValue
    ): DataArray<T> {
        return new Proxy<DataArrayImpl<T>>(
            new DataArrayImpl<T>(arr, settings, defaultComparator),
            DataArrayImpl.ARRAY_PROXY
        );
    }

    public length: number;
    [key: string]: any;

    private constructor(
        public values: any[],
        public settings: QuerySettings,
        public defaultComparator: ArrayComparator<any> = Values.compareValue
    ) {
        this.length = values.length;
    }

    private lwrap<U>(values: U[]): DataArray<U> {
        return DataArrayImpl.wrap(values, this.settings, this.defaultComparator);
    }

    public where(predicate: ArrayFunc<T, boolean>): DataArray<T> {
        return this.lwrap(this.values.filter(predicate));
    }

    public filter(predicate: ArrayFunc<T, boolean>): DataArray<T> {
        return this.where(predicate);
    }

    public map<U>(f: ArrayFunc<T, U>): DataArray<U> {
        return this.lwrap(this.values.map(f));
    }

    public flatMap<U>(f: ArrayFunc<T, U[]>): DataArray<U> {
        let result = [];
        for (let index = 0; index < this.length; index++) {
            let value = f(this.values[index], index, this.values);
            if (!value || value.length == 0) continue;

            for (let r of value) result.push(r);
        }

        return this.lwrap(result);
    }

    public mutate(f: ArrayFunc<T, void>): DataArray<T> {
        for (let index = 0; index < this.values.length; index++) {
            f(this.values[index], index, this.values);
        }

        return this as any;
    }

    public limit(count: number): DataArray<T> {
        return this.lwrap(this.values.slice(0, count));
    }

    public slice(start?: number, end?: number): DataArray<T> {
        return this.lwrap(this.values.slice(start, end));
    }

    public concat(other: DataArray<T>): DataArray<T> {
        return this.lwrap(this.values.concat(other.values));
    }

    /** Return the first index of the given (optionally starting the search) */
    public indexOf(element: T, fromIndex?: number): number {
        return this.findIndex(e => this.defaultComparator(e, element) == 0, fromIndex);
    }

    /** Return the first element that satisfies the given predicate. */
    public find(pred: ArrayFunc<T, boolean>): T | undefined {
        let index = this.findIndex(pred);
        if (index == -1) return undefined;
        else return this.values[index];
    }

    public findIndex(pred: ArrayFunc<T, boolean>, fromIndex?: number): number {
        for (let index = fromIndex ?? 0; index < this.length; index++) {
            if (pred(this.values[index], index, this.values)) return index;
        }

        return -1;
    }

    public includes(element: T): boolean {
        return this.indexOf(element, 0) != -1;
    }

    public join(sep?: string): string {
        return this.map(s => Values.toString(s, this.settings))
            .array()
            .join(sep ?? ", ");
    }

    public sort<U>(key?: ArrayFunc<T, U>, direction?: "asc" | "desc", comparator?: ArrayComparator<U>): DataArray<T> {
        if (this.values.length == 0) return this;
        let realComparator = comparator ?? this.defaultComparator;
        let realKey = key ?? ((l: T) => l as any as U);

        // Associate each entry with it's index for the key function, and then do a normal sort.
        let copy = ([] as any[]).concat(this.array()).map((elem, index) => {
            return { index: index, value: elem };
        });
        copy.sort((a, b) => {
            let aKey = realKey(a.value, a.index, this.values);
            let bKey = realKey(b.value, b.index, this.values);
            return direction === "desc" ? -realComparator(aKey, bKey) : realComparator(aKey, bKey);
        });

        return this.lwrap(copy.map(e => e.value));
    }

    public sortInPlace<U>(
        key?: (value: T) => U,
        direction?: "asc" | "desc",
        comparator?: ArrayComparator<U>
    ): DataArray<T> {
        if (this.values.length == 0) return this;
        let realComparator = comparator ?? this.defaultComparator;
        let realKey = key ?? ((l: T) => l as any as U);

        this.values.sort((a, b) => {
            let aKey = realKey(a);
            let bKey = realKey(b);

            return direction == "desc" ? -realComparator(aKey, bKey) : realComparator(aKey, bKey);
        });

        return this;
    }

    public groupBy<U>(
        key: ArrayFunc<T, U>,
        comparator?: ArrayComparator<U>
    ): DataArray<{ key: U; rows: DataArray<T> }> {
        if (this.values.length == 0) return this.lwrap([]);

        // JavaScript sucks and we can't make hash maps over arbitrary types (only strings/ints), so
        // we do a poor man algorithm where we SORT, followed by grouping.
        let intermediate = this.sort(key, "asc", comparator);
        comparator = comparator ?? this.defaultComparator;

        let result: { key: U; rows: DataArray<T> }[] = [];
        let currentRow = [intermediate[0]];
        let current = key(intermediate[0], 0, intermediate.values);
        for (let index = 1; index < intermediate.length; index++) {
            let newKey = key(intermediate[index], index, intermediate.values);
            if (comparator(current, newKey) != 0) {
                result.push({ key: current, rows: this.lwrap(currentRow) });
                current = newKey;
                currentRow = [intermediate[index]];
            } else {
                currentRow.push(intermediate[index]);
            }
        }
        result.push({ key: current, rows: this.lwrap(currentRow) });

        return this.lwrap(result);
    }

    public groupIn<U>(key: ArrayFunc<LowestKey<T>, U>, comparator?: ArrayComparator<U>): DataArray<Ingrouped<U, T>> {
        if (Groupings.isGrouping(this.values)) {
            return this.map(v => {
                return {
                    key: (v as any).key,
                    rows: DataArray.wrap((v as any).rows, this.settings).groupIn(key as any, comparator as any),
                } as any;
            });
        } else {
            return this.groupBy(key as any, comparator) as any;
        }
    }

    public distinct<U>(key?: ArrayFunc<T, U>, comparator?: ArrayComparator<U>): DataArray<T> {
        if (this.values.length == 0) return this;
        let realKey = key ?? (x => x as any as U);

        // For similar reasons to groupBy, do a sort and take the first element of each block.
        let intermediate = this.map((x, index) => {
            return { key: realKey(x, index, this.values), value: x };
        }).sort(x => x.key, "asc", comparator);
        comparator = comparator ?? this.defaultComparator;

        let result: T[] = [intermediate[0].value];
        for (let index = 1; index < intermediate.length; index++) {
            if (comparator(intermediate[index - 1].key, intermediate[index].key) != 0) {
                result.push(intermediate[index].value);
            }
        }

        return this.lwrap(result);
    }

    public every(f: ArrayFunc<T, boolean>): boolean {
        return this.values.every(f);
    }

    public some(f: ArrayFunc<T, boolean>): boolean {
        return this.values.some(f);
    }

    public none(f: ArrayFunc<T, boolean>): boolean {
        return this.values.every((v, i, a) => !f(v, i, a));
    }

    public first(): T {
        return this.values.length > 0 ? this.values[0] : undefined;
    }
    public last(): T {
        return this.values.length > 0 ? this.values[this.values.length - 1] : undefined;
    }

    public to(key: string): DataArray<any> {
        let result: any[] = [];
        for (let child of this.values) {
            let value = child[key];
            if (value === undefined || value === null) continue;

            if (Array.isArray(value) || DataArray.isDataArray(value)) value.forEach(v => result.push(v));
            else result.push(value);
        }

        return this.lwrap(result);
    }

    public into(key: string): DataArray<any> {
        let result: any[] = [];
        for (let child of this.values) {
            let value = child[key];
            if (value === undefined || value === null) continue;

            result.push(value);
        }

        return this.lwrap(result);
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

        return this.lwrap(result);
    }

    public forEach(f: ArrayFunc<T, void>) {
        for (let index = 0; index < this.values.length; index++) {
            f(this.values[index], index, this.values);
        }
    }

    public sum() {
        return this.values.reduce((a, b) => a + b, 0);
    }

    public avg() {
        return this.sum() / this.values.length;
    }

    public min() {
        return Math.min(...this.values);
    }

    public max() {
        return Math.max(...this.values);
    }

    public array(): T[] {
        return ([] as any[]).concat(this.values);
    }

    public [Symbol.iterator](): Iterator<T> {
        return this.values[Symbol.iterator]();
    }

    public toString(): string {
        return "[" + this.values.join(", ") + "]";
    }
}

/** Provides utility functions for generating data arrays. */
export namespace DataArray {
    /** Create a new Dataview data array. */
    export function wrap<T>(raw: T[] | DataArray<T>, settings: QuerySettings): DataArray<T> {
        if (isDataArray(raw)) return raw;
        return DataArrayImpl.wrap(raw, settings);
    }

    /** Create a new DataArray from an iterable object. */
    export function from<T>(raw: Iterable<T>, settings: QuerySettings): DataArray<T> {
        if (isDataArray(raw)) return raw;

        let data = [];
        for (let elem of raw) data.push(elem);
        return DataArrayImpl.wrap(data, settings);
    }

    /** Return true if the given object is a data array. */
    export function isDataArray(obj: any): obj is DataArray<any> {
        return obj instanceof DataArrayImpl;
    }
}

// A scary looking polyfill, sure, but it fixes up data array/array interop for us.
const oldArrayIsArray = Array.isArray;
Array.isArray = (arg): arg is any[] => {
    return oldArrayIsArray(arg) || DataArray.isDataArray(arg);
};
