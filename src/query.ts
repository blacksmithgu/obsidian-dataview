/** Provides query parsing from plain-text. */
import 'parsimmon';
import * as Parsimmon from 'parsimmon';

/** The supported query types (corresponding to view types). */
export type QueryType = 'list' | 'table' | 'task';

export type LiteralType = 'boolean' | 'number' | 'string' | 'duration' | 'date' | 'rating';
export type LiteralTypeRepr<T extends LiteralType> =
    T extends 'boolean' ? boolean :
    T extends 'number' ? number :
    T extends 'string' ? string :
    T extends 'duration' ? number :
    T extends 'date' ? number :
    T extends 'rating' ? number :
    any;

export type BinaryOp = '+' | '-' | '>' | '>=' | '<=' | '<' | '=' | '&' | '|';

/** A (potentially computed) field to select or compare against. */
export type Field = BinaryOpField | VariableField | LiteralField;
export type LiteralField = LiteralFieldRepr<'string'> | LiteralFieldRepr<'number'> | LiteralFieldRepr<'boolean'>;

export interface LiteralFieldRepr<T extends LiteralType> {
    type: 'literal';
    valueType: T;
    value: LiteralTypeRepr<T>;
}

export interface VariableField {
    type: 'variable';
    name: string;
}

export interface BinaryOpField {
    type: 'binaryop';
    left: Field;
    right: Field;
    op: BinaryOp;
}

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

export namespace Fields {
    export function variable(name: string): VariableField {
        return { type: 'variable', name };
    }

    export function literal<T extends LiteralType>(vtype: T, val: LiteralTypeRepr<T>): LiteralField {
        return { type: 'literal', valueType: vtype, value: val } as LiteralFieldRepr<T> as LiteralField;
    }
    
    export function binaryOp(left: Field, op: BinaryOp, right: Field): Field {
        return { left, op, right } as BinaryOpField;
    }

    export function named(name: string, field: Field): NamedField {
        return { name, field } as NamedField;
    }

    export function sortBy(field: Field, dir: 'ascending' | 'descending'): QuerySortBy {
        return { field, direction: dir };
    }

    export function isTruthy(field: LiteralField): boolean {
        switch (field.valueType) {
            case "number":
                return field.value != 0;
            case "string":
                return field.value.length > 0;
            case "boolean":
                return field.value;
        }
    }
}

/** A query over the Obsidian database. */
export interface Query {
    /** The view type to render this query in. */
    type: QueryType;
    /** The fields (computed or otherwise) to select. */
    fields: NamedField[];
    /** The tags to select from. */
    from: string[];
    /** Tags or subtags to exclude. */
    except: string[];
    /** A boolean field which determines if a given entry should be included. */
    where: Field;
    /** */
    sortBy: QuerySortBy[];
}

/** A clause that can be parsed; allows for order of clauses to vary. */
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
    include: string[];
    exclude: string[];
}

type Clause = SortByClause | WhereClause | FromClause;

/** Typings for the outputs of all of the parser combinators. */
interface QueryLanguageTypes {
    queryType: QueryType;

    number: number;
    string: string;
    bool: boolean;
    tag: string;
    identifier: string;
    binaryPlusMinus: BinaryOp;
    binaryCompareOp: BinaryOp;
    binaryBooleanOp: BinaryOp;

    // Field-related parsers.
    variableField: VariableField;
    numberField: Field;
    boolField: Field;
    stringField: Field;
    atomField: Field;

    binaryPlusMinusField: Field;
    binaryCompareField: Field;
    binaryBooleanField: Field;
    binaryOpField: Field;
    parensField: Field;
    field: Field;
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
export const QUERY_LANGUAGE = Parsimmon.createLanguage<QueryLanguageTypes>({
    // Simple atom parsing, like words, identifiers, numbers.
    queryType: q => Parsimmon.alt<string>(Parsimmon.regexp(/TABLE|LIST|TASK/i)).map(str => str.toLowerCase() as QueryType)
        .desc("query type ('TABLE' or 'LIST')"),
    number: q => Parsimmon.regexp(/[0-9]+/).map(str => Number.parseFloat(str))
        .desc("number"),
    string: q => Parsimmon.regexp(/"(.*)"/, 1)
        .desc("string"),
    bool: q => Parsimmon.regexp(/true|false/).map(str => str == "true")
        .desc("boolean ('true' or 'false')"),
    tag: q => Parsimmon.regexp(/-?#[\w/]+/)
        .desc("tag ('#hello' or '-#goodbye')"),
    identifier: q => Parsimmon.regexp(/[a-zA-Z][\w_-]+/)
        .desc("variable identifier"),
    binaryPlusMinus: q => Parsimmon.regexp(/\+|-/).map(str => str as BinaryOp),
    binaryCompareOp: q => Parsimmon.regexp(/>=|<=|!=|>|<|=/).map(str => str as BinaryOp),
    binaryBooleanOp: q => Parsimmon.regexp(/and|or|&|\|/i).map(str => {
        if (str == 'and') return '&';
        else if (str == 'or') return '|';
        else return str as BinaryOp;
    }),

    // Field parsing.
    variableField: q => q.identifier.map(Fields.variable)
        .desc("variable field"),
    numberField: q => q.number.map(val => Fields.literal('number', val))
        .desc("number field"),
    stringField: q => q.string.map(val => Fields.literal('string', val))
        .desc("string field"),
    boolField: q => q.bool.map(val => Fields.literal('boolean', val))
        .desc("boolean field"),
    atomField: q => Parsimmon.alt(q.parensField, q.boolField, q.variableField, q.numberField, q.stringField),
    binaryPlusMinusField: q => Parsimmon.seqMap(q.atomField, Parsimmon.seq(Parsimmon.optWhitespace, q.binaryPlusMinus, Parsimmon.optWhitespace, q.atomField).many(),
        (first, rest) => {
            if (rest.length == 0) return first;

            let node = Fields.binaryOp(first, rest[0][1], rest[0][3]);
            for (let index = 1; index < rest.length; index++) {
                node = Fields.binaryOp(node, rest[index][1], rest[index][3]);
            }
            return node;
        }),
    binaryCompareField: q => Parsimmon.seqMap(q.binaryPlusMinusField, Parsimmon.seq(Parsimmon.optWhitespace, q.binaryCompareOp, Parsimmon.optWhitespace, q.binaryPlusMinusField).many(),
        (first, rest) => {
            if (rest.length == 0) return first;

            let node = Fields.binaryOp(first, rest[0][1], rest[0][3]);
            for (let index = 1; index < rest.length; index++) {
                node = Fields.binaryOp(node, rest[index][1], rest[index][3]);
            }
            return node;
        }),
    binaryBooleanField: q => Parsimmon.seqMap(q.binaryCompareField, Parsimmon.seq(Parsimmon.optWhitespace, q.binaryBooleanOp, Parsimmon.optWhitespace, q.binaryCompareField).many(),
        (first, rest) => {
            if (rest.length == 0) return first;

            let node = Fields.binaryOp(first, rest[0][1], rest[0][3]);
            for (let index = 1; index < rest.length; index++) {
                node = Fields.binaryOp(node, rest[index][1], rest[index][3]);
            }
            return node;
        }),
    binaryOpField: q => q.binaryBooleanField,
    parensField: q => Parsimmon.seqMap(Parsimmon.oneOf("("), Parsimmon.optWhitespace, q.field, Parsimmon.optWhitespace, Parsimmon.oneOf(")"), (_1, _2, field, _3, _4) => field),
    field: q => q.binaryOpField,
    explicitNamedField: q => Parsimmon.seqMap(q.field, Parsimmon.whitespace, Parsimmon.regexp(/AS/i), Parsimmon.whitespace, q.identifier,
        (field, _1, _2, _3, ident) => Fields.named(ident, field)),
    namedField: q => Parsimmon.alt<NamedField>(
        q.explicitNamedField,
        q.variableField.map(field => Fields.named(field.name, field))
    ),
    sortField: q => Parsimmon.seqMap(Parsimmon.optWhitespace,
        q.field, Parsimmon.optWhitespace, Parsimmon.regexp(/ASCENDING|DESCENDING|ASC|DESC/i).atMost(1),
            (_1, field, _2, dir) => {
                let direction = dir.length == 0 ? 'ascending' : dir[0].toLowerCase();
                if (direction == 'desc') direction = 'descending';
                if (direction == 'asc') direction = 'ascending';
                return {
                    field: field,
                    direction: direction as 'ascending' | 'descending'
                };
            }),

    selectClause: q => Parsimmon.seqMap(q.queryType, Parsimmon.whitespace, Parsimmon.sepBy1(q.namedField, Parsimmon.oneOf(',').trim(Parsimmon.optWhitespace)),
        (qtype, _, fields) => {
            return { type: qtype, fields }
        }),
    fromClause: q => Parsimmon.seqMap(Parsimmon.regexp(/FROM/i), Parsimmon.whitespace, q.tag.sepBy(Parsimmon.oneOf(',').trim(Parsimmon.optWhitespace)),
        (from, space, tag) => {
            return {
                type: 'from',
                include: tag.filter(e => e.startsWith('#')),
                exclude: tag.filter(e => e.startsWith('-')).map(e => e.substring(1))
            }
        }),
    whereClause: q => Parsimmon.seqMap(Parsimmon.regexp(/WHERE/i), Parsimmon.whitespace, q.field, (where, _, field) => {
        return { type: 'where', field };
    }),
    sortByClause: q => Parsimmon.seqMap(Parsimmon.regexp(/SORT/i), Parsimmon.whitespace, q.sortField.sepBy1(Parsimmon.oneOf(',').trim(Parsimmon.optWhitespace)),
        (sort, _1, fields) => {
            return { type: 'sort-by', fields };
        }),
    // Full query parsing.
    clause: q => Parsimmon.alt(q.fromClause, q.whereClause, q.sortByClause),
    query: q => Parsimmon.seqMap(q.selectClause, q.clause.trim(Parsimmon.optWhitespace).many(), (select, clauses) => {
        let fromClauses = clauses.filter((c): c is FromClause => c.type == 'from');
        let whereClauses = clauses.filter((c): c is WhereClause => c.type == 'where');
        let sortClauses = clauses.filter((c): c is SortByClause => c.type == 'sort-by');

        let includes = new Set<string>();
        let excludes = new Set<string>();
        for (let clause of fromClauses) {
            clause.include.forEach(e => includes.add(e));
            clause.exclude.forEach(e => excludes.add(e));
        }

        let compoundWhere: Field = Fields.literal('boolean', true);
        for (let clause of whereClauses) {
            compoundWhere = Fields.binaryOp(compoundWhere, '&', clause.field);
        }

        let sortBy: QuerySortBy[] = [];
        for (let clause of sortClauses) {
            clause.fields.forEach(entry => sortBy.push(entry));
        }

        return {
            type: select.type,
            fields: select.fields,
            from: Array.from(includes.values()),
            except: Array.from(excludes.values()),
            where: compoundWhere,
            sortBy: sortBy
        } as Query;
    })
});

/**
 * Attempt to parse a query from the given query text, returning a string error
 * if the parse failed.
 */
export function parseQuery(text: string): Query | string {
    let result = QUERY_LANGUAGE.query.parse(text);
    if (result.status == true) {
        return result.value;
    } else {
        return `Failed to parse query (line ${result.index.line}, column ${result.index.column}): expected one of ${result.expected}`;
    }
}
