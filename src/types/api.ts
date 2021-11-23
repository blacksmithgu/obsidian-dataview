import compareVersions from "compare-versions";
import { TAbstractFile, TFile } from "obsidian";
import { App, Component } from "obsidian";
import { FullIndex } from "../data";
import { DataObject, Link, LiteralValue, Values, Task } from "../data/value";
import { DataviewSettings } from "../settings";
import { DataArray } from "../api/data-array";
import { BoundFunctionImpl } from "../expression/functions";
import { Context } from "../expression/context";
import { DateTime, Duration } from "luxon";
import * as Luxon from "luxon";

/** Asynchronous API calls related to file / system IO. */
export interface DataviewIOApi {
    /** Load the contents of a CSV asynchronously, returning a data array of rows (or undefined if it does not exist). */
    csv(path: Link | string, originFile?: string): Promise<DataArray<DataObject> | undefined>;
    /** Asynchronously load the contents of any link or path in an Obsidian vault. */
    load(path: Link | string, originFile?: string): Promise<string | undefined>;
    /** Normalize a link or path relative to an optional origin file. Returns a textual fully-qualified-path. */
    normalize(path: Link | string, originFile?: string): string;
}

// declare api interface here to check breaking changes
export interface DataviewAPIInterface {
    /** utils to check api version */
    ver: {
        verNum: string;
        /**
         * Compare [semver](https://semver.org/) version strings using the specified operator.
         *
         * @param verToCompare version to compare
         * @param operator Allowed arithmetic operator to use
         * @returns `true` if the comparison between the verToCompare and the current version satisfies the operator, `false` otherwise.
         *
         * @example
         * ```
         * currVer = '10.1.1';
         * compare('<', '10.2.2'); // return true
         * compare('<=', '10.2.2'); // return true
         * compare('>=' '10.2.2'); // return false
         * ```
         */
        compare(operator: compareVersions.CompareOperator, verToCompare: string): boolean;
        /**
         * Match [npm semver](https://docs.npmjs.com/cli/v6/using-npm/semver) version range.
         *
         * @param range Range pattern for version
         * @returns `true` if the current version number is within the range, `false` otherwise.
         *
         * @example
         * ```
         * currVer = '1.1.0';
         * satisfies('^1.0.0'); // return true
         * satisfies('~1.0.0'); // return false
         * ```
         */
        satisfies(range: string): boolean;
    };
    app: App;
    index: FullIndex;
    settings: DataviewSettings;
    /** Evaluation context which expressions can be evaluated in. */
    evaluationContext: Context;

    /** Asynchronous API calls related to file / system IO. */
    io: DataviewIOApi;

    /** Dataview functions which can be called from DataviewJS. */
    func: Record<string, BoundFunctionImpl>;
    /** Value utility functions for comparisons and type-checking. */
    value: typeof Values;
    /** Re-exporting of luxon for people who can't easily require it. Sorry! */
    luxon: typeof Luxon;
    /** Return an array of paths (as strings) corresponding to pages which match the query. */
    pagePaths(query?: string, originFile?: string): DataArray<string>;
    /** Map a page path to the actual data contained within that page. */
    page(path: string | Link, originFile?: string): Record<string, LiteralValue> | undefined;
    /** Return an array of page objects corresponding to pages which match the query. */
    pages(query?: string, originFile?: string): DataArray<Record<string, LiteralValue>>;
    /**
     * Convert an input element or array into a Dataview data-array. If the input is already a data array,
     * it is returned unchanged.
     */
    array(raw: unknown): DataArray<any>;
    /** Return true if theg given value is a javascript array OR a dataview data array. */
    isArray(raw: unknown): raw is DataArray<any> | Array<any>;
    /** Create a dataview file link to the given path. */
    fileLink(path: string, embed?: boolean, display?: string): Link;
    /** Attempt to extract a date from a string, link or date. */
    date(pathlike: string | Link | DateTime): DateTime | null;
    /** Attempt to extract a duration from a string or duration. */
    duration(str: string | Duration): Duration | null;
    /**
     * Compare two arbitrary JavaScript values using Dataview's default comparison rules. Returns a negative value if
     * a < b, 0 if a = b, and a positive value if a > b.
     */
    compare(a: any, b: any): number;
    /** Return true if the two given JavaScript values are equal using Dataview's default comparison rules. */
    equal(a: any, b: any): boolean;
    /** Render a dataview list of the given values. */
    list(
        values: any[] | DataArray<any> | undefined,
        container: HTMLElement,
        component: Component,
        filePath: string
    ): void;
    /** Render a dataview table with the given headers, and the 2D array of values. */
    table(
        headers: string[],
        values: any[][] | DataArray<any> | undefined,
        container: HTMLElement,
        component: Component,
        filePath: string
    ): void;
    /** Render a dataview task view with the given tasks. */
    taskList(
        tasks: Task[] | DataArray<any>,
        groupByFile: boolean | undefined,
        container: HTMLElement,
        component: Component,
        filePath?: string
    ): Promise<void>;
    /** Render an arbitrary value into a container. */
    renderValue(
        value: any,
        container: HTMLElement,
        component: Component,
        filePath: string,
        inline?: boolean
    ): Promise<void>;
}

export const DVEventPrefix = "dataview:" as const;
export type DataviewEvents = [name: "api-ready", api: DataviewAPIInterface] | IndexEvents;

export type IndexEvents = [name: "metadata-change", ...args: IndexEventArgs];
/** All possible index events. */
export type IndexEventArgs =
    /** Called when dataview metadata for a file changes. */
    | [type: "rename", file: TAbstractFile, oldPath: string]
    /** Called when a file is deleted from the dataview index. */
    | [type: "delete" | "update", file: TFile];

declare global {
    // Must use var, no const/let
    var DataviewAPI: DataviewAPIInterface | undefined;
}
export type API_NAME = "DataviewAPI";
