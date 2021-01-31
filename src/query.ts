/** Provides query parsing from plain-text. */
import 'parsimmon';
import * as Parsimmon from 'parsimmon';

/** The supported query types (corresponding to view types). */
export type QueryType = 'list' | 'table' | 'task';

/** The literal types supported by the query engine. */
export type LiteralType = 'boolean' | 'number' | 'string' | 'duration' | 'date' | 'null';
export type LiteralTypeRepr<T extends LiteralType> =
    T extends 'boolean' ? boolean :
    T extends 'number' ? number :
    T extends 'string' ? string :
    T extends 'duration' ? number :
    T extends 'date' ? number :
    T extends 'null' ? null :
    any;

/** Valid binary operators. */
export type BinaryOp = '+' | '-' | '>' | '>=' | '<=' | '<' | '=' | '&' | '|';

/** A (potentially computed) field to select or compare against. */
export type Field = BinaryOpField | VariableField | LiteralField;
export type LiteralField =
    LiteralFieldRepr<'string'>
    | LiteralFieldRepr<'number'>
    | LiteralFieldRepr<'boolean'>
    | LiteralFieldRepr<'null'>;

/** Literal representation of some field type. */
export interface LiteralFieldRepr<T extends LiteralType> {
    type: 'literal';
    valueType: T;
    value: LiteralTypeRepr<T>;
}

/** A variable field for a variable with a given name. */
export interface VariableField {
    type: 'variable';
    name: string;
}

/** A binary operator field which combines two subnodes somehow. */
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

/** The source of files for a query. */
export type Source = TagSource | FolderSource | EmptySource | BinaryOpSource;

/** A tag as a source of data. */
export interface TagSource {
    type: 'tag';
    /** The tag to source from. */
    tag: string;
}

/** A folder prefix as a source of data. */
export interface FolderSource {
    type: 'folder';
    /** The folder prefix to source from. */
    folder: string;
}

/** A source which yields nothing. */
export interface EmptySource {
    type: 'empty';
}

/** A source made by combining subsources with a logical operators. */
export interface BinaryOpSource {
    type: 'binaryop';
    op: BinaryOp;
    left: Source;
    right: Source;
}

export namespace Fields {
    export function variable(name: string): VariableField {
        return { type: 'variable', name };
    }

    export function literal<T extends LiteralType>(vtype: T, val: LiteralTypeRepr<T>): LiteralField {
        return { type: 'literal', valueType: vtype, value: val } as LiteralFieldRepr<T> as LiteralField;
    }
    
    export function binaryOp(left: Field, op: BinaryOp, right: Field): Field {
        return { type: 'binaryop', left, op, right } as BinaryOpField;
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

export namespace Sources {
    export function tag(tag: string): TagSource {
        return { type: 'tag', tag };
    }

    export function folder(prefix: string): FolderSource {
        return { type: 'folder', folder: prefix };
    }

    export function binaryOp(left: Source, op: BinaryOp, right: Source): Source {
        return { type: 'binaryop', left, op, right };
    }

    export function empty(): EmptySource {
        return { type: 'empty' };
    }
}

/** A query over the Obsidian database. */
export interface Query {
    /** The view type to render this query in. */
    type: QueryType;
    /** The fields (computed or otherwise) to select. */
    fields: NamedField[];
    /** The source that file candidates will come from. */
    source: Source;
    /** A boolean field which determines if a given entry should be included. */
    where: Field;
    /** */
    sortBy: QuerySortBy[];
}

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

    number: number;
    string: string;
    bool: boolean;
    tag: string;
    identifier: string;
    binaryPlusMinus: BinaryOp;
    binaryCompareOp: BinaryOp;
    binaryBooleanOp: BinaryOp;

    // Source-related parsers.
    tagSource: TagSource;
    folderSource: FolderSource;
    parensSource: Source;
    atomSource: Source;
    binaryOpSource: Source;
    source: Source;

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

/** Create a left-associative binary parser which parses the given sub-element and separator. Handles whitespace. */
export function createBinaryParser<T, U>(child: Parsimmon.Parser<T>, sep: Parsimmon.Parser<U>, combine: (a: T, b: U, c: T) => T): Parsimmon.Parser<T> {
    return Parsimmon.seqMap(child, Parsimmon.seq(Parsimmon.optWhitespace, sep, Parsimmon.optWhitespace, child).many(),
        (first, rest) => {
            if (rest.length == 0) return first;

            let node = combine(first, rest[0][1], rest[0][3]);
            for (let index = 1; index < rest.length; index++) {
                node = combine(node, rest[index][1], rest[index][3]);
            }
            return node;
        });
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
        .desc("tag ('#hello')"),
    identifier: q => Parsimmon.regexp(/[a-zA-Z][\w_-]+/)
        .desc("variable identifier"),
    binaryPlusMinus: q => Parsimmon.regexp(/\+|-/).map(str => str as BinaryOp),
    binaryCompareOp: q => Parsimmon.regexp(/>=|<=|!=|>|<|=/).map(str => str as BinaryOp),
    binaryBooleanOp: q => Parsimmon.regexp(/and|or|&|\|/i).map(str => {
        if (str == 'and') return '&';
        else if (str == 'or') return '|';
        else return str as BinaryOp;
    }),

    // Source parsing.
    tagSource: q => q.tag.map(tag => Sources.tag(tag)),
    folderSource: q => q.string.map(str => Sources.folder(str)),
    parensSource: q => Parsimmon.seqMap(Parsimmon.oneOf("("), Parsimmon.optWhitespace, q.source, Parsimmon.optWhitespace, Parsimmon.oneOf(")"), (_1, _2, field, _3, _4) => field),
    atomSource: q => Parsimmon.alt<Source>(q.parensSource, q.folderSource, q.tagSource),
    binaryOpSource: q => createBinaryParser(q.atomSource, q.binaryBooleanOp, Sources.binaryOp),
    source: q => q.binaryOpSource,

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
    binaryPlusMinusField: q => createBinaryParser(q.atomField, q.binaryPlusMinus, Fields.binaryOp),
    binaryCompareField: q => createBinaryParser(q.binaryPlusMinusField, q.binaryCompareOp, Fields.binaryOp),
    binaryBooleanField: q => createBinaryParser(q.binaryCompareField, q.binaryBooleanOp, Fields.binaryOp),
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
    fromClause: q => Parsimmon.seqMap(Parsimmon.regexp(/FROM/i), Parsimmon.whitespace, q.source,
        (from, space, source) => {
            return {
                type: 'from',
                source
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

        let source: Source = Sources.empty();
        for (let clause of fromClauses) {
            source = Sources.binaryOp(source, '|', clause.source);
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
            source: source,
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
