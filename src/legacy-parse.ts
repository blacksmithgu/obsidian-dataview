import { QueryType, NamedField, Field, QuerySortBy, Query, Source, Sources, Fields } from "src/query";
import { EXPRESSION } from "src/parse";
import * as P from 'parsimmon';

interface SortByClause {
    type: 'sort-by';
    fields: QuerySortBy[];
}

interface WhereClause {
    type: 'where';
    field: Field;
}

interface FromClause {
    type: 'from';
    source: Source;
}

/** A clause that can be parsed; allows for order of clauses to vary. */
type Clause = SortByClause | WhereClause | FromClause;
/** Typings for the outputs of all of the parser combinators. */
interface QueryLanguageTypes {
    queryType: QueryType;

    explicitNamedField: NamedField;
    namedField: NamedField;
    sortField: QuerySortBy;

    // Entire clauses in queries.
    selectClause: { type: QueryType; fields: NamedField[] };
    fromClause: FromClause;
    whereClause: WhereClause;
    sortByClause: SortByClause;
    clause: Clause;
    query: Query;
}

/** A parsimmon-powered parser-combinator implementation of the query language. */
export const QUERY_LANGUAGE = P.createLanguage<QueryLanguageTypes>({
    // Simple atom parsing, like words, identifiers, numbers.
    queryType: q => P.alt<string>(P.regexp(/TABLE|LIST|TASK/i)).map(str => str.toLowerCase() as QueryType)
        .desc("query type ('TABLE', 'LIST', or 'TASK')"),
    explicitNamedField: q => P.seqMap(EXPRESSION.field, P.whitespace, P.regexp(/AS/i), P.whitespace, EXPRESSION.identifier,
        (field, _1, _2, _3, ident) => Fields.named(ident, field)),
    namedField: q => P.alt<NamedField>(
        q.explicitNamedField,
        EXPRESSION.identifierDot.map(ident => Fields.named(ident, Fields.indexVariable(ident)))
    ),
    sortField: q => P.seqMap(P.optWhitespace,
        EXPRESSION.field, P.optWhitespace, P.regexp(/ASCENDING|DESCENDING|ASC|DESC/i).atMost(1),
            (_1, field, _2, dir) => {
                let direction = dir.length == 0 ? 'ascending' : dir[0].toLowerCase();
                if (direction == 'desc') direction = 'descending';
                if (direction == 'asc') direction = 'ascending';
                return {
                    field: field,
                    direction: direction as 'ascending' | 'descending'
                };
            }),

    selectClause: q => P.seqMap(q.queryType, P.whitespace, P.sepBy(q.namedField.notFollowedBy(P.whitespace.then(EXPRESSION.source)), P.string(',').trim(P.optWhitespace)),
        (qtype, _, fields) => {
            return { type: qtype, fields }
        }),
    fromClause: q => P.seqMap(P.regexp(/FROM/i), P.whitespace, EXPRESSION.source,
        (from, space, source) => {
            return {
                type: 'from',
                source
            }
        }),
    whereClause: q => P.seqMap(P.regexp(/WHERE/i), P.whitespace, EXPRESSION.field, (where, _, field) => {
        return { type: 'where', field };
    }),
    sortByClause: q => P.seqMap(P.regexp(/SORT/i), P.whitespace, q.sortField.sepBy1(P.string(',').trim(P.optWhitespace)),
        (sort, _1, fields) => {
            return { type: 'sort-by', fields };
        }),
    // Full query parsing.
    clause: q => P.alt(q.fromClause, q.whereClause, q.sortByClause),
    query: q => P.seqMap(q.selectClause, q.clause.trim(P.optWhitespace).many(), (select, clauses) => {
        let fromClauses = clauses.filter((c): c is FromClause => c.type == 'from');
        let whereClauses = clauses.filter((c): c is WhereClause => c.type == 'where');
        let sortClauses = clauses.filter((c): c is SortByClause => c.type == 'sort-by');

        let source: Source = null;
        for (let clause of fromClauses) {
            if (source == null) source = clause.source;
            else source = Sources.binaryOp(source, '|', clause.source);
        }

        let compoundWhere: Field = null;
        for (let clause of whereClauses) {
            if (compoundWhere == null) compoundWhere = clause.field;
            else compoundWhere = Fields.binaryOp(compoundWhere, '&', clause.field);
        }

        let sortBy: QuerySortBy[] = [];
        for (let clause of sortClauses) {
            clause.fields.forEach(entry => sortBy.push(entry));
        }

        return {
            type: select.type,
            fields: select.fields,
            source: source ?? Sources.folder(""),
            where: compoundWhere ?? Fields.literal('boolean', true),
            sortBy: sortBy
        } as Query;
    })
});

/**
 * Attempt to parse a query from the given query text, returning a string error
 * if the parse failed.
 */
export function parseQuery(text: string): Query | string {
    try {
        return QUERY_LANGUAGE.query.tryParse(text);
    } catch (error) {
        return "" + error;
    }
}