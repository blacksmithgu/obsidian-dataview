/** Provides query parsing from plain-text. */
import 'parsimmon';
import * as Parsimmon from 'parsimmon';

/** The supported query types (corresponding to view types). */
export type QueryType = 'list' | 'table';

export type LiteralType = 'number' | 'string' | 'duration' | 'date' | 'rating';
export type LiteralTypeRepr<T extends LiteralType> =
    T extends 'number' ? number :
    T extends 'string' ? string :
    T extends 'duration' ? number :
    T extends 'date' ? number :
    T extends 'rating' ? number :
    any;

export type BinaryOp = '+' | '-' | '>' | '>=' | '<=' | '<' | '=';

/** A (potentially computed) field to select or compare against. */

export interface Field {
    /**
     * The field type - literals are actual raw values, variables are things in the frontmatter,
     * and computed are complex functions of subfields.
     * */
    type: 'literal' | 'variable' | 'binaryop';
}

export interface LiteralField<T extends LiteralType> extends Field {
    type: 'literal';
    valueType: T;
    value: LiteralTypeRepr<T>;
}

export interface VariableField extends Field {
    type: 'variable';
    name: string;
}

export interface BinaryOpField extends Field {
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

export namespace Fields {
    export function variable(name: string): VariableField {
        return { type: 'variable', name };
    }

    export function literal<T extends LiteralType>(vtype: T, val: LiteralTypeRepr<T>): Field {
        return { type: 'literal', valueType: vtype, value: val } as LiteralField<T>;
    }
    
    export function binaryOp(left: Field, op: BinaryOp, right: Field): Field {
        return { left, op, right } as BinaryOpField;
    }

    export function named(name: string, field: Field): NamedField {
        return { name, field } as NamedField;
    }
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

/** Typings for the outputs of all of the parser combinators. */
interface QueryLanguageTypes {
    queryType: QueryType;

    number: number;
    string: string;
    identifier: string;
    binaryPlusMinus: BinaryOp;
    binaryCompareOp: BinaryOp;

    // Field-related parsers.
    variableField: VariableField;
    numberField: Field;
    stringField: Field;
    atomField: Field;

    binaryPlusMinusField: Field;
    binaryOpField: Field;
    parensField: Field;
    field: Field;
    explicitNamedField: NamedField;
    namedField: NamedField;
}

/** A parsimmon-powered parser-combinator implementation of the query language. */
export const QUERY_LANGUAGE = Parsimmon.createLanguage<QueryLanguageTypes>({
    // Constants & words, like 'WHERE', 'SORT BY', so on.
    queryType: q => Parsimmon.alt<string>(Parsimmon.regexp(/LIST/i), Parsimmon.regexp(/TABLE/i)).map(str => str.toLowerCase() as QueryType),
    number: q => Parsimmon.regexp(/[0-9]+/).map(str => Number.parseFloat(str)),
    string: q => Parsimmon.regexp(/"(.*)"/, 1),
    identifier: q => Parsimmon.regexp(/[a-zA-Z][\w_-]+/),
    binaryPlusMinus: q => Parsimmon.regexp(/\+|-/).map(str => str as BinaryOp),
    binaryCompareOp: q => Parsimmon.regexp(/>=|<=|>|<|=/).map(str => str as BinaryOp),

    // Field parsing.
    variableField: q => q.identifier.map(Fields.variable),
    numberField: q => q.number.map(val => Fields.literal('number', val)),
    stringField: q => q.string.map(val => Fields.literal('string', val)),
    atomField: q => Parsimmon.alt(q.parensField, q.variableField, q.numberField, q.stringField),
    binaryPlusMinusField: q => Parsimmon.seqMap(q.atomField, Parsimmon.seq(Parsimmon.optWhitespace, q.binaryPlusMinus, Parsimmon.optWhitespace, q.atomField).many(),
        (first, rest) => {
            if (rest.length == 0) return first;

            let node = Fields.binaryOp(first, rest[0][1], rest[0][3]);
            for (let index = 1; index < rest.length; index++) {
                node = Fields.binaryOp(node, rest[index][1], rest[index][3]);
            }
            return node;
        }),
    binaryOpField: q => Parsimmon.seqMap(q.binaryPlusMinusField, Parsimmon.seq(Parsimmon.optWhitespace, q.binaryCompareOp, Parsimmon.optWhitespace, q.binaryPlusMinusField).many(),
        (first, rest) => {
            if (rest.length == 0) return first;

            let node = Fields.binaryOp(first, rest[0][1], rest[0][3]);
            for (let index = 1; index < rest.length; index++) {
                node = Fields.binaryOp(node, rest[index][1], rest[index][3]);
            }
            return node;
        }),
    parensField: q => Parsimmon.seqMap(Parsimmon.oneOf("("), Parsimmon.optWhitespace, q.field, Parsimmon.optWhitespace, Parsimmon.oneOf(")"), (_1, _2, field, _3, _4) => field),
    field: q => q.binaryOpField,
    explicitNamedField: q => Parsimmon.seqMap(q.field, Parsimmon.whitespace, Parsimmon.regexp(/AS/i), Parsimmon.whitespace, q.identifier,
        (field, _1, _2, _3, ident) => Fields.named(ident, field)),
    namedField: q => Parsimmon.alt<NamedField>(
        q.variableField.map(field => Fields.named(field.name, field)),
        q.explicitNamedField
    ),
});

/**
 * Attempt to parse a query from the given query text, returning a string error
 * if the parse failed.
 */
export function parseQuery(text: string): Query | string {
    return "Not implemented";
}