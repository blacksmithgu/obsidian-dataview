import { EXPRESSION } from "expression/parse";
import * as P from "parsimmon";
import {
    FlattenStep,
    GroupStep,
    LimitStep,
    NamedField,
    Query,
    QueryFields,
    QueryHeader,
    QueryOperation,
    QuerySortBy,
    QueryType,
    SortByStep,
    WhereStep,
    Comment,
} from "./query";
import { Source, Sources } from "data-index/source";
import { DEFAULT_QUERY_SETTINGS } from "settings";
import { Result } from "api/result";

///////////////////
// Query Parsing //
///////////////////

/** Typings for the outputs of all of the parser combinators. */
interface QueryLanguageTypes {
    queryType: QueryType;
    comment: Comment;

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

/** Return a new parser which executes the underlying parser and returns it's raw string representation. */
export function captureRaw<T>(base: P.Parser<T>): P.Parser<[T, string]> {
    return P.custom((success, failure) => {
        return (input, i) => {
            let result = (base as any)._(input, i);
            if (!result.status) return result;

            return Object.assign({}, result, { value: [result.value, input.substring(i, result.index)] });
        };
    });
}

/** Strip newlines and excess whitespace out of text. */
function stripNewlines(text: string): string {
    return text
        .split(/[\r\n]+/)
        .map(t => t.trim())
        .join("");
}

/** Given `parser`, return the parser that returns `if_eof()` if EOF is found,
 * otherwise `parser` preceded by (non-optional) whitespace */
function precededByWhitespaceIfNotEof<T>(if_eof: (_: undefined) => T, parser: P.Parser<T>): P.Parser<T> {
    return P.eof.map(if_eof).or(P.whitespace.then(parser));
}

/** A parsimmon-powered parser-combinator implementation of the query language. */
export const QUERY_LANGUAGE = P.createLanguage<QueryLanguageTypes>({
    // Simple atom parsing, like words, identifiers, numbers.
    queryType: q =>
        P.alt<string>(P.regexp(/TABLE|LIST|TASK|CALENDAR/i))
            .map(str => str.toLowerCase() as QueryType)
            .desc("query type ('TABLE', 'LIST', 'TASK', or 'CALENDAR')"),
    explicitNamedField: q =>
        P.seqMap(
            EXPRESSION.field.skip(P.whitespace),
            P.regexp(/AS/i).skip(P.whitespace),
            EXPRESSION.identifier.or(EXPRESSION.string),
            (field, _as, ident) => QueryFields.named(ident, field)
        ),
    comment: () =>
        P.Parser((input, i) => {
            // Parse a comment, which is a line starting with //.
            let line = input.substring(i);
            if (!line.startsWith("//")) return P.makeFailure(i, "Not a comment");
            // The comment ends at the end of the line.
            line = line.split("\n")[0];
            let comment = line.substring(2).trim();
            return P.makeSuccess(i + line.length, comment);
        }),
    namedField: q =>
        P.alt<NamedField>(
            q.explicitNamedField,
            captureRaw(EXPRESSION.field).map(([value, text]) => QueryFields.named(stripNewlines(text), value))
        ),
    sortField: q =>
        P.seqMap(
            EXPRESSION.field.skip(P.optWhitespace),
            P.regexp(/ASCENDING|DESCENDING|ASC|DESC/i).atMost(1),
            (field, dir) => {
                let direction = dir.length == 0 ? "ascending" : dir[0].toLowerCase();
                if (direction == "desc") direction = "descending";
                if (direction == "asc") direction = "ascending";
                return {
                    field: field,
                    direction: direction as "ascending" | "descending",
                };
            }
        ),

    headerClause: q =>
        q.queryType
            .chain(type => {
                switch (type) {
                    case "table": {
                        return precededByWhitespaceIfNotEof(
                            () => ({ type, fields: [], showId: true }),
                            P.seqMap(
                                P.regexp(/WITHOUT\s+ID/i)
                                    .skip(P.optWhitespace)
                                    .atMost(1),
                                P.sepBy(q.namedField, P.string(",").trim(P.optWhitespace)),
                                (withoutId, fields) => {
                                    return { type, fields, showId: withoutId.length == 0 };
                                }
                            )
                        );
                    }
                    case "list":
                        return precededByWhitespaceIfNotEof(
                            () => ({ type, format: undefined, showId: true }),
                            P.seqMap(
                                P.regexp(/WITHOUT\s+ID/i)
                                    .skip(P.optWhitespace)
                                    .atMost(1),
                                EXPRESSION.field.atMost(1),
                                (withoutId, format) => {
                                    return {
                                        type,
                                        format: format.length == 1 ? format[0] : undefined,
                                        showId: withoutId.length == 0,
                                    };
                                }
                            )
                        );
                    case "task":
                        return P.succeed({ type });
                    case "calendar":
                        return P.whitespace.then(
                            P.seqMap(q.namedField, field => {
                                return {
                                    type,
                                    showId: true,
                                    field,
                                } as QueryHeader;
                            })
                        );
                    default:
                        return P.fail(`Unrecognized query type '${type}'`);
                }
            })
            .desc("TABLE or LIST or TASK or CALENDAR"),
    fromClause: q => P.seqMap(P.regexp(/FROM/i), P.whitespace, EXPRESSION.source, (_1, _2, source) => source),
    whereClause: q =>
        P.seqMap(P.regexp(/WHERE/i), P.whitespace, EXPRESSION.field, (where, _, field) => {
            return { type: "where", clause: field } as WhereStep;
        }).desc("WHERE <expression>"),
    sortByClause: q =>
        P.seqMap(
            P.regexp(/SORT/i),
            P.whitespace,
            q.sortField.sepBy1(P.string(",").trim(P.optWhitespace)),
            (sort, _1, fields) => {
                return { type: "sort", fields } as SortByStep;
            }
        ).desc("SORT field [ASC/DESC]"),
    limitClause: q =>
        P.seqMap(P.regexp(/LIMIT/i), P.whitespace, EXPRESSION.field, (limit, _1, field) => {
            return { type: "limit", amount: field } as LimitStep;
        }).desc("LIMIT <value>"),
    flattenClause: q =>
        P.seqMap(P.regexp(/FLATTEN/i).skip(P.whitespace), q.namedField, (_, field) => {
            return { type: "flatten", field } as FlattenStep;
        }).desc("FLATTEN <value> [AS <name>]"),
    groupByClause: q =>
        P.seqMap(P.regexp(/GROUP BY/i).skip(P.whitespace), q.namedField, (_, field) => {
            return { type: "group", field } as GroupStep;
        }).desc("GROUP BY <value> [AS <name>]"),
    // Full query parsing.
    clause: q => P.alt(q.fromClause, q.whereClause, q.sortByClause, q.limitClause, q.groupByClause, q.flattenClause),
    query: q =>
        P.seqMap(
            q.headerClause.trim(optionalWhitespaceOrComment),
            q.fromClause.trim(optionalWhitespaceOrComment).atMost(1),
            q.clause.trim(optionalWhitespaceOrComment).many(),
            (header, from, clauses) => {
                return {
                    header,
                    source: from.length == 0 ? Sources.folder("") : from[0],
                    operations: clauses,
                    settings: DEFAULT_QUERY_SETTINGS,
                } as Query;
            }
        ),
});

/**
 * A parser for optional whitespace or comments. This is used to exclude whitespace and comments from other parsers.
 */
const optionalWhitespaceOrComment: P.Parser<string> = P.alt(P.whitespace, QUERY_LANGUAGE.comment)
    .many() // Use many() since there may be zero whitespaces or comments.
    // Transform the many to a single result.
    .map(arr => arr.join(""));

/**
 * Attempt to parse a query from the given query text, returning a string error
 * if the parse failed.
 */
export function parseQuery(text: string): Result<Query, string> {
    try {
        let query = QUERY_LANGUAGE.query.tryParse(text);
        return Result.success(query);
    } catch (error) {
        return Result.failure("" + error);
    }
}
