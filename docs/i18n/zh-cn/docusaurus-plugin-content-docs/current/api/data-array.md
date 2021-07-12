---
sidebar_position: 2
---
# 数据数组

在Dataview中，列表的结果一般抽象为`DataArray`，它是一个具有额外功能的代理数组。数据数组支持就像普通数组一样索引和迭代（通过 "for "和 "for ... of "循环），但也包括许多数据操作符，如 "sort"、"groupBy"、"distinct"、"where "等，使表格数据的处理变得简单。

## 创建

数据数组是大部分情况是由可以返回多个结果的Dataview API返回的，比如`dv.pages()`。你也可以使用`dv.array(<array>)`明确地将一个普通的JavaScript数组转换成Dataview数组。如果你想把一个数据数组转换为普通数组，请使用`DataArray#array()`。

## 索引和调配(Swizzling)

数据数组像普通数组一样支持常规索引（如`array[0]`），但重要的是，它还支持查询语言风格的 "swizzling"：如果你用字段名索引到一个数据数组（如`array.field`），它会自动将数组中的每个元素映射到`field`，如果`field`本身也是一个数组，则会将其扁平化。

例如，`dv.pages().file.name`将返回库中所有包含文件名的数据数组。 `dv.pages("#books").genres`将返回books中所有类型的扁平化列表。

## 原始接口

下面提供了数据数组实现的完整接口以供参考。

```js
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
    /** Concatenate the values in this data array with those of another data array. */
    concat(other: DataArray<T>): DataArray<T>;

    /** Return the first index of the given (optionally starting the search) */
    indexOf(element: T, fromIndex?: number): number;
    /** Return the first element that satisfies the given predicate. */
    find(pred: ArrayFunc<T, boolean>): T | undefined;
    /** Find the index of the first element that satisfies the given predicate. Returns -1 if nothing was found. */
    findIndex(pred: ArrayFunc<T, boolean>): number;
    /** Returns true if the array contains the given element, and false otherwise. */
    includes(element: T): boolean;

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
```