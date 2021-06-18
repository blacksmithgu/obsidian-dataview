import { EXPRESSION } from 'src/expression/parse';
import * as P from 'parsimmon';
import { FlattenStep, GroupStep, LimitStep, NamedField, Query, QueryFields, QueryHeader, QueryOperation, QuerySortBy, QueryType, SortByStep, WhereStep } from './query';
import { Source, Sources } from 'src/data/source';
import { Fields } from 'src/expression/field';
import { DEFAULT_QUERY_SETTINGS, QuerySettings } from 'src/settings';
import { Result } from 'src/api/result';

///////////////////
// Query Parsing //
///////////////////

/** Typings for the outputs of all of the parser combinators. */
interface QueryLanguageTypes {
    queryType: QueryType;

    explicitNamedField: NamedField;
    namedField: NamedField;
    sortField: QuerySortBy;

    // Entire clauses in queries.
    headerClause: QueryHeader;
    fromClause: Source;
    whereClause: WhereStep;
    sortByClause: SortByStep;
    limitClause: LimitStep;
    flattenClause: FlattenStep;
    groupByClause: GroupStep;
    clause: QueryOperation;
    query: Query;
}

/** A parsimmon-powered parser-combinator implementation of the query language. */
export const QUERY_LANGUAGE = P.createLanguage<QueryLanguageTypes>({
    // Simple atom parsing, like words, identifiers, numbers.
    queryType: q => P.alt<string>(P.regexp(/TABLE|LIST|TASK/i)).map(str => str.toLowerCase() as QueryType)
        .desc("query type ('TABLE', 'LIST', or 'TASK')"),
    explicitNamedField: q => P.seqMap(EXPRESSION.field.skip(P.whitespace), P.regexp(/AS/i).skip(P.whitespace), EXPRESSION.identifier.or(EXPRESSION.string),
        (field, _as, ident) => QueryFields.named(ident, field)),
    namedField: q => P.alt<NamedField>(
        q.explicitNamedField,
        EXPRESSION.identifierDot.map(ident => QueryFields.named(ident, Fields.indexVariable(ident)))
    ),
    sortField: q => P.seqMap(EXPRESSION.field.skip(P.optWhitespace), P.regexp(/ASCENDING|DESCENDING|ASC|DESC/i).atMost(1),
            (field, dir) => {
                let direction = dir.length == 0 ? 'ascending' : dir[0].toLowerCase();
                if (direction == 'desc') direction = 'descending';
                if (direction == 'asc') direction = 'ascending';
                return {
                    field: field,
                    direction: direction as 'ascending' | 'descending'
                };
            }),

    headerClause: q => q.queryType.skip(P.whitespace).chain(qtype => {
        switch (qtype) {
            case "table":
                return P.sepBy(q.namedField, P.string(',').trim(P.optWhitespace))
                    .map(fields => { return { type: 'table', fields } as QueryHeader });
            case "list":
                return EXPRESSION.field.atMost(1)
                    .map(format => { return { type: 'list', format: format.length == 1 ? format[0] : undefined }});
            case "task":
                return P.succeed({ type: 'task' });
            default:
                return P.fail(`Unrecognized query type '${qtype}'`);
        }
    }),
    fromClause: q => P.seqMap(P.regexp(/FROM/i), P.whitespace, EXPRESSION.source, (_1, _2, source) => source),
    whereClause: q => P.seqMap(P.regexp(/WHERE/i), P.whitespace, EXPRESSION.field,
        (where, _, field) => { return { type: 'where', clause: field }}),
    sortByClause: q => P.seqMap(P.regexp(/SORT/i), P.whitespace, q.sortField.sepBy1(P.string(',').trim(P.optWhitespace)),
        (sort, _1, fields) => { return { type: 'sort', fields }}),
    limitClause: q => P.seqMap(P.regexp(/LIMIT/i), P.whitespace, EXPRESSION.field,
        (limit, _1, field) => { return { type: 'limit', amount: field }}),
    flattenClause: q => P.seqMap(P.regexp(/FLATTEN/i).skip(P.whitespace), q.namedField,
        (_, field) => { return { type: 'flatten', field }}),
    groupByClause: q => P.seqMap(P.regexp(/GROUP BY/i).skip(P.whitespace), q.namedField,
        (_, field) => { return { type: 'group', field }}),
    // Full query parsing.
    clause: q => P.alt(q.fromClause, q.whereClause, q.sortByClause, q.limitClause, q.groupByClause, q.flattenClause),
    query: q => P.seqMap(q.headerClause.trim(P.optWhitespace), q.fromClause.trim(P.optWhitespace).atMost(1), q.clause.trim(P.optWhitespace).many(), (header, from, clauses) => {
        return {
            header,
            source: from.length == 0 ? Sources.folder("") : from[0],
            operations: clauses,
            settings: DEFAULT_QUERY_SETTINGS
        } as Query;
    })
});

/**
 * Attempt to parse a query from the given query text, returning a string error
 * if the parse failed.
 */
export function parseQuery(text: string, settings?: QuerySettings): Result<Query, string> {
    try {
        let query = QUERY_LANGUAGE.query.tryParse(text);
        if (settings) query.settings = Object.assign(query.settings, settings);

        return Result.success(query);
    } catch (error) {
        return Result.failure("" + error);
    }
}
