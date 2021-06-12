/** Provides an AST for complex queries. */
import { Source } from '../data/source';
import { Field } from '../expression/field';
import { QuerySettings } from '../settings';

/** The supported query types (corresponding to view types). */
export type QueryType = 'list' | 'table' | 'task';

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
    direction: 'ascending' | 'descending';
}

/** Utility functions for quickly creating fields. */
export namespace QueryFields {
    export function named(name: string, field: Field): NamedField {
        return { name, field } as NamedField;
    }

    export function sortBy(field: Field, dir: 'ascending' | 'descending'): QuerySortBy {
        return { field, direction: dir };
    }
}

//////////////////////
// Query Definition //
//////////////////////

/** A query which should render a list of elements. */
export interface ListQuery {
    type: 'list';
    /** What should be rendered in the list. */
    format?: Field;
}

/** A query which renders a table of elements. */
export interface TableQuery {
    type: 'table';
    /** The fields (computed or otherwise) to select. */
    fields: NamedField[];
}

/** A query which renders a collection of tasks. */
export interface TaskQuery {
    type: 'task';
}

export type QueryHeader = ListQuery | TableQuery | TaskQuery;

export interface WhereStep {
    type: 'where';
    clause: Field;
}

export interface SortByStep {
    type: 'sort';
    fields: QuerySortBy[];
}

export interface LimitStep {
    type: 'limit';
    amount: Field;
}

export interface FlattenStep {
    type: 'flatten';
    field: NamedField;
}

export interface GroupStep {
    type: 'group';
    field: NamedField;
}

export interface ExtractStep {
    type: 'extract';
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
    /** Rendering and execution settings for this query. */
    settings: QuerySettings;
}
