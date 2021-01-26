/** Provides query parsing from plain-text. */

/** The supported query types (corresponding to view types). */
export type QueryType = 'list' | 'table';

/** A (potentially computed) field to select or compare against. */

export interface Field {
    /**
     * The field type - literals are actual raw values, variables are things in the frontmatter,
     * and computed are complex functions of subfields.
     * */
    type: 'literal' | 'variable' | 'computed';
}

/** A query sort by field, for determining sort order. */
export interface QuerySortBy {
    /** The field to sort on. */
    field: Field;
    /** The direction to sort in. */
    direction: 'ascending' | 'descending';
}

/** A query over the Obsidian database. */
export interface Query {
    /** The view type to render this query in. */
    type: QueryType;
    /** The fields (computed or otherwise) to select. */
    fields: Field[];
    /** The tags to select from. */
    from: string[];
    /** Tags or subtags to exclude. */
    except: string[];
    /** A boolean field which determines if a given entry should be included. */
    where: Field;
    /** */
    sortBy: QuerySortBy[];
}

/**
 * Attempt to parse a query from the given query text, returning a string error
 * if the parse failed.
 */
export function parseQuery(text: string): Query | string {
    return "Not implemented";
}