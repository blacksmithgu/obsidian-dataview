/** Provides an AST for complex queries. */
import { Source } from "data-index/source";
import { Field } from "expression/field";

/** The supported query types (corresponding to view types). */
export type QueryType = "list" | "table" | "task" | "calendar";

/** A single-line comment. */
export type Comment = string;

/** Fields used in the query portion. */
export interface NamedField {
    /** The effective name of this field. */
    name: string;
    /** The value of this field. */
    field: Field;
}

/** A query sort by field, for determining sort order. */
export interface QuerySortBy {
    /** The field to sort on. */
    field: Field;
    /** The direction to sort in. */
    direction: "ascending" | "descending";
}

/** Utility functions for quickly creating fields. */
export namespace QueryFields {
    export function named(name: string, field: Field): NamedField {
        return { name, field } as NamedField;
    }

    export function sortBy(field: Field, dir: "ascending" | "descending"): QuerySortBy {
        return { field, direction: dir };
    }
}

//////////////////////
// Query Definition //
//////////////////////

/** A query which should render a list of elements. */
export interface ListQuery {
    type: "list";
    /** What should be rendered in the list. */
    format?: Field;
    /** If true, show the default DI field; otherwise, don't. */
    showId: boolean;
}

/** A query which renders a table of elements. */
export interface TableQuery {
    type: "table";
    /** The fields (computed or otherwise) to select. */
    fields: NamedField[];
    /** If true, show the default ID field; otherwise, don't. */
    showId: boolean;
}

/** A query which renders a collection of tasks. */
export interface TaskQuery {
    type: "task";
}

/** A query which renders a collection of notes in a calendar view. */
export interface CalendarQuery {
    type: "calendar";
    /** The date field that we'll be grouping notes by for the calendar view */
    field: NamedField;
}

export type QueryHeader = ListQuery | TableQuery | TaskQuery | CalendarQuery;

/** A step which only retains rows whose 'clause' field is truthy. */
export interface WhereStep {
    type: "where";
    clause: Field;
}

/** A step which sorts all current rows by the given list of sorts. */
export interface SortByStep {
    type: "sort";
    fields: QuerySortBy[];
}

/** A step which truncates the number of rows to the given amount. */
export interface LimitStep {
    type: "limit";
    amount: Field;
}

/** A step which flattens rows into multiple child rows. */
export interface FlattenStep {
    type: "flatten";
    field: NamedField;
}

/** A step which groups rows into groups by the given field. */
export interface GroupStep {
    type: "group";
    field: NamedField;
}

/** A virtual step which extracts an array of values from each row. */
export interface ExtractStep {
    type: "extract";
    fields: Record<string, Field>;
}

export type QueryOperation = WhereStep | SortByStep | LimitStep | FlattenStep | GroupStep | ExtractStep;

/**
 * A query over the Obsidian database. Queries have a specific and deterministic execution order:
 */
export interface Query {
    /** The view type to render this query in. */
    header: QueryHeader;
    /** The source that file candidates will come from. */
    source: Source;
    /** The operations to apply to the data to produce the final result that will be rendered. */
    operations: QueryOperation[];
}
